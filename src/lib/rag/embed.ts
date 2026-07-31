// =============================================================================
// Al Mizan — Gemini text embedding helper (768-dim)
// -----------------------------------------------------------------------------
// Same key + client pattern as src/lib/gemini.ts. SERVER-SIDE ONLY — the
// GEMINI_API_KEY must never reach the browser bundle.
//
// Model: text-embedding-004 (768 dimensions). This matches the Almoostashar
// reference pattern and is the dimension declared in the pgvector columns.
//
// If the key is unset or the call fails, we return null and the caller decides
// whether to skip embedding (still insert the chunk row, just without a vector)
// or fail loudly. Ingest always inserts the row so re-embedding later is a
// matter of re-running the ingest endpoint, not re-uploading the document.
// =============================================================================

import { GoogleGenAI } from "@google/genai";

const EMBEDDING_MODEL = "text-embedding-004";
export const EMBEDDING_DIM = 768;

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: key });
  }
  return _client;
}

/** True when the Gemini key is configured. UI uses this to show a hint. */
export function isEmbeddingConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Generate a single 768-dim embedding for a piece of text.
 * Returns null when the key is missing or the API call fails — callers handle
 * the null case (e.g. insert chunk without vector, or skip ingest).
 *
 * Input is truncated to ~8000 chars to stay within the model's token budget
 * and to keep latency reasonable. Chunking happens upstream in chunk.ts.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const client = getClient();
  if (!client) return null;

  const truncated = text.slice(0, 8000);
  if (!truncated.trim()) return null;

  try {
    const result = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: truncated,
    });
    const values = result.embeddings?.[0]?.values;
    if (!values || values.length !== EMBEDDING_DIM) {
      console.error(
        `[rag/embed] unexpected embedding length: got ${values?.length ?? 0}, expected ${EMBEDDING_DIM}`,
      );
      return null;
    }
    return values;
  } catch (err: any) {
    console.error("[rag/embed] call failed:", err?.message ?? err);
    return null;
  }
}

/**
 * Batch embedding — embeds multiple texts in one round-trip. The Gemini SDK
 * accepts an array of strings and returns parallel embeddings. Used by the
 * Jordan corpus seed script to keep latency down on a few hundred articles.
 *
 * Returns null array entries for inputs that failed (length matches input).
 */
export async function generateEmbeddings(
  texts: string[],
): Promise<(number[] | null)[]> {
  const client = getClient();
  if (!client) return texts.map((): null => null);

  if (texts.length === 0) return [];

  try {
    const result = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: texts.map((t) => t.slice(0, 8000)),
    });
    const embeddings = result.embeddings ?? [];
    return texts.map((_, i): number[] | null => {
      const values = embeddings[i]?.values;
      if (!values || values.length !== EMBEDDING_DIM) return null;
      return values;
    });
  } catch (err: any) {
    console.error("[rag/embed] batch failed:", err?.message ?? err);
    return texts.map((): null => null);
  }
}

/**
 * Serialize an embedding to the Postgres vector literal form `[0.1,0.2,...]`.
 * Used when interpolating into raw SQL via db.$queryRaw`... ${vec}::vector`.
 */
export function toVectorLiteral(embedding: number[] | null): string | null {
  if (!embedding || embedding.length !== EMBEDDING_DIM) return null;
  return "[" + embedding.map((n) => Number(n).toFixed(7)).join(",") + "]";
}
