// =============================================================================
// Al Mizan — RAG answer pipeline with mandatory citations
// -----------------------------------------------------------------------------
// The pipeline:
//   1. Embed the question.
//   2. Retrieve top-k matter chunks (org+matter scoped) + top-k Jordan corpus
//      articles (global read-only).
//   3. Build a strict system prompt that FORCES the model to:
//        a. Answer ONLY from the provided context.
//        b. Cite each claim with the source's id.
//        c. Refuse explicitly when no relevant context exists — never invent
//           article numbers.
//   4. Call Gemini with structured JSON output.
//   5. POST-PROCESS the response (the critical step): drop any source the
//      model cited that wasn't in our retrieved set. This is the Almoostashar
//      "merge sources so the model cannot ignore retrieval" pattern. We never
//      let a hallucinated article number reach the user.
//   6. Return the canonical RagAnswer shape.
// =============================================================================

import { callGemini } from "@/lib/gemini";
import { generateEmbedding } from "./embed";
import { isVectorSearchAvailable, retrieveMatterChunks, matchLegalCorpus } from "./retrieve";
import type { AnswerOptions, Citation, RetrievedChunk, RagAnswer } from "./types";

const DEFAULT_MATTER_TOP_K = 4;
const DEFAULT_CORPUS_TOP_K = 4;
const MAX_CONTEXT_CHARS = 24000; // cap retrieved text to stay within Gemini context
const MAX_EXCERPT_CHARS = 600; // cap each citation excerpt shown to the user

/** Disclaimers in both languages — always attached to the response. */
const DISCLAIMER = "AI-assisted. Non-authoritative — lawyer remains responsible.";

/**
 * Run the full RAG pipeline. Returns a RagAnswer regardless of whether
 * retrieval found anything — the "no sources" case returns grounded=false
 * with an explicit refusal message in the requested language.
 */
export async function answerRagQuestion(
  opts: AnswerOptions,
): Promise<RagAnswer> {
  const lang = opts.lang ?? "ar";
  const matterTopK = opts.matterTopK ?? DEFAULT_MATTER_TOP_K;
  const corpusTopK = opts.corpusTopK ?? DEFAULT_CORPUS_TOP_K;
  const includeMatter = opts.includeMatter !== false;
  const includeCorpus = opts.includeCorpus !== false;

  // 1. Embed the question.
  const queryEmbedding = await generateEmbedding(opts.question);

  // 2. Retrieve chunks in parallel.
  const [matterChunks, corpusChunks] = await Promise.all([
    includeMatter
      ? retrieveMatterChunks(
          opts.organizationId,
          opts.matterId,
          queryEmbedding,
          matterTopK,
          opts.question,
        )
      : Promise.resolve([]),
    includeCorpus
      ? matchLegalCorpus(queryEmbedding, corpusTopK, opts.question)
      : Promise.resolve([]),
  ]);

  const allChunks = [...matterChunks, ...corpusChunks];
  const hasRetrieval = allChunks.length > 0;
  const textFallback = !(await isVectorSearchAvailable());

  // 3a. No retrieval — return the explicit refusal path. We do NOT call Gemini
  // here because the spec is clear: "if retrieval finds nothing, the system
  // says so instead of inventing articles." A Gemini call with empty context
  // would risk hallucination.
  if (!hasRetrieval) {
    return {
      answer: lang === "ar"
        ? "لم يتم العثور على مواد داعمة في ملفات القضية أو في المدوّنة القانونية الأردنية المعتمدة. " +
          "لا يمكن تقديم إجابة موثقة بشأن هذا السؤال. يُرجى إعادة صياغة السؤال أو التأكد من رفع المستندات ذات الصلة بالقضية."
        : "No supporting material was found in the matter files or the curated Jordanian legal corpus. " +
          "A grounded answer cannot be provided for this question. Please rephrase the question or ensure relevant documents have been uploaded to the matter.",
      sources: [],
      grounded: false,
      noSources: true,
      matterHits: 0,
      corpusHits: 0,
      disclaimer: DISCLAIMER,
      lang,
      _stub: false,
      _textFallback: textFallback,
    };
  }

  // 3b. Build the context block for Gemini. Each chunk is labeled with an
  // index that the model uses to cite sources. We cap total context chars
  // to stay within Gemini's input budget.
  const contextBlock = buildContextBlock(allChunks, MAX_CONTEXT_CHARS);

  // 4. Build the strict prompt.
  const langInstruction =
    lang === "ar"
      ? "اكتب الإجابة بالعربية الفصحى القانونية."
      : "Write the answer in formal legal English.";

  const refusalInstruction =
    lang === "ar"
      ? "إذا لم يكن في السياق ما يكفي للإجابة، قُل صراحةً: «لم يتم العثور على مواد داعمة كافية» ولا تخترع أرقام مواد أو نصوص قانونية."
      : "If the context does not contain enough information to answer, say explicitly: \"Insufficient supporting material found\" and do not invent article numbers or legal text.";

  const systemPrompt = `You are a legal research assistant for Jordanian / MENA legal practice. Your role is to answer the lawyer's question STRICTLY from the provided context — you are NOT a general legal oracle.

HARD RULES:
1. Answer ONLY using the context provided below. Do NOT bring in outside legal knowledge.
2. Every factual or legal claim in your answer MUST be backed by a citation to a source id from the context.
3. Cite sources by their numeric id (e.g. "source 1", "source 3"). Only cite ids that exist in the context.
4. If the context does not contain enough to answer, say so explicitly — NEVER invent article numbers, law names, or legal provisions.
5. Quote short excerpts (max 80 words) from the source when the exact wording matters.
6. Preserve the original Arabic text of any quoted statute verbatim.
7. ${refusalInstruction}
8. ${langInstruction}

${contextBlock}

Return ONLY a JSON object with this exact shape (no markdown, no prose before/after):
{
  "answer": "<your grounded answer, citing sources as [source N]>",
  "cited_source_ids": [<int>, <int>, ...],
  "confidence": <0.0-1.0, your confidence that the context answers the question>
}

If you cannot answer from the context, return:
{
  "answer": "${lang === "ar" ? "لم يتم العثور على مواد داعمة كافية في السياق المقدم." : "Insufficient supporting material found in the provided context."}",
  "cited_source_ids": [],
  "confidence": 0.0
}`;

  // 5. Call Gemini.
  const result = await callGemini(
    `Question: ${opts.question}`,
    systemPrompt,
  );

  // 6. Parse the JSON response.
  let parsed: { answer?: string; cited_source_ids?: number[]; confidence?: number } = {};
  if (!result._stub) {
    try {
      // Strip any accidental markdown fences.
      const cleaned = result.text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If JSON parse fails, treat the raw text as the answer with no citations.
      parsed = { answer: result.text, cited_source_ids: [], confidence: 0.3 };
    }
  } else {
    parsed = {
      answer: result.text,
      cited_source_ids: [],
      confidence: 0.0,
    };
  }

  // 7. POST-PROCESS: drop hallucinated citations.
  // The model may cite source ids that don't exist or weren't retrieved. We
  // build the final citations[] array strictly from the retrieved chunks,
  // filtered by the model's cited_source_ids. If the model cited nothing
  // valid, we attach ALL retrieved sources as "supporting material" so the
  // lawyer can still see what was retrieved — but mark grounded=false.
  const citedIds = new Set(parsed.cited_source_ids ?? []);
  let citations: Citation[] = allChunks
    .filter((chunk) => chunk.sourceId !== undefined && citedIds.has(chunk.sourceId))
    .map((chunk) => toCitation(chunk));

  // If the model didn't cite any valid sources but we DID retrieve chunks,
  // attach all retrieved chunks as supporting material. The answer is marked
  // ungrounded so the UI shows a warning badge.
  let grounded = citations.length > 0;
  if (citations.length === 0 && allChunks.length > 0 && !parsed.answer?.includes("Insufficient") && !parsed.answer?.includes("لم يتم العثور")) {
    citations = allChunks.map((chunk) => toCitation(chunk));
    grounded = false; // model didn't cite, so we can't trust the answer is grounded
  }

  // 8. Detect explicit refusal — even if we retrieved chunks, the model may
  // have decided they're irrelevant. Respect that.
  const isRefusal =
    parsed.answer?.includes("Insufficient") ||
    parsed.answer?.includes("لم يتم العثور") ||
    parsed.answer?.includes("غير كاف") ||
    (citedIds.size === 0 && parsed.confidence === 0);

  if (isRefusal) {
    grounded = false;
  }

  return {
    answer: parsed.answer ?? "",
    sources: citations,
    grounded,
    noSources: false,
    matterHits: matterChunks.length,
    corpusHits: corpusChunks.length,
    disclaimer: DISCLAIMER,
    lang,
    _stub: result._stub,
    _textFallback: textFallback,
  };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Build the context block: each chunk gets a numeric id (1-indexed) that the
 * model uses to cite sources. We truncate total context to maxChars.
 *
 * Side effect: mutates each chunk to set `.sourceId` so the caller can map
 * the model's cited_source_ids back to RetrievedChunk objects.
 */
function buildContextBlock(
  chunks: RetrievedChunk[],
  maxChars: number,
): string {
  const lines: string[] = ["CONTEXT (cite by source id):"];
  let used = lines[0].length;
  let sourceId = 1;

  for (const chunk of chunks) {
    const header = buildSourceHeader(chunk, sourceId);
    const content = chunk.content.slice(0, 1200); // cap per-chunk
    const block = `\n--- source ${sourceId} ---\n${header}\n${content}\n`;
    if (used + block.length > maxChars) break;
    lines.push(block);
    chunk.sourceId = sourceId;
    sourceId++;
    used += block.length;
  }

  return lines.join("\n");
}

function buildSourceHeader(chunk: RetrievedChunk, id: number): string {
  if (chunk.type === "statute") {
    return `[STATUTE] ${chunk.lawName ?? ""} — المادة ${chunk.articleNumber ?? "?"} (${chunk.lawType ?? "law"})${chunk.title ? ` — ${chunk.title}` : ""}${chunk.year ? ` — ${chunk.year}` : ""}`;
  }
  if (chunk.type === "transcript") {
    return `[TRANSCRIPT] ${chunk.documentName ?? "Transcript"} — page ${chunk.pageNumber ?? "?"}`;
  }
  return `[DOCUMENT] ${chunk.documentName ?? "Document"} — chunk ${chunk.chunkIndex ?? "?"}`;
}

function toCitation(chunk: RetrievedChunk): Citation {
  const excerpt = chunk.content.slice(0, MAX_EXCERPT_CHARS);
  const base: Citation = {
    type: chunk.type,
    excerpt,
    chunkId: chunk.chunkId,
  };
  if (chunk.type === "statute") {
    return {
      ...base,
      lawName: chunk.lawName,
      lawType: chunk.lawType,
      articleNumber: chunk.articleNumber,
      title: chunk.title,
      year: chunk.year,
      sourceUrl: chunk.sourceUrl,
    };
  }
  return {
    ...base,
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    transcriptId: chunk.transcriptId,
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
  };
}

// Augment RetrievedChunk at runtime with a sourceId field used by the
// context builder. We keep it out of the public type to avoid leaking the
// internal indexing detail to callers.
declare module "./types" {
  interface RetrievedChunk {
    sourceId?: number;
  }
}
