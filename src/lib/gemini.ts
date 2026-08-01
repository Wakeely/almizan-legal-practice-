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
// so you can switch without a code change. Default is gemini-2.5-flash-lite
// — the newest lite model, which has the most generous free-tier quota for
// newly-created API keys. Older models like gemini-2.0-flash may be
// quota-exhausted or restricted for new keys.
const PRIMARY_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash-lite";

// Fallback models tried in order if the primary hits a quota/error. Each has
// its own free-tier quota bucket. Listed newest-first because newer models
// tend to have more generous quotas for newly-created keys.
// NOTE: gemini-1.5-flash is deprecated (404). gemini-2.5-flash may show
// "no longer available to new users" for recently-created keys — we still
// try it as a fallback because it works for older keys.
const FALLBACK_MODELS = [
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

/**
 * Check if an error is retryable (worth trying the next fallback model).
 * This includes quota errors (429) AND model-not-found errors (404), since
 * a deprecated model name shouldn't stop us from trying the next one.
 */
function isRetryableError(err: any): boolean {
  const msg = err?.message ?? String(err);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("404") ||
    msg.includes("NOT_FOUND") ||
    msg.includes("is not found for API version") ||
    msg.includes("is not supported for") ||
    msg.includes("no longer available") ||
    msg.includes("deprecated")
  );
}

/** Quota-specific check — used to decide which user-facing message to show. */
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

  const failures: Array<{ model: string; error: string }> = [];
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
      const errSummary = summarizeError(err);
      failures.push({ model, error: errSummary });
      console.error(`[gemini] ${model} failed:`, errSummary);

      // If it's a retryable error (quota OR model-not-found), try the next
      // model. For other errors (auth, invalid request), fail immediately.
      if (isRetryableError(err) && model !== modelsToTry[modelsToTry.length - 1]) {
        console.warn(`[gemini] ${model} failed, trying next fallback model...`);
        continue;
      }
      break;
    }
  }

  // All models failed — build a transparent error report showing exactly
  // which models were tried and why each failed. This makes it obvious if
  // the issue is a stale API key (would show "API key not valid"), a real
  // quota issue (shows "quota exceeded"), or a model availability issue.
  const report = failures
    .map((f) => `• ${f.model}: ${f.error}`)
    .join("\n");

  const isAllQuota = failures.every((f) =>
    f.error.includes("429") ||
    f.error.includes("RESOURCE_EXHAUSTED") ||
    f.error.includes("quota")
  );

  if (isAllQuota) {
    return {
      text:
        "⏳ All Gemini text models hit their free-tier quota limit.\n\n" +
        "Models tried:\n" + report + "\n\n" +
        "Options:\n" +
        "1. Wait for quota reset (midnight Pacific time).\n" +
        "2. Enable billing at https://aistudio.google.com — paid tier has much higher limits.\n" +
        "3. Use a different Google account's API key.\n\n" +
        "Note: RAG retrieval still works — only the final answer text is blocked.",
      _stub: true,
    };
  }

  // Non-quota error (invalid key, model not found, etc.) — show the raw error
  // so the user can diagnose it. This is critical for debugging: if the user
  // changed their API key but didn't redeploy, they'll see "API key not valid"
  // here, which tells them exactly what's wrong.
  return {
    text:
      "[AI ERROR] All text-generation models failed:\n\n" +
      report +
      "\n\nIf you recently changed GEMINI_API_KEY, make sure you REDEPLOYED on Vercel " +
      "(env vars only apply on the next deploy). If the error says 'API key not valid', " +
      "the new key isn't active yet.",
    _stub: true,
  };
}

/**
 * Extract a short, human-readable error message from a Gemini SDK error.
 * The SDK wraps errors in a way that can hide the actual message — we dig
 * it out so the user can see exactly what went wrong.
 */
function summarizeError(err: any): string {
  const raw = err?.message ?? String(err);
  // Try to parse the JSON error body if present (Gemini returns errors as
  // JSON strings inside the message field).
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) {
      return parsed.error.message.substring(0, 300);
    }
    if (parsed?.error?.code) {
      return `code ${parsed.error.code}: ${parsed.error.status ?? "error"}`;
    }
  } catch {
    // Not JSON — use the raw message.
  }
  return raw.substring(0, 300);
}
