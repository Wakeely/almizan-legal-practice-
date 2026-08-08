// =============================================================================
// Agent 5 — Citation Verify Agent (BLOCKING)
// -----------------------------------------------------------------------------
// Re-checks EVERY citation the draft cited against the REAL LegalCorpus.
// Uses rag-service.verifyCitation(), which calls the real matchLegalCorpus()
// (semantic) + falls back to exact text lookup.
//
// If ANY citation comes back with found=false, the Assembler is blocked.
// The blocking logic lives in types.ts:canAssemble() — this agent just
// produces the verification rows; the orchestrator decides whether to block.
//
// CRITICAL: this agent NEVER accepts a citation that isn't in LegalCorpus.
// There is no "close enough" path. If the corpus has no match, status is
// 'not_found' and assembly is blocked.
// =============================================================================

import { verifyCitation } from "@/lib/agents/services/rag-service";
import type {
  CitationVerification,
  DraftResult,
  ResearchResult,
} from "@/lib/agents/types";

export async function runCitationVerifyAgent(
  draft: DraftResult,
  research: ResearchResult,
): Promise<CitationVerification[]> {
  // Collect the unique chunkIds the draft cited (from the legal_basis section
  // citationIds). Each cited chunk becomes ONE verification row.
  const citedIds = new Set<string>();
  for (const section of draft.sections) {
    for (const id of section.citationIds) {
      citedIds.add(id);
    }
  }

  // Build a lookup of corpus hits by chunkId so we can construct the
  // claimedCitation string + the expected corpusId without re-searching.
  const corpusById = new Map<string, ResearchResult["corpusHits"][number]>();
  for (const h of research.corpusHits) {
    corpusById.set(h.chunkId, h);
  }

  const results: CitationVerification[] = [];

  for (const chunkId of citedIds) {
    const corpus = corpusById.get(chunkId);
    if (!corpus) {
      // The draft cited a chunkId that wasn't in the research output. This
      // shouldn't happen (drafting only uses research.corpusHits), but if it
      // does, treat it as a fabrication and block.
      results.push({
        claimedCitation: chunkId,
        status: "failed",
        reason:
          "Draft cited a chunk id that was not present in the research output. Possible pipeline corruption.",
      });
      continue;
    }

    // Build the human-readable citation string the draft relied on.
    const claimedCitation = `${corpus.lawName ?? "?"} — ${corpus.articleNumber ?? "?"}`;

    // Re-verify against the real LegalCorpus. This is the independent check.
    const lookup = await verifyCitation(claimedCitation);

    if (lookup.found && lookup.corpusChunk) {
      // Verify the re-found chunk matches the original (same article number).
      const originalArticle = corpus.articleNumber;
      const foundArticle = lookup.corpusChunk.articleNumber;
      if (originalArticle && foundArticle && originalArticle === foundArticle) {
        results.push({
          claimedCitation,
          status: "verified",
          corpusId: lookup.corpusChunk.chunkId,
          similarity: lookup.similarity,
          reason: lookup.textFallback
            ? "Verified via exact text match (vector search unavailable)."
            : `Verified via semantic match (similarity ${(lookup.similarity ?? 0).toFixed(3)}).`,
        });
      } else {
        // The re-search found a different article than the one cited. This is
        // suspicious — mark as failed and block.
        results.push({
          claimedCitation,
          status: "failed",
          corpusId: lookup.corpusChunk.chunkId,
          similarity: lookup.similarity,
          reason: `Re-verification found a different article (Art. ${foundArticle ?? "?"}) than the one cited (Art. ${originalArticle ?? "?"}). Possible mis-citation.`,
        });
      }
    } else {
      // Not found in the corpus — blocking failure.
      results.push({
        claimedCitation,
        status: "not_found",
        reason:
          "Citation could not be re-verified against the Jordanian LegalCorpus. The pipeline does not allow unverified citations to reach the final package.",
      });
    }
  }

  return results;
}
