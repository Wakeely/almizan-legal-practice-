// =============================================================================
// Agent 2 — Research Agent
// -----------------------------------------------------------------------------
// Searches the REAL LegalCorpus (statutes) + matter chunks for the
// investigation. Reuses rag-service.ts, which in turn wraps the real
// matchLegalCorpus() + retrieveMatterChunks() + generateEmbedding().
//
// CRITICAL PRODUCT RULE: corpusHits only ever contains statutes that ACTUALLY
// exist in LegalCorpus. If the corpus returns 0 hits, noCorpusHits=true and
// the drafting agent must proceed with NO legal citations. There is no path
// in this agent that fabricates a statute.
//
// Query generation: the agent builds 2–3 retrieval queries from the intake
// (claims text + fact summary). It does NOT call the LLM to generate queries —
// deterministic query construction keeps retrieval auditable + replayable.
// =============================================================================

import { searchCorpus, searchMatterChunks } from "@/lib/agents/services/rag-service";
import type { IntakeResult, ResearchResult } from "@/lib/agents/types";

const MAX_QUERIES = 3;
const CORPUS_TOP_K = 6;
const MATTER_TOP_K = 4;

export async function runResearchAgent(
  organizationId: string,
  matterId: string | null,
  intake: IntakeResult,
): Promise<ResearchResult> {
  // 1. Build retrieval queries deterministically from the intake.
  const queries = buildQueries(intake).slice(0, MAX_QUERIES);

  // 2. Run corpus + matter searches for each query, dedupe by chunkId.
  const corpusMap = new Map<string, ResearchResult["corpusHits"][number]>();
  const matterMap = new Map<string, ResearchResult["matterHits"][number]>();

  for (const q of queries) {
    const corpusHits = await searchCorpus(q, { topK: CORPUS_TOP_K });
    for (const h of corpusHits) {
      if (!corpusMap.has(h.chunkId)) corpusMap.set(h.chunkId, h);
    }

    if (matterId) {
      const matterHits = await searchMatterChunks(organizationId, matterId, q, {
        topK: MATTER_TOP_K,
      });
      for (const h of matterHits) {
        if (!matterMap.has(h.chunkId)) matterMap.set(h.chunkId, h);
      }
    }
  }

  const corpusHits = Array.from(corpusMap.values());
  const matterHits = Array.from(matterMap.values());

  return {
    queries,
    corpusHits,
    matterHits,
    noCorpusHits: corpusHits.length === 0,
  };
}

/**
 * Build 2–3 retrieval queries from the intake. Deterministic — no LLM call.
 *
 * Strategy:
 *   - Query 1: concatenation of all claim texts (the "what is this case about" query).
 *   - Query 2: concatenation of fact texts (the "what are the key facts" query).
 *   - Query 3: party names + amounts + dates (the "who/when/how much" query).
 *
 * Empty queries are dropped. If everything is empty, returns a single
 * fallback query derived from the intake summary.
 */
function buildQueries(intake: IntakeResult): string[] {
  const q1 = (intake.claims ?? []).map((c) => c.text).join(" ").trim();
  const q2 = (intake.facts ?? []).map((f) => f.text).join(" ").trim();
  const q3 = [
    ...(intake.parties ?? []).map((p) => p.name),
    ...(intake.amounts ?? []).map((a) => `${a.amount} ${a.currency}`),
    ...(intake.dates ?? []).map((d) => d.date),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const queries = [q1, q2, q3].filter((q) => q.length >= 3);
  if (queries.length === 0) {
    // Fallback: use the intake summary as the query.
    const fallback = (intake.summary ?? "").trim();
    if (fallback.length >= 3) return [fallback.slice(0, 500)];
    return [];
  }
  return queries.map((q) => q.slice(0, 500));
}
