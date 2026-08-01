// =============================================================================
// Al Mizan — Gemini text embedding helper (768-dim)
// -----------------------------------------------------------------------------
// Same key + client pattern as src/lib/gemini.ts. SERVER-SIDE ONLY — the
// GEMINI_API_KEY must never reach the browser bundle.
//
// Model: gemini-embedding-001 (768 dimensions default). This is the current
// production Gemini embedding model. The older 'text-embedding-004' was
// deprecated/removed and returns 404 "model not found" on some API versions.
//
// If the key is unset or the call fails, we return { values: null, error } and
// the caller decides whether to skip embedding (still insert the chunk row,
// just without a vector) or fail loudly. Ingest always inserts the row so
// re-embedding later is a matter of re-running the ingest endpoint, not
// re-uploading the document.
// =============================================================================

import { GoogleGenAI } from "@google/genai";

const EMBEDDING_MODEL = "gemini-embedding-001";
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
 * Returns { values } on success, or { values: null, error } on failure.
 * Callers should check .values and surface .error to the user if present.
 *
 * Input is truncated to ~8000 chars to stay within the model's token budget
 * and to keep latency reasonable. Chunking happens upstream in chunk.ts.
 */
export interface EmbeddingResult {
  values: number[] | null;
  error?: string;
}

export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const client = getClient();
  if (!client) {
    return { values: null, error: "GEMINI_API_KEY is not set on the server" };
  }

  const truncated = text.slice(0, 8000);
  if (!truncated.trim()) {
    return { values: null, error: "empty text" };
  }

  try {
    const result = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: truncated,
      config: {
        outputDimensionality: EMBEDDING_DIM,
      },
    });
    const values = result.embeddings?.[0]?.values;
    if (!values || values.length !== EMBEDDING_DIM) {
      const msg = `unexpected embedding length: got ${values?.length ?? 0}, expected ${EMBEDDING_DIM}`;
      console.error(`[rag/embed] ${msg}`);
      return { values: null, error: msg };
    }
    return { values };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error("[rag/embed] call failed:", msg);
    return { values: null, error: msg };
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
      config: {
        outputDimensionality: EMBEDDING_DIM,
      },
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
