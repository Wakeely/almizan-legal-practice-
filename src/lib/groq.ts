// =============================================================================
// Al Mizan — Groq text generation helper (free fallback, no credit card needed)
// -----------------------------------------------------------------------------
// Groq offers a GENUINELY FREE API with no credit card required:
//   - Llama 3.3 70B: 14,000 requests/day free
//   - Mixtral 8x7B: 30 requests/minute free
//   - Gemma 2 9B: 30 requests/minute free
//
// This is the best option for users who can't enable billing on Google or
// OpenAI. The Groq API is OpenAI-compatible, so we reuse the OpenAI SDK with
// a different baseURL.
//
// Get a free key: https://console.groq.com/keys
//
// SERVER-SIDE ONLY — the GROQ_API_KEY must never reach the browser bundle.
// =============================================================================

import OpenAI from "openai";

let _client: OpenAI | null = null;

function getClient(): OpenAI | null {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  if (!_client) {
    // Groq's API is OpenAI-compatible — same SDK, different base URL.
    _client = new OpenAI({
      apiKey: key,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return _client;
}

/** True when a Groq key is configured. */
export function isGroqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

export interface GroqResult {
  text: string;
  _stub: boolean;
  _provider: "groq";
}

// Llama 3.3 70B is the best free model on Groq — high quality, handles Arabic
// well, follows structured prompts reliably. 14,000 requests/day free tier.
const PRIMARY_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// Fallback models on Groq (each has separate rate limits):
// - llama-3.1-8b-instant: faster, lower quality, 30 req/min
// - mixtral-8x7b-32768: good quality, 30 req/min
// - gemma2-9b-it: decent, 30 req/min
const FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "gemma2-9b-it",
];

/**
 * Generate text via Groq. Same calling convention as callGemini/callOpenAI.
 */
export async function callGroq(
  prompt: string,
  systemInstruction?: string,
): Promise<GroqResult> {
  const client = getClient();
  if (!client) {
    return {
      text:
        "[AI DISABLED — GROQ_API_KEY not set on server]\n\n" +
        "This is a stub response. Set the GROQ_API_KEY environment variable " +
        "(free key from https://console.groq.com/keys) to enable Groq as a " +
        "fallback provider.\n\nYour prompt was:\n" +
        prompt.slice(0, 500),
      _stub: true,
      _provider: "groq",
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
        throw new Error("Empty response from Groq");
      }
      return { text, _stub: false, _provider: "groq" };
    } catch (err: any) {
      const errSummary = summarizeError(err);
      failures.push({ model, error: errSummary });
      console.error(`[groq] ${model} failed:`, errSummary);

      const msg = errSummary.toLowerCase();
      const retryable =
        msg.includes("429") ||
        msg.includes("rate limit") ||
        msg.includes("quota") ||
        msg.includes("does not exist") ||
        msg.includes("not found") ||
        msg.includes("model_not_found") ||
        msg.includes("decommissioned");
      if (retryable && model !== modelsToTry[modelsToTry.length - 1]) {
        console.warn(`[groq] ${model} failed, trying next fallback model...`);
        continue;
      }
      break;
    }
  }

  const report = failures.map((f) => `• ${f.model}: ${f.error}`).join("\n");
  return {
    text:
      "[Groq ERROR] All Groq models failed:\n\n" +
      report +
      "\n\nGet a free key at https://console.groq.com/keys",
    _stub: true,
    _provider: "groq",
  };
}

function summarizeError(err: any): string {
  const msg = err?.error?.message ?? err?.message ?? String(err);
  return msg.substring(0, 300);
}
