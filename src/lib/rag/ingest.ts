// =============================================================================
// Al Mizan — RAG ingest pipeline
// -----------------------------------------------------------------------------
// Takes a document's text or a transcript's pages, chunks them, embeds each
// chunk via Gemini, and writes rows to DocumentChunk. Embeddings are written
// via raw SQL because Prisma cannot write Unsupported("vector") columns.
//
// CRITICAL SECURITY: every chunk row carries organizationId + matterId. These
// are mandatory filters in match_document_chunks() — there is no API path
// that retrieves cross-org chunks.
//
// DEV (SQLite): embeddings are skipped (the column doesn't exist). Chunks are
// still inserted with their text content, so text-search fallback in
// retrieve.ts can still find them.
// =============================================================================

import { db } from "@/lib/db";
import { chunkText, chunkTranscriptPages } from "./chunk";
import { generateEmbeddings, toVectorLiteral } from "./embed";
import type { IngestDocumentInput, IngestTranscriptInput } from "./types";

export interface IngestResult {
  chunksCreated: number;
  embeddingsWritten: number;
  embeddingSkipped: boolean;
}

/**
 * Ingest a document: delete existing chunks for this document, re-chunk,
 * embed, and insert. Idempotent — safe to call on every document update.
 */
export async function ingestDocument(
  input: IngestDocumentInput,
): Promise<IngestResult> {
  // 1. Delete existing chunks for this document (org-scoped delete for safety).
  await db.documentChunk.deleteMany({
    where: {
      organizationId: input.organizationId,
      documentId: input.documentId,
    },
  });

  // 2. Chunk the text.
  const specs = chunkText(input.text);
  if (specs.length === 0) {
    return { chunksCreated: 0, embeddingsWritten: 0, embeddingSkipped: true };
  }

  // 3. Insert chunk rows (without embeddings — Prisma can't write vector).
  const created = await Promise.all(
    specs.map((spec) =>
      db.documentChunk.create({
        data: {
          organizationId: input.organizationId,
          matterId: input.matterId,
          documentId: input.documentId,
          sourceType: "document",
          chunkIndex: spec.chunkIndex,
          content: spec.content,
          tokenEstimate: spec.tokenEstimate ?? null,
        },
      }),
    ),
  );

  // 4. Embed all chunks in one batch, then write vectors via raw SQL.
  const embeddings = await generateEmbeddings(specs.map((s) => s.content));
  let written = 0;
  let skipped = false;

  for (let i = 0; i < created.length; i++) {
    const vec = embeddings[i];
    const literal = toVectorLiteral(vec);
    if (!literal) {
      skipped = true;
      continue;
    }
    try {
      await db.$executeRaw`
        UPDATE "DocumentChunk"
        SET embedding = ${literal}::vector
        WHERE id = ${created[i].id}
      `;
      written++;
    } catch (err: any) {
      // On SQLite dev the embedding column doesn't exist — this is expected.
      // Log once per ingest run and move on; the chunk row is still useful
      // for the text-search fallback.
      if (!skipped) {
        console.warn(
          "[rag/ingest] could not write embedding (likely SQLite dev):",
          err?.message ?? err,
        );
        skipped = true;
      }
    }
  }

  return {
    chunksCreated: created.length,
    embeddingsWritten: written,
    embeddingSkipped: skipped,
  };
}

/**
 * Ingest a deposition transcript: chunk by page (preserving page numbers as
 * citations), embed, and insert.
 */
export async function ingestTranscript(
  input: IngestTranscriptInput,
): Promise<IngestResult> {
  // 1. Delete existing chunks for this transcript.
  await db.documentChunk.deleteMany({
    where: {
      organizationId: input.organizationId,
      transcriptId: input.transcriptId,
    },
  });

  // 2. Chunk by page.
  const specs = chunkTranscriptPages(input.pages);
  if (specs.length === 0) {
    return { chunksCreated: 0, embeddingsWritten: 0, embeddingSkipped: true };
  }

  // 3. Insert chunk rows.
  const created = await Promise.all(
    specs.map((spec) =>
      db.documentChunk.create({
        data: {
          organizationId: input.organizationId,
          matterId: input.matterId,
          transcriptId: input.transcriptId,
          sourceType: "transcript",
          pageNumber: spec.pageNumber ?? null,
          chunkIndex: spec.chunkIndex,
          content: spec.content,
          tokenEstimate: spec.tokenEstimate ?? null,
        },
      }),
    ),
  );

  // 4. Embed + write vectors.
  const embeddings = await generateEmbeddings(specs.map((s) => s.content));
  let written = 0;
  let skipped = false;

  for (let i = 0; i < created.length; i++) {
    const vec = embeddings[i];
    const literal = toVectorLiteral(vec);
    if (!literal) {
      skipped = true;
      continue;
    }
    try {
      await db.$executeRaw`
        UPDATE "DocumentChunk"
        SET embedding = ${literal}::vector
        WHERE id = ${created[i].id}
      `;
      written++;
    } catch (err: any) {
      if (!skipped) {
        console.warn(
          "[rag/ingest] could not write transcript embedding (likely SQLite dev):",
          err?.message ?? err,
        );
        skipped = true;
      }
    }
  }

  return {
    chunksCreated: created.length,
    embeddingsWritten: written,
    embeddingSkipped: skipped,
  };
}

/**
 * Delete all chunks for a document (used on document soft-delete / hard-delete).
 * Org-scoped delete for defense in depth.
 */
export async function deleteDocumentChunks(
  organizationId: string,
  documentId: string,
): Promise<number> {
  const result = await db.documentChunk.deleteMany({
    where: { organizationId, documentId },
  });
  return result.count;
}

/**
 * Delete all chunks for a transcript.
 */
export async function deleteTranscriptChunks(
  organizationId: string,
  transcriptId: string,
): Promise<number> {
  const result = await db.documentChunk.deleteMany({
    where: { organizationId, transcriptId },
  });
  return result.count;
}

/**
 * Extract plain text from a document's raw bytes. Best-effort — supports the
 * common text-bearing MIME types. For PDF/DOCX we'd want a real parser; for
 * now we extract text from text/*, CSV, and treat binary formats as empty
 * (the lawyer can still ask questions about the document NAME + AI summary,
 * both of which are chunked separately if you call ingestDocument with a
 * constructed text from metadata).
 *
 * This is intentionally minimal — extending it to PDF/DOCX is a Phase R5+ task
 * and should use a server-side library like pdf-parse or mammoth.
 */
export function extractTextFromFile(
  bytes: Uint8Array,
  mimeType: string | null,
): string {
  if (!mimeType) return "";
  const isText =
    mimeType.startsWith("text/") ||
    mimeType === "application/csv" ||
    mimeType === "application/json";
  if (!isText) return "";
  try {
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

/**
 * Build a synthetic "metadata text" for a document when we don't have the
 * file's actual text content (e.g. PDF we can't parse yet). This still lets
 * the matter be searchable by name + category + AI summary + tags.
 */
export function buildDocumentMetadataText(opts: {
  name: string;
  category: string;
  aiSummary?: string | null;
  aiTags?: string[];
}): string {
  const parts: string[] = [];
  parts.push(`Document: ${opts.name}`);
  parts.push(`Category: ${opts.category}`);
  if (opts.aiSummary) parts.push(`Summary: ${opts.aiSummary}`);
  if (opts.aiTags && opts.aiTags.length > 0) {
    parts.push(`Tags: ${opts.aiTags.join(", ")}`);
  }
  return parts.join("\n");
}
