// =============================================================================
// POST /api/ai/generate-pleading — War Room AI rebuttal generator
// Generates a rebuttal argument based on opposing counsel's expected position
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";
import { aiRateLimit, getClientIp } from "@/lib/rate-limit";
import { dispatchAiText } from "@/lib/byok-dispatch";
import { audit } from "@/lib/audit";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { assertAiQuota } from "@/lib/student-access";
import {
  resolveMatterJurisdiction,
  buildJurisdictionAiContext,
} from "@/lib/jurisdictions";

const rebuttalSchema = z.object({
  matterId: z.string().optional(),
  witnessName: z.string().max(200).optional(),
  exhibitNumber: z.string().max(60).optional(),
  opposingArgument: z.string().min(2).max(4000),
  lang: z.enum(["ar", "en"]).optional(),
});

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
  const parsed = parseBody(rebuttalSchema, body);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  // Fetch matter + org in parallel to resolve the jurisdiction override chain.
  const [matter, organization] = await Promise.all([
    data.matterId
      ? db.matter.findFirst({ where: { id: data.matterId, ...orgWhere(r.session) } })
      : Promise.resolve(null),
    db.organization.findUnique({
      where: { id: r.session.organizationId },
      select: { jurisdiction: true },
    }),
  ]);

  const jurisdictionInfo = resolveMatterJurisdiction(matter, organization);
  const { systemContext: jurisdictionSystemContext } =
    buildJurisdictionAiContext(jurisdictionInfo);

  const langInstruction = data.lang === "ar"
    ? "Write the entire rebuttal in formal Arabic legal terminology."
    : "Write the entire rebuttal in formal English legal terminology.";

  const prompt = `You are a senior trial advocacy strategist. Generate a structured rebuttal argument that can be delivered in court.

OPPOSING COUNSEL'S ARGUMENT:
${data.opposingArgument}

${matter ? `MATTER CONTEXT:
- Title: ${matter.title}
- Jurisdiction: ${jurisdictionInfo.labelEn} (${jurisdictionInfo.labelAr})
- Opposing party: ${matter.opposingParty ?? "Unknown"}` : `MATTER CONTEXT:
- (No matter selected. Using organization default jurisdiction: ${jurisdictionInfo.labelEn})`}

${data.witnessName ? `WITNESS UNDER EXAMINATION: ${data.witnessName}` : ""}
${data.exhibitNumber ? `RELATED EXHIBIT: ${data.exhibitNumber}` : ""}

${langInstruction}

Structure your rebuttal as:
1. **Summary of Opposing Position** (1-2 sentences)
2. **Legal Deficiencies in Their Argument** (bullet list with citations to civil procedure rules / case law where applicable)
3. **Factual Contradictions** (bullet list referencing exhibits or witness testimony)
4. **Recommended Counter-Argument** (2-3 paragraph narrative suitable for oral delivery)
5. **Preserved Objections** (list of legal objections to formally preserve)

Output ONLY the structured rebuttal text. No commentary.`;

  const result = await dispatchAiText({
    organizationId: r.session.organizationId,
    prompt,
    systemInstruction:
      "You are a senior trial advocacy strategist.\n\n" +
      jurisdictionSystemContext,
  });

  await audit({
    action: "ai.generate-rebuttal",
    matterId: data.matterId,
    details: { witnessName: data.witnessName, exhibitNumber: data.exhibitNumber, _stub: result._stub },
  }, req);

  return NextResponse.json({
    text: result.text,
    _stub: result._stub,
    _disclaimer: "AI-assisted rebuttal. Non-authoritative — review with lead counsel before delivery.",
  });
}
