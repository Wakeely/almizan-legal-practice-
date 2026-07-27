// =============================================================================
// Al Mizan Legal Practice — server-side Gemini client
// -----------------------------------------------------------------------------
// SECURITY (per master system prompt rule #5):
// - All Gemini calls happen server-side only. The API key NEVER reaches the
//   browser.
// - The key is read from process.env.GEMINI_API_KEY. If empty, calls return
//   a friendly stub response (with an `_stub: true` flag) so the UI still
//   works during local dev without a key.
// - Every call must be wrapped with aiRateLimit() + audit logging by the
//   calling route.
// =============================================================================

import ZAI from "z-ai-web-dev-sdk";

let _client: any = null;

function getClient(): any | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!_client) {
    try {
      _client = ZAI();
    } catch (err) {
      console.error("[gemini] failed to init z-ai-web-dev-sdk:", err);
      return null;
    }
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

/**
 * Calls Gemini with a single prompt + optional system instruction.
 * Returns { text, _stub: true } if no API key is configured.
 */
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

  try {
    const messages: GeminiMessage[] = [];
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }
    messages.push({ role: "user", content: prompt });

    const res = await client.chat.completions.create({
      messages,
      temperature: 0.4,
      max_tokens: 2048,
    });

    const text = res.choices?.[0]?.message?.content ?? "";
    return { text, _stub: false };
  } catch (err: any) {
    console.error("[gemini] call failed:", err?.message ?? err);
    return {
      text: `[AI ERROR] ${err?.message ?? "Unknown error"}`,
      _stub: true,
    };
  }
}
