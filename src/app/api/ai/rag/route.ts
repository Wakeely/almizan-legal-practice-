// =============================================================================
// POST /api/ai/rag — grounded legal Q&A with mandatory citations
// -----------------------------------------------------------------------------
// Body:
//   {
//     matterId: string,
//     question: string,
//     lang?: "ar" | "en",
//     includeCorpus?: boolean,   // default true — search Jordanian statutes
//     includeMatter?: boolean,   // default true — search matter files + transcripts
//   }
//
// Returns the canonical RagAnswer shape (see src/lib/rag/types.ts):
//   {
//     answer: string,
//     sources: Citation[],
//     grounded: boolean,
//     noSources: boolean,
//     matterHits: number,
//     corpusHits: number,
//     disclaimer: string,
//     lang: "ar"|"en",
//     _stub: boolean,
//     _textFallback: boolean
//   }
//
// Security:
//   - requireUser() enforces auth + org scope.
//   - verifyMatterBelongsToOrg() ensures the matter belongs to the user's org
//     BEFORE any retrieval runs. No cross-org chunks can ever be returned.
//   - aiRateLimit() throttles per IP+org (same budget as other AI routes).
//   - audit() logs the call with matterId + source count (NOT the question
//     text — questions may contain privileged content).
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser, verifyMatterBelongsToOrg } from "@/lib/org";
import { aiRateLimit, getClientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { answerRagQuestion } from "@/lib/rag/answer";

const ragSchema = z.object({
  matterId: z.string().min(1),
  question: z.string().min(2).max(2000),
  lang: z.enum(["ar", "en"]).optional(),
  includeCorpus: z.boolean().optional(),
  includeMatter: z.boolean().optional(),
});

export async function POST(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const ip = getClientIp(req);
  const limit = await aiRateLimit(ip, r.session.organizationId);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "AI rate limit exceeded. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(ragSchema, body);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  // CRITICAL: verify the matter belongs to the user's org before retrieval.
  // This is the only gate that prevents cross-org chunk leakage.
  const owns = await verifyMatterBelongsToOrg(data.matterId, r.session);
  if (!owns) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  // Run the RAG pipeline.
  const answer = await answerRagQuestion({
    organizationId: r.session.organizationId,
    matterId: data.matterId,
    question: data.question,
    lang: data.lang,
    includeCorpus: data.includeCorpus,
    includeMatter: data.includeMatter,
  });

  // Audit log — record the call but NOT the question text (may be privileged).
  await audit({
    action: "ai.rag",
    entity: "matter",
    entityId: data.matterId,
    matterId: data.matterId,
    details: {
      grounded: answer.grounded,
      noSources: answer.noSources,
      matterHits: answer.matterHits,
      corpusHits: answer.corpusHits,
      lang: answer.lang,
      sourcesCount: answer.sources.length,
      questionLength: data.question.length,
      _stub: answer._stub,
      _textFallback: answer._textFallback,
    },
  }, req);

  return NextResponse.json(answer);
}
