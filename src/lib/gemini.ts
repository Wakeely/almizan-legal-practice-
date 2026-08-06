import { GoogleGenAI } from "@google/genai";
import { callOpenAI } from "@/lib/openai";
import { callGroq } from "@/lib/groq";
import {
  getAvailableLawTools,
  executeJordanianLawTool,
  extractFunctionCall,
} from "@/lib/mcp/gemini-tools";

let _client: GoogleGenAI | null = null;

function getClient(apiKey?: string): GoogleGenAI | null {
  const key = apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) return null;
  // A caller-supplied org key always gets a fresh client (never reuse the
  // platform singleton, which could hold a different key).
  if (apiKey) return new GoogleGenAI({ apiKey: key });
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: key });
  }
  return _client;
}

/** Options for a single Gemini call — allows supplying an org (BYOK) key. */
export interface AiCallOpts {
  /** Per-call API key (an organization's own key). Falls back to platform key when omitted. */
  apiKey?: string;
  /** Where the key came from, surfaced on the result for status/debugging. */
  keySource?: "org" | "platform";
  /** Override the primary model for this call. */
  model?: string;
}

export interface GeminiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GeminiResult {
  text: string;
  _stub: boolean;
  /** Set when the answer came from a fallback provider (for debugging). */
  _provider?: "gemini" | "openai" | "groq" | "xai";
  /** Whether this call used the org's own key or the platform key. */
  _keySource?: "org" | "platform";
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
  opts?: AiCallOpts,
): Promise<GeminiResult> {
  const client = getClient(opts?.apiKey);
  if (!client) {
    return {
      text:
        "[AI DISABLED — GEMINI_API_KEY not set on server]\n\nThis is a stub response. Set the GEMINI_API_KEY environment variable on your Vercel project to enable real AI generation.\n\nYour prompt was:\n" +
        prompt.slice(0, 500),
      _stub: true,
      _keySource: opts?.keySource,
    };
  }

  // Build the ordered list of models to try: primary first, then fallbacks
  // (deduplicated, excluding the primary if it's already in the list).
  const primaryModel = opts?.model ?? PRIMARY_MODEL;
  const modelsToTry = Array.from(new Set([primaryModel, ...FALLBACK_MODELS]));

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
      return { text, _stub: false, _keySource: opts?.keySource };
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

  // All Gemini models failed. Try fallback providers in order: OpenAI → Groq.
  // As long as ANY provider has available quota, the RAG answer generates.
  if (process.env.OPENAI_API_KEY) {
    console.warn("[gemini] all Gemini models failed, falling back to OpenAI...");
    const openaiResult = await callOpenAI(prompt, systemInstruction, { keySource: opts?.keySource });
    if (!openaiResult._stub) {
      return {
        text: openaiResult.text,
        _stub: false,
        _provider: "openai",
        _keySource: opts?.keySource,
      };
    }
    // OpenAI also failed (e.g. no credits) — fall through to Groq.
    console.warn("[gemini] OpenAI also failed, trying Groq...");
  }

  if (process.env.GROQ_API_KEY) {
    console.warn("[gemini] falling back to Groq (free)...");
    const groqResult = await callGroq(prompt, systemInstruction);
    return {
      text: groqResult.text,
      _stub: groqResult._stub,
      _provider: "groq",
      _keySource: opts?.keySource,
    };
  }

  // No OpenAI fallback available — return the transparent Gemini error.
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
        "3. Set OPENAI_API_KEY as a fallback provider (see README).\n\n" +
        "Note: RAG retrieval still works — only the final answer text is blocked.",
      _stub: true,
      _provider: "gemini",
      _keySource: opts?.keySource,
    };
  }

  return {
    text:
      "[AI ERROR] All Gemini models failed:\n\n" +
      report +
      "\n\nIf you recently changed GEMINI_API_KEY, make sure you REDEPLOYED on Vercel " +
      "(env vars only apply on the next deploy). To use OpenAI as a fallback, " +
      "set OPENAI_API_KEY in Vercel environment variables.",
    _stub: true,
    _provider: "gemini",
    _keySource: opts?.keySource,
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

// =============================================================================
// callGeminiWithTools — function-calling loop with MCP integration
// -----------------------------------------------------------------------------
// This is the enhanced Gemini caller that supports function calling. When
// the model requests a tool (e.g. search_jordanian_legislation), the function
// is executed against the MCP adapter, and the result is fed back to the model
// in the next turn. Up to 5 rounds of tool-calling are supported.
//
// Falls back to plain callGemini() if:
//   - GEMINI_API_KEY is missing (stub mode)
//   - All Gemini models fail (tries OpenAI/Groq fallback without tools)
//
// Use this instead of callGemini() in AI routes that need grounded legal
// research (drafting, risk analysis, RAG answers).
// =============================================================================

export interface GeminiWithToolsResult extends GeminiResult {
  /** The tools that were called during this request (for audit/logging). */
  _toolCalls?: Array<{ name: string; args: Record<string, unknown>; success: boolean }>;
}

const MAX_TOOL_ROUNDS = 5;

export async function callGeminiWithTools(
  prompt: string,
  systemInstruction?: string,
  opts?: AiCallOpts,
): Promise<GeminiWithToolsResult> {
  const client = getClient(opts?.apiKey);
  if (!client) {
    // No key — fall back to stub mode via callGemini.
    return callGemini(prompt, systemInstruction, opts);
  }

  const model = opts?.model ?? PRIMARY_MODEL;
  const tools = getAvailableLawTools();
  const toolCallLog: GeminiWithToolsResult["_toolCalls"] = [];

  // The conversation starts with the user's prompt. Each tool round appends
  // the model's function call + our function response, then re-generates.
  let contents: any[] = [{ role: "user", parts: [{ text: prompt }] }];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    try {
      const result = await client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemInstruction ?? undefined,
          temperature: 0.4,
          maxOutputTokens: 2048,
          tools: [{ functionDeclarations: tools }],
        },
      });

      // Check if the model wants to call a function.
      const functionCall = extractFunctionCall(result);

      if (!functionCall) {
        // No function call — the model produced a final text answer.
        return {
          text: result.text ?? "",
          _stub: false,
          _provider: "gemini",
          _keySource: opts?.keySource,
          _toolCalls: toolCallLog,
        };
      }

      // Execute the requested tool.
      const toolResult = await executeJordanianLawTool(
        functionCall.name,
        functionCall.args,
      );

      toolCallLog!.push({
        name: functionCall.name,
        args: functionCall.args,
        success: !toolResult.includes('"error"'),
      });

      // Append the model's function call + our response to the conversation,
      // then loop to let the model generate the final answer with the tool data.
      contents.push({
        role: "model",
        parts: [{ functionCall: { name: functionCall.name, args: functionCall.args } }],
      });
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: functionCall.name, response: { result: toolResult } } }],
      });
    } catch (err: any) {
      // If Gemini fails mid-tool-loop, fall back to plain callGemini (which
      // handles the OpenAI/Groq fallback chain).
      console.warn("[gemini/tools] tool loop failed, falling back:", err?.message?.substring(0, 200));
      const fallback = await callGemini(prompt, systemInstruction, opts);
      return { ...fallback, _toolCalls: toolCallLog };
    }
  }

  // Exhausted tool rounds — return whatever the model last said, or a notice.
  return {
    text: "Legal research completed but the tool-call limit was reached. The answer above reflects the information retrieved.",
    _stub: true,
    _provider: "gemini",
    _keySource: opts?.keySource,
    _toolCalls: toolCallLog,
  };
}
