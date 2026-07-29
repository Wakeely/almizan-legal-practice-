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
import { callGemini } from "@/lib/gemini";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

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

  const matter = await db.matter.findFirst({
    where: { id: matterId, ...orgWhere(r.session) },
  });
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const prompt = `You are a litigation risk analyst. Analyze the following matter and return a JSON object with risk assessment.

Matter title: ${matter.title}
Description: ${matter.description ?? "(no description provided)"}
Client: ${matter.clientName}
Jurisdiction: ${matter.jurisdiction}
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

  const result = await callGemini(prompt, "You are an enterprise litigation risk analyst specializing in GCC/MENA jurisdictions.");

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
      _stub: result._stub,
    },
  }, req);

  return NextResponse.json({
    ...analysis,
    _stub: result._stub,
    _disclaimer: "AI-assisted risk analysis. Non-authoritative — for use as decision support only, not as legal advice.",
  });
}
