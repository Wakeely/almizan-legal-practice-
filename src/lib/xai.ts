// =============================================================================
// Al Mizan — xAI / Grok text generation helper (Bring Your Own Key, BYOK)
// -----------------------------------------------------------------------------
// xAI's API is OpenAI-compatible, so we reuse the `openai` SDK pointed at
// https://api.x.ai/v1. Used when an organization supplies their own xAI/Grok
// key. Platform fallback uses XAI_API_KEY (or GROK_API_KEY) if configured.
//
// SERVER-SIDE ONLY — keys never reach the browser bundle.
// =============================================================================

import OpenAI from "openai";

const BASE_URL = "https://api.x.ai/v1";

// xAI model names. Latest first. Overridable via XAI_MODEL.
const FALLBACK_MODELS = ["grok-3", "grok-3-mini", "grok-2-latest"];

let _client: OpenAI | null = null;

function getClient(apiKey?: string): OpenAI | null {
  const key = apiKey ?? process.env.XAI_API_KEY ?? process.env.GROK_API_KEY;
  if (!key) return null;
  // A caller-supplied org key always gets a fresh client (never reuse the
  // platform singleton, which could hold a different key).
  if (apiKey) return new OpenAI({ apiKey, baseURL: BASE_URL });
  if (!_client) _client = new OpenAI({ apiKey: key, baseURL: BASE_URL });
  return _client;
}

/** True when an xAI key is configured (platform level). */
export function isXaiConfigured(): boolean {
  return !!(process.env.XAI_API_KEY || process.env.GROK_API_KEY);
}

export interface AiCallOpts {
  /** Per-call API key (an organization's own key). Falls back to platform key when omitted. */
  apiKey?: string;
  /** Where the key came from, surfaced on the result for status/debugging. */
  keySource?: "org" | "platform";
  /** Override the model for this call. */
  model?: string;
}

export interface XaiResult {
  text: string;
  _stub: boolean;
  _provider: "xai";
  _keySource?: "org" | "platform";
}

export async function callXai(
  prompt: string,
  systemInstruction?: string,
  opts?: AiCallOpts,
): Promise<XaiResult> {
  const client = getClient(opts?.apiKey);
  if (!client) {
    return {
      text:
        "[AI DISABLED — XAI_API_KEY not set on server]\n\n" +
        "This is a stub response. Set XAI_API_KEY on your Vercel project to enable xAI/Grok.\n\n" +
        "Your prompt was:\n" +
        prompt.slice(0, 500),
      _stub: true,
      _provider: "xai",
      _keySource: opts?.keySource,
    };
  }

  const primary = opts?.model ?? process.env.XAI_MODEL ?? FALLBACK_MODELS[0];
  const modelsToTry = Array.from(new Set([primary, ...FALLBACK_MODELS]));
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
      if (!text) throw new Error("Empty response from xAI");
      return { text, _stub: false, _provider: "xai", _keySource: opts?.keySource };
    } catch (err: any) {
      const errSummary = summarizeError(err);
      failures.push({ model, error: errSummary });
      console.error(`[xai] ${model} failed:`, errSummary);
      const msg = errSummary.toLowerCase();
      const retryable =
        msg.includes("429") ||
        msg.includes("rate limit") ||
        msg.includes("quota") ||
        msg.includes("not found") ||
        msg.includes("model_not_found");
      if (retryable && model !== modelsToTry[modelsToTry.length - 1]) {
        continue;
      }
      break;
    }
  }

  const report = failures.map((f) => `• ${f.model}: ${f.error}`).join("\n");
  return {
    text:
      "[xAI ERROR] All xAI models failed:\n\n" +
      report +
      "\n\nCheck that the key is valid at https://console.x.ai/.",
    _stub: true,
    _provider: "xai",
    _keySource: opts?.keySource,
  };
}

function summarizeError(err: any): string {
  const msg = err?.error?.message ?? err?.message ?? String(err);
  return msg.substring(0, 300);
}