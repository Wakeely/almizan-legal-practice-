// =============================================================================
// Al Mizan — Case Investigation Agent — RAG service (THIN WRAPPER)
// -----------------------------------------------------------------------------
// This module is the ONLY surface through which the investigation agents touch
// the legal RAG stack. It deliberately does NOT re-implement retrieval or
// embedding — it reuses the real, production RAG helpers:
//
//   - src/lib/rag/retrieve.ts → matchLegalCorpus(), retrieveMatterChunks()
//   - src/lib/rag/embed.ts    → generateEmbedding() (gemini-embedding-001, 768-dim)
//   - src/lib/rag/types.ts    → RetrievedChunk
//
// WHY A WRAPPER AT ALL?
//   1. The investigation pipeline has slightly different needs than the
//      chat-style RAG endpoint (e.g. we need to RE-VERIFY a specific citation
//      against the corpus, not just retrieve top-k chunks). Centralising
//      those operations here keeps the agents thin and the RAG contract
//      explicit.
//   2. If the underlying RAG helpers ever change signature, only this file
//      needs updating — not every agent.
//   3. It enforces the product rule: "no invented citations". Every statute
//      the pipeline ever shows the user came from a real LegalCorpus row,
//      returned by the real matchLegalCorpus(). This wrapper has no path
//      that fabricates a statute.
//
// WHAT THIS FILE DOES NOT DO:
//   - It does NOT call the LLM. The LLM wrapper (services/llm-service.ts)
//     will be added in Phase 2.
//   - It does NOT persist anything. Persistence is the orchestrator's job.
//   - It does NOT fall back to web search for legal citations. Web search
//     results, if ever added, are awareness-only and never cited as law.
//
// PHASE 1 SCOPE: embedQuery, searchCorpus, searchMatterChunks, verifyCitation.
//   These are the only operations Phase 2's research + citation-verify agents
//   will need on day one.
// =============================================================================

import {
  generateEmbedding,
  isEmbeddingConfigured,
} from "@/lib/rag/embed";
import {
  matchLegalCorpus,
  retrieveMatterChunks,
} from "@/lib/rag/retrieve";
import type { RetrievedChunk } from "@/lib/rag/types";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RagServiceOptions {
  /** Top-k results to retrieve. Defaults per call site. */
  topK?: number;
  /** When true, the caller wants to know why embedding failed (e.g. to surface
   *  to the user). When false, failures silently degrade to text search. */
  reportEmbeddingErrors?: boolean;
}

export interface EmbedResult {
  /** The 768-dim vector, or null when embedding failed / was unconfigured. */
  values: number[] | null;
  /** Present only when reportEmbeddingErrors=true and values is null. */
  error?: string;
}

/**
 * Result of verifying a single citation against the real LegalCorpus.
 *
 *   found=true  → the citation matches a real statute row.
 *   found=false → NO matching statute exists. The pipeline MUST treat this as
 *                 a blocking failure for the citation-verify agent. It is
 *                 forbidden to invent a substitute.
 */
export interface CitationVerificationLookup {
  found: boolean;
  /** The matching RetrievedChunk when found=true. */
  corpusChunk?: RetrievedChunk;
  /** Cosine similarity 0..1 from pgvector (undefined in dev text fallback). */
  similarity?: number;
  /** True when vector search was unavailable and text search ran instead. */
  textFallback: boolean;
}

// -----------------------------------------------------------------------------
// Embedding — thin pass-through to the real gemini-embedding-001 helper.
// -----------------------------------------------------------------------------

/**
 * Embed a piece of text using the REAL generateEmbedding() helper.
 * Returns { values: null } when the Gemini key is unset or the call failed —
 * callers (research + citation-verify agents) degrade to text search, exactly
 * like the existing chat-style RAG endpoint does.
 *
 * This function NEVER calls a different embedding model. The product spec
 * explicitly forbids text-embedding-004 (deprecated) and forbids building a
 * new vector database.
 */
export async function embedQuery(
  text: string,
  opts?: RagServiceOptions,
): Promise<EmbedResult> {
  const result = await generateEmbedding(text);
  if (result.values) {
    return { values: result.values };
  }
  // Embedding failed — return the error only if the caller asked for it,
  // otherwise stay silent (the existing RAG endpoint does the same).
  return {
    values: null,
    error: opts?.reportEmbeddingErrors ? result.error : undefined,
  };
}

/** Expose the underlying "is Gemini configured?" probe for the UI / agents. */
export function isRagConfigured(): boolean {
  return isEmbeddingConfigured();
}

// -----------------------------------------------------------------------------
// Corpus search — wraps the real matchLegalCorpus() (global, read-only).
// -----------------------------------------------------------------------------

/**
 * Search the Jordanian LegalCorpus for the given query.
 *
 * Reuses matchLegalCorpus() from src/lib/rag/retrieve.ts. Embeds the query
 * via embedQuery() first; if embedding fails, the underlying helper falls
 * back to text search (Prisma contains) automatically.
 *
 * Returns ONLY real statutes that exist in LegalCorpus. This function will
 * NEVER return a fabricated citation — if the corpus has 0 hits, it returns
 * an empty array. The caller (Research Agent) is responsible for surfacing
 * "no statutes found" honestly to the user.
 */
export async function searchCorpus(
  query: string,
  opts?: RagServiceOptions,
): Promise<RetrievedChunk[]> {
  const topK = opts?.topK ?? 6;
  if (!query || query.trim().length < 2) return [];

  const { values } = await embedQuery(query, opts);
  // matchLegalCorpus handles null embeddings internally (text fallback).
  return matchLegalCorpus(values, topK, query);
}

// -----------------------------------------------------------------------------
// Matter chunk search — wraps the real retrieveMatterChunks() (org + matter
// scoped, hard-filtered at the DB level).
// -----------------------------------------------------------------------------

/**
 * Retrieve matter chunks for the given query, scoped to (organizationId,
 * matterId). The underlying match_document_chunks() SQL function hard-filters
 * by org + matter, so cross-org leakage is impossible regardless of what the
 * caller passes.
 *
 * Reuses retrieveMatterChunks() from src/lib/rag/retrieve.ts.
 */
export async function searchMatterChunks(
  organizationId: string,
  matterId: string,
  query: string,
  opts?: RagServiceOptions,
): Promise<RetrievedChunk[]> {
  const topK = opts?.topK ?? 4;
  if (!query || query.trim().length < 2) return [];
  // Defensive: never run a matter query without both scopes. The underlying
  // SQL function would reject this anyway, but failing fast here produces a
  // clearer error.
  if (!organizationId || !matterId) return [];

  const { values } = await embedQuery(query, opts);
  // retrieveMatterChunks handles null embeddings internally (text fallback).
  return retrieveMatterChunks(organizationId, matterId, values, topK, query);
}

// -----------------------------------------------------------------------------
// Citation re-verification — used by the Citation Verify Agent (stage 5).
// -----------------------------------------------------------------------------
// Given a citation as it appears in the draft (e.g. "القانون المدني،
// المادة 256"), look it up against the real LegalCorpus. This is the
// independent check that blocks assembly when a citation is fabricated or
// mis-cited.
//
// The lookup is a TWO-step process to maximise precision:
//   1. Embed the citation text and run matchLegalCorpus() for top-k semantic
//      matches. If the top hit has similarity >= SIMILARITY_THRESHOLD, accept.
//   2. If no semantic hit clears the threshold, fall back to an exact
//      (lawName + articleNumber) text lookup. This catches citations that
//      embed poorly but cite a real article.
//
// If neither path finds a match, found=false and the caller MUST treat it as
// a blocking failure ("not_found" status in CitationVerification).
// -----------------------------------------------------------------------------

/** Minimum cosine similarity to accept a semantic match. Below this, we fall
 *  back to exact text lookup. Tuned to match the 0.30 floor in
 *  match_legal_corpus() — anything below 0.55 is suspicious for a precise
 *  statute citation. */
const CITATION_SIMILARITY_THRESHOLD = 0.55;

export async function verifyCitation(
  claimedCitation: string,
): Promise<CitationVerificationLookup> {
  if (!claimedCitation || claimedCitation.trim().length < 2) {
    return { found: false, textFallback: false };
  }

  // Step 1: semantic search via the real matchLegalCorpus().
  const { values } = await embedQuery(claimedCitation);
  if (values) {
    const hits = await matchLegalCorpus(values, 5, claimedCitation);
    if (hits.length > 0) {
      const top = hits[0];
      if (top && (top.similarity ?? 0) >= CITATION_SIMILARITY_THRESHOLD) {
        return {
          found: true,
          corpusChunk: top,
          similarity: top.similarity,
          textFallback: false,
        };
      }
    }
  }

  // Step 2: exact text fallback. matchLegalCorpus() with a null embedding
  // runs the text-search path (Prisma contains) — this catches citations
  // like "المادة 256" that embed poorly but cite a real article.
  const textHits = await matchLegalCorpus(null, 5, claimedCitation);
  if (textHits.length > 0) {
    const top = textHits[0];
    return {
      found: true,
      corpusChunk: top,
      similarity: top.similarity, // undefined in text fallback
      textFallback: true,
    };
  }

  // No match — the citation is not in LegalCorpus. The caller MUST block.
  return { found: false, textFallback: false };
}
