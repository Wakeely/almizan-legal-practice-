// =============================================================================
// Al Mizan — RAG retrieval (hybrid matter + Jordan corpus)
// -----------------------------------------------------------------------------
// Two retrieval paths, both org-scoped:
//
//   1. retrieveMatterChunks(organizationId, matterId, queryEmbedding, k)
//      — pgvector similarity on DocumentChunk. Hard-filtered by org + matter.
//   2. matchLegalCorpus(queryEmbedding, k)
//      — pgvector similarity on LegalCorpus (global read-only).
//
// DEV (SQLite / no pgvector): both paths catch the resulting SQL error and
// fall back to Prisma `contains` text search on chunk content. This means
// `bun run dev` still returns relevant chunks for keyword queries — just not
// for semantic queries that need vector similarity.
// =============================================================================

import { db } from "@/lib/db";
import type { RetrievedChunk } from "./types";

// Cache the "does the embedding column exist?" check so we don't spam the DB
// with failed queries on every retrieval call in dev.
let _vectorAvailableCache: boolean | null = null;

/**
 * Probe whether the pgvector stack is fully available:
 *   - the DocumentChunk.embedding column exists, AND
 *   - the match_document_chunks() SQL function exists.
 *
 * On SQLite dev the column doesn't exist → throws → returns false.
 * On Postgres before prisma/sql/rag_pgvector_setup.sql is run, the column
 * may exist (Prisma creates it via Unsupported("vector")) but the match
 * function won't → the second check throws → returns false. This catches
 * the half-set-up state so we fall back to text search instead of erroring
 * on every retrieval call.
 *
 * Result is cached for the process lifetime.
 */
export async function isVectorSearchAvailable(): Promise<boolean> {
  if (_vectorAvailableCache !== null) return _vectorAvailableCache;
  try {
    // Check 1: embedding column queryable.
    await db.$queryRaw`
      SELECT 1 FROM "DocumentChunk" WHERE embedding IS NOT NULL LIMIT 1
    `;
    // Check 2: match function exists (created by rag_pgvector_setup.sql).
    await db.$queryRaw`
      SELECT 1 FROM pg_proc WHERE proname = 'match_document_chunks' LIMIT 1
    `;
    _vectorAvailableCache = true;
  } catch {
    _vectorAvailableCache = false;
    console.warn(
      "[rag/retrieve] vector search unavailable — falling back to text search. " +
        "(This is expected on SQLite dev, or Postgres without pgvector / before " +
        "running prisma/sql/rag_pgvector_setup.sql.)",
    );
  }
  return _vectorAvailableCache;
}

/** Allow tests / seed scripts to reset the cache after schema changes. */
export function _resetVectorAvailabilityCache(): void {
  _vectorAvailableCache = null;
}

interface RawMatterRow {
  id: string;
  content: string;
  // NOTE: these keys MUST match the RETURNS TABLE column aliases declared in
  // match_document_chunks() (prisma/sql/rag_pgvector_setup.sql). Prisma's
  // $queryRaw preserves the column names as Postgres returns them, and Postgres
  // lowercases unquoted identifiers — so we use camelCase aliases inside the
  // SQL function and read them back here as camelCase keys.
  documentId: string | null;
  transcriptId: string | null;
  sourceType: string;
  pageNumber: number | null;
  chunkIndex: number;
  similarity: number;
}

/**
 * Retrieve top-k matter chunks for a query, scoped to (org, matter).
 * The queryEmbedding must be a 768-dim vector from generateEmbedding().
 * If embeddings are unavailable, falls back to text search on chunk content.
 */
export async function retrieveMatterChunks(
  organizationId: string,
  matterId: string,
  queryEmbedding: number[] | null,
  limit: number,
  queryText?: string,
): Promise<RetrievedChunk[]> {
  if (queryEmbedding && (await isVectorSearchAvailable())) {
    const literal = "[" + queryEmbedding.map((n) => Number(n).toFixed(7)).join(",") + "]";
    try {
      // We call the match_document_chunks() SQL function (defined in
      // prisma/sql/rag_pgvector_setup.sql) instead of inlining the query. This
      // keeps the column-quoting logic in ONE place — if the schema ever adds
      // @map renames, only the SQL function needs updating, not this file.
      // The function hard-filters by "organizationId" + "matterId", so the
      // org+matter scoping is enforced at the DB level (defense in depth).
      const rows = (await db.$queryRaw`
        SELECT * FROM match_document_chunks(
          ${literal}::vector,
          ${organizationId},
          ${matterId},
          ${limit},
          0.30
        )
      `) as RawMatterRow[];

      // Hydrate document names for citation building.
      const docIds = Array.from(
        new Set(rows.map((r) => r.documentId).filter(Boolean) as string[]),
      );
      const docNameMap = await hydrateDocumentNames(docIds);

      return rows.map((r) => ({
        chunkId: r.id,
        type: r.sourceType === "transcript" ? "transcript" : "document",
        documentId: r.documentId ?? undefined,
        documentName: r.documentId ? docNameMap.get(r.documentId) : undefined,
        transcriptId: r.transcriptId ?? undefined,
        pageNumber: r.pageNumber ?? undefined,
        chunkIndex: r.chunkIndex,
        content: r.content,
        similarity: r.similarity,
      }));
    } catch (err: any) {
      console.warn(
        "[rag/retrieve] matter vector search failed, falling back to text:",
        err?.message ?? err,
      );
    }
  }

  // Text fallback — used on SQLite dev or when vector probe failed.
  return retrieveMatterChunksText(organizationId, matterId, queryText, limit);
}

async function retrieveMatterChunksText(
  organizationId: string,
  matterId: string,
  queryText: string | undefined,
  limit: number,
): Promise<RetrievedChunk[]> {
  if (!queryText || queryText.trim().length < 2) return [];

  // Prisma `contains` with mode insensitive is Postgres-only, but SQLite's
  // default LIKE is already case-insensitive for ASCII. For Arabic, both
  // providers do a case-sensitive contains, which is fine — Arabic has no
  // case distinction.
  const chunks = await db.documentChunk.findMany({
    where: {
      organizationId,
      matterId,
      OR: [
        { content: { contains: queryText } },
        // Also match on individual whitespace-split keywords so partial queries
        // still find something. This is a heuristic; vector search is the real
        // path in production.
        ...queryText
          .split(/\s+/)
          .filter((w) => w.length >= 4)
          .slice(0, 6)
          .map((w) => ({ content: { contains: w } })),
      ],
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  // Hydrate document names.
  const docIds = Array.from(
    new Set(chunks.map((c) => c.documentId).filter(Boolean) as string[]),
  );
  const docNameMap = await hydrateDocumentNames(docIds);

  return chunks.map((c): RetrievedChunk => ({
    chunkId: c.id,
    type: c.sourceType === "transcript" ? "transcript" : "document",
    documentId: c.documentId ?? undefined,
    documentName: c.documentId ? docNameMap.get(c.documentId) : undefined,
    transcriptId: c.transcriptId ?? undefined,
    pageNumber: c.pageNumber ?? undefined,
    chunkIndex: c.chunkIndex,
    content: c.content,
    similarity: undefined, // text fallback has no similarity score
  }));
}

async function hydrateDocumentNames(
  docIds: string[],
): Promise<Map<string, string>> {
  if (docIds.length === 0) return new Map();
  try {
    const docs = await db.document.findMany({
      where: { id: { in: docIds } },
      select: { id: true, name: true },
    });
    return new Map(docs.map((d) => [d.id, d.name]));
  } catch {
    return new Map();
  }
}

interface RawCorpusRow {
  id: string;
  lawName: string;
  lawType: string;
  articleNumber: string;
  title: string | null;
  content: string;
  year: number | null;
  sourceUrl: string | null;
  similarity: number;
}

/**
 * Retrieve top-k Jordanian corpus articles for a query.
 * Falls back to text search when vector search is unavailable.
 */
export async function matchLegalCorpus(
  queryEmbedding: number[] | null,
  limit: number,
  queryText?: string,
): Promise<RetrievedChunk[]> {
  if (queryEmbedding && (await isVectorSearchAvailable())) {
    const literal =
      "[" + queryEmbedding.map((n) => Number(n).toFixed(7)).join(",") + "]";
    try {
      // Call the match_legal_corpus() SQL function (defined in
      // prisma/sql/rag_pgvector_setup.sql). Same rationale as matter chunks:
      // keeps column-quoting in one place.
      const rows = (await db.$queryRaw`
        SELECT * FROM match_legal_corpus(
          ${literal}::vector,
          ${limit},
          0.30
        )
      `) as RawCorpusRow[];

      return rows.map((r) => ({
        chunkId: r.id,
        type: "statute" as const,
        lawName: r.lawName,
        lawType: r.lawType,
        articleNumber: r.articleNumber,
        title: r.title ?? undefined,
        content: r.content,
        year: r.year ?? undefined,
        sourceUrl: r.sourceUrl ?? undefined,
        similarity: r.similarity,
      }));
    } catch (err: any) {
      console.warn(
        "[rag/retrieve] corpus vector search failed, falling back to text:",
        err?.message ?? err,
      );
    }
  }

  return matchLegalCorpusText(queryText, limit);
}

async function matchLegalCorpusText(
  queryText: string | undefined,
  limit: number,
): Promise<RetrievedChunk[]> {
  if (!queryText || queryText.trim().length < 2) return [];

  const corpus = await db.legalCorpus.findMany({
    where: {
      OR: [
        { content: { contains: queryText } },
        { title: { contains: queryText } },
        ...queryText
          .split(/\s+/)
          .filter((w) => w.length >= 4)
          .slice(0, 6)
          .map((w) => ({
            OR: [{ content: { contains: w } }, { title: { contains: w } }],
          })),
      ],
    },
    take: limit,
    orderBy: { lawName: "asc" },
  });

  return corpus.map((c): RetrievedChunk => ({
    chunkId: c.id,
    type: "statute" as const,
    lawName: c.lawName,
    lawType: c.lawType,
    articleNumber: c.articleNumber,
    title: c.title ?? undefined,
    content: c.content,
    year: c.year ?? undefined,
    sourceUrl: c.sourceUrl ?? undefined,
    similarity: undefined,
  }));
}
