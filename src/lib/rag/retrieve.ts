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
 * Probe whether the DocumentChunk.embedding column exists and is queryable.
 * On SQLite dev, the column doesn't exist, so the probe SQL throws. We cache
 * the result so subsequent retrievals skip straight to text fallback.
 */
export async function isVectorSearchAvailable(): Promise<boolean> {
  if (_vectorAvailableCache !== null) return _vectorAvailableCache;
  try {
    // Cheap probe — SELECT 1 from the column. On SQLite this throws because
    // the column doesn't exist. On Postgres without pgvector setup it throws
    // because the `vector` operator isn't recognized.
    await db.$queryRaw`
      SELECT 1 FROM "DocumentChunk" WHERE embedding IS NOT NULL LIMIT 1
    `;
    _vectorAvailableCache = true;
  } catch {
    _vectorAvailableCache = false;
    console.warn(
      "[rag/retrieve] vector search unavailable — falling back to text search. " +
        "(This is expected on SQLite dev or Postgres without pgvector setup.)",
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
  document_id: string | null;
  transcript_id: string | null;
  source_type: string;
  page_number: number | null;
  chunk_index: number;
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
      const rows = (await db.$queryRaw`
        SELECT
          dc.id,
          dc.content,
          dc.document_id,
          dc.transcript_id,
          dc.source_type,
          dc.page_number,
          dc.chunk_index,
          (1 - (dc.embedding <=> ${literal}::vector))::float AS similarity
        FROM "DocumentChunk" dc
        WHERE dc.organization_id = ${organizationId}
          AND dc.matter_id = ${matterId}
          AND dc.embedding IS NOT NULL
        ORDER BY dc.embedding <=> ${literal}::vector
        LIMIT ${limit}
      `) as RawMatterRow[];

      // Hydrate document names for citation building.
      const docIds = Array.from(
        new Set(rows.map((r) => r.document_id).filter(Boolean) as string[]),
      );
      const docNameMap = await hydrateDocumentNames(docIds);

      return rows.map((r) => ({
        chunkId: r.id,
        type: r.source_type === "transcript" ? "transcript" : "document",
        documentId: r.document_id ?? undefined,
        documentName: r.document_id ? docNameMap.get(r.document_id) : undefined,
        transcriptId: r.transcript_id ?? undefined,
        pageNumber: r.page_number ?? undefined,
        chunkIndex: r.chunk_index,
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
  law_name: string;
  law_type: string;
  article_number: string;
  title: string | null;
  content: string;
  year: number | null;
  source_url: string | null;
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
      const rows = (await db.$queryRaw`
        SELECT
          lc.id,
          lc.law_name,
          lc.law_type,
          lc.article_number,
          lc.title,
          lc.content,
          lc.year,
          lc.source_url,
          (1 - (lc.embedding <=> ${literal}::vector))::float AS similarity
        FROM "LegalCorpus" lc
        WHERE lc.embedding IS NOT NULL
        ORDER BY lc.embedding <=> ${literal}::vector
        LIMIT ${limit}
      `) as RawCorpusRow[];

      return rows.map((r) => ({
        chunkId: r.id,
        type: "statute" as const,
        lawName: r.law_name,
        lawType: r.law_type,
        articleNumber: r.article_number,
        title: r.title ?? undefined,
        content: r.content,
        year: r.year ?? undefined,
        sourceUrl: r.source_url ?? undefined,
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
