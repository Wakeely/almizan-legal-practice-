// =============================================================================
// POST /api/ai/analyze-risk — Gemini-powered matter risk assessment
// -----------------------------------------------------------------------------
// Called from MattersModule's "Run AI Risk Analysis" button.
// Returns risk summary, key challenges, strategy recommendations, risk score,
// win probability.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";
import { aiRateLimit, getClientIp } from "@/lib/rate-limit";
import { dispatchAiText } from "@/lib/byok-dispatch";
import { audit } from "@/lib/audit";
import { assertAiQuota } from "@/lib/student-access";
import {
  resolveMatterJurisdiction,
  buildJurisdictionAiContext,
} from "@/lib/jurisdictions";

export async function POST(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const quota = await assertAiQuota(r.session.id);
  if (quota.ok === false) return quota.response;

  const ip = getClientIp(req);
  const limit = await aiRateLimit(ip, r.session.organizationId);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "AI rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const body = await req.json().catch((): null => null);
  const { matterId } = body ?? {};
  if (!matterId) return NextResponse.json({ error: "matterId required" }, { status: 400 });

  // Fetch matter + org in parallel so we can resolve the matter → org
  // jurisdiction override chain via the catalog.
  const [matter, organization] = await Promise.all([
    db.matter.findFirst({ where: { id: matterId, ...orgWhere(r.session) } }),
    db.organization.findUnique({
      where: { id: r.session.organizationId },
      select: { jurisdiction: true },
    }),
  ]);
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const jurisdictionInfo = resolveMatterJurisdiction(matter, organization);
  const { systemContext: jurisdictionSystemContext, enableJordanianLawTools } =
    buildJurisdictionAiContext(jurisdictionInfo);

  const prompt = `You are a litigation risk analyst. Analyze the following matter and return a JSON object with risk assessment.

Matter title: ${matter.title}
Description: ${matter.description ?? "(no description provided)"}
Client: ${matter.clientName}
Jurisdiction: ${jurisdictionInfo.labelEn} (${jurisdictionInfo.labelAr})
Opposing party: ${matter.opposingParty ?? "Unknown"}
Opposing counsel: ${matter.opposingCounsel ?? "Unknown"}
Risk level (lawyer's current assessment): ${matter.riskLevel}
Current win probability: ${matter.winProbability}%
Judge: ${matter.judge ?? "Unknown"}
Court: ${matter.court ?? "Unknown"}
Budget: ${matter.budget}
Expenses: ${matter.expenses}

Return a JSON object:
{
  "riskSummary": "<2-3 paragraph summary of key risks>",
  "keyChallenges": ["challenge 1", "challenge 2", ...],
  "strategyRecommendations": ["recommendation 1", "recommendation 2", ...],
  "riskScore": <integer 0-100>,
  "winProbability": <integer 0-100>
}

Only return the JSON object.`;

  // Jordanian matters still get MCP-grounded tool calls; other jurisdictions
  // use the catalog's plain-text context.
  const isJordanMatter = enableJordanianLawTools;

  const riskSystemPrompt =
    "You are an enterprise litigation risk analyst.\n\n" +
    jurisdictionSystemContext + "\n\n" +
    "When you cite a statute, prefer verified article numbers. Never invent citations — " +
    "if you cannot verify one, state that it needs manual verification.";

  const result = await dispatchAiText({
    organizationId: r.session.organizationId,
    prompt,
    systemInstruction: riskSystemPrompt,
    tools: isJordanMatter,
  });

  let analysis: any = {
    riskSummary: result.text,
    keyChallenges: [],
    strategyRecommendations: [],
    riskScore: matter.riskLevel === "High" ? 75 : matter.riskLevel === "Medium" ? 50 : 25,
    winProbability: matter.winProbability,
  };

  if (!result._stub) {
    try {
      const parsed = JSON.parse(result.text);
      analysis = { ...analysis, ...parsed };
    } catch {
      // Keep defaults
    }
  }

  // Sync winProbability back to the matter
  if (typeof analysis.winProbability === "number") {
    await db.matter.update({
      where: { id: matter.id },
      data: { winProbability: Math.max(0, Math.min(100, analysis.winProbability)) },
    });
  }

  await audit({
    action: "ai.analyze-risk",
    entity: "matter",
    entityId: matter.id,
    details: {
      riskScore: analysis.riskScore,
      winProbability: analysis.winProbability,
      jurisdictionCode: jurisdictionInfo.code,
      jurisdictionLabel: jurisdictionInfo.labelBilingual,
      _stub: result._stub,
    },
  }, req);

  return NextResponse.json({
    ...analysis,
    _stub: result._stub,
    _disclaimer: "AI-assisted risk analysis. Non-authoritative — for use as decision support only, not as legal advice.",
  });
}
