// =============================================================================
// POST /api/ai/transcript-search — AI deposition transcript search
// Searches a deposition transcript for key admissions + extracts summary
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

const transcriptSearchSchema = z.object({
  transcriptId: z.string().min(1),
  query: z.string().min(2).max(1000),
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
  const parsed = parseBody(transcriptSearchSchema, body);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  // Fetch the transcript (org-scoped)
  const transcript = await db.depositionTranscript.findFirst({
    where: { id: data.transcriptId, ...orgWhere(r.session) },
    include: { pages: { orderBy: { pageNumber: "asc" } } },
  });
  if (!transcript) return NextResponse.json({ error: "Transcript not found" }, { status: 404 });

  // Build a compact transcript text for the prompt
  const transcriptText = transcript.pages
    .map((p) => `[Page ${p.pageNumber}] ${p.speaker}: ${p.text}`)
    .join("\n")
    .slice(0, 12000); // cap at 12K chars to stay within Gemini context

  const langInstruction = data.lang === "ar"
    ? "Write the summary in formal Arabic."
    : "Write the summary in formal English.";

  const prompt = `You are a deposition transcript analyst. Search the transcript below for content relevant to the query and extract a structured summary.

QUERY:
${data.query}

TRANSCRIPT (witness: ${transcript.witnessName}, role: ${transcript.witnessRole}, date: ${transcript.depositionDate}):
${transcriptText}

${langInstruction}

Return a JSON object with:
{
  "keyAdmissions": [
    {
      "pageNumber": <integer>,
      "speaker": "<name>",
      "quote": "<exact quote from transcript>",
      "significance": "<1-sentence explanation>"
    }
  ],
  "summary": "<2-3 paragraph overall summary>",
  "recommendedFollowUp": ["<question 1>", "<question 2>", ...]
}

Only return the JSON object. If no admissions are found, return an empty array for keyAdmissions.`;

  const result = await dispatchAiText({
    organizationId: r.session.organizationId,
    prompt,
    systemInstruction: "You are an enterprise deposition transcript analyst.",
  });

  let analysis: any = {
    keyAdmissions: [],
    summary: result.text,
    recommendedFollowUp: [],
  };

  if (!result._stub) {
    try {
      analysis = { ...analysis, ...JSON.parse(result.text) };
    } catch {
      // Keep defaults
    }
  }

  await audit({
    action: "ai.transcript-search",
    entity: "depositionTranscript",
    entityId: data.transcriptId,
    matterId: transcript.matterId,
    details: { queryLength: data.query.length, admissionsFound: analysis.keyAdmissions?.length ?? 0, _stub: result._stub },
  }, req);

  return NextResponse.json({
    ...analysis,
    _stub: result._stub,
    _disclaimer: "AI-assisted transcript analysis. Non-authoritative — verify against the source transcript.",
  });
}
