// =============================================================================
// Al Mizan — OpenAI text generation helper (fallback when Gemini quota is hit)
// -----------------------------------------------------------------------------
// Same return shape as src/lib/gemini.ts (GeminiResult) so the caller doesn't
// need to know which provider answered. Used as an automatic fallback: if all
// Gemini models fail (quota exhausted, model deprecated for new keys), the
// request is retried against OpenAI GPT-4o-mini.
//
// SERVER-SIDE ONLY — the OPENAI_API_KEY must never reach the browser bundle.
// It's read from process.env exactly like GEMINI_API_KEY.
//
// Cost: GPT-4o-mini is ~$0.15 per million input tokens + ~$0.60 per million
// output tokens. A typical legal RAG answer (~2000 input + ~500 output tokens)
// costs roughly $0.0006 — less than a tenth of a cent per query. The $5 free
// credit new OpenAI accounts get covers ~8000 queries.
// =============================================================================

import OpenAI from "openai";

let _client: OpenAI | null = null;

function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (!_client) {
    _client = new OpenAI({ apiKey: key });
  }
  return _client;
}

/** True when an OpenAI key is configured (UI uses this for status hints). */
export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export interface OpenAIResult {
  text: string;
  _stub: boolean;
  _provider: "openai";
}

// The primary OpenAI model. GPT-4o-mini is the cheapest production-quality
// model — it's fast, handles Arabic well, and follows structured prompts
// reliably. Overridable via OPENAI_MODEL env var.
const PRIMARY_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Fallback models (cheapest first). Each is a separate product with its own
// rate limits.
const FALLBACK_MODELS = ["gpt-4o-mini", "gpt-4o"];

/**
 * Generate text via OpenAI. Same calling convention as callGemini: takes a
 * prompt + optional system instruction, returns { text, _stub }.
 *
 * If the OPENAI_API_KEY is missing, returns a stub explaining the situation.
 * If the API call fails, returns the error message in the text field (same
 * pattern as callGemini).
 */
export async function callOpenAI(
  prompt: string,
  systemInstruction?: string,
): Promise<OpenAIResult> {
  const client = getClient();
  if (!client) {
    return {
      text:
        "[AI DISABLED — OPENAI_API_KEY not set on server]\n\n" +
        "This is a stub response. Set the OPENAI_API_KEY environment variable " +
        "on your Vercel project to enable OpenAI as a fallback provider.\n\n" +
        "Your prompt was:\n" +
        prompt.slice(0, 500),
      _stub: true,
      _provider: "openai",
    };
  }

  const modelsToTry = Array.from(new Set([PRIMARY_MODEL, ...FALLBACK_MODELS]));
  const failures: Array<{ model: string; error: string }> = [];

  for (const model of modelsToTry) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [
          ...(systemInstruction
            ? [{ role: "system" as const, content: systemInstruction }]
            : []),
          { role: "user" as const, content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 2048,
      });

      const text = completion.choices[0]?.message?.content ?? "";
      if (!text) {
        throw new Error("Empty response from OpenAI");
      }
      return { text, _stub: false, _provider: "openai" };
    } catch (err: any) {
      const errSummary = summarizeError(err);
      failures.push({ model, error: errSummary });
      console.error(`[openai] ${model} failed:`, errSummary);

      // Retry on rate-limit (429) or model-not-found; fail fast on auth errors.
      const msg = errSummary.toLowerCase();
      const retryable =
        msg.includes("429") ||
        msg.includes("rate limit") ||
        msg.includes("quota") ||
        msg.includes("does not exist") ||
        msg.includes("not found") ||
        msg.includes("model_not_found");
      if (retryable && model !== modelsToTry[modelsToTry.length - 1]) {
        console.warn(`[openai] ${model} failed, trying next fallback model...`);
        continue;
      }
      break;
    }
  }

  // All models failed — return transparent error.
  const report = failures.map((f) => `• ${f.model}: ${f.error}`).join("\n");
  return {
    text:
      "[OpenAI ERROR] All OpenAI models failed:\n\n" +
      report +
      "\n\nCheck that OPENAI_API_KEY is valid and has credit at " +
      "https://platform.openai.com/usage.",
    _stub: true,
    _provider: "openai",
  };
}

function summarizeError(err: any): string {
  // OpenAI SDK errors have a structured shape: err.error.message
  const msg = err?.error?.message ?? err?.message ?? String(err);
  return msg.substring(0, 300);
}
