import { GoogleGenAI } from "@google/genai";

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: key });
  }
  return _client;
}

export interface GeminiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GeminiResult {
  text: string;
  _stub: boolean;
}

// The primary text-generation model. Overridable via GEMINI_TEXT_MODEL env var
// so you can switch without a code change. Default is gemini-2.0-flash-lite
// which has separate (and higher) free-tier quotas than gemini-2.0-flash.
const PRIMARY_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.0-flash-lite";

// Fallback models tried in order if the primary hits a quota/error. Each has
// its own free-tier quota bucket, so if one is exhausted the next may work.
const FALLBACK_MODELS = [
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
];

/**
 * Check if an error is a quota/resource-exhausted error (429). We use this to
 * decide whether to try the next fallback model.
 */
function isQuotaError(err: any): boolean {
  const msg = err?.message ?? String(err);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota") ||
    msg.includes("rate limit")
  );
}

export async function callGemini(
  prompt: string,
  systemInstruction?: string,
): Promise<GeminiResult> {
  const client = getClient();
  if (!client) {
    return {
      text:
        "[AI DISABLED — GEMINI_API_KEY not set on server]\n\nThis is a stub response. Set the GEMINI_API_KEY environment variable on your Vercel project to enable real AI generation.\n\nYour prompt was:\n" +
        prompt.slice(0, 500),
      _stub: true,
    };
  }

  // Build the ordered list of models to try: primary first, then fallbacks
  // (deduplicated, excluding the primary if it's already in the list).
  const modelsToTry = Array.from(new Set([PRIMARY_MODEL, ...FALLBACK_MODELS]));

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const result = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction ?? undefined,
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      });

      const text = result.text ?? "";
      return { text, _stub: false };
    } catch (err: any) {
      lastError = err;
      console.error(`[gemini] ${model} failed:`, err?.message?.substring(0, 200) ?? err);

      // If it's a quota error, try the next model. For other errors (auth,
      // invalid request, etc.), there's no point retrying — fail immediately.
      if (isQuotaError(err) && model !== modelsToTry[modelsToTry.length - 1]) {
        console.warn(`[gemini] ${model} hit quota limit, trying next fallback model...`);
        continue;
      }
      break;
    }
  }

  // All models failed — return the last error to the user.
  const errMsg = lastError?.message ?? "Unknown error";

  // If it's a quota error, give the user actionable advice.
  if (isQuotaError(lastError)) {
    return {
      text:
        "⏳ Gemini free-tier quota exhausted for today. Options:\n\n" +
        "1. Wait for the quota to reset (usually midnight Pacific time).\n" +
        "2. Enable billing on your Google AI Studio account (https://aistudio.google.com/app/apikey) — paid tier has much higher limits.\n" +
        "3. Set GEMINI_TEXT_MODEL env var to a different model with available quota.\n\n" +
        "Note: RAG retrieval still works — the issue is only with the final answer-generation step.",
      _stub: true,
    };
  }

  return {
    text: `[AI ERROR] ${errMsg}`,
    _stub: true,
  };
}
