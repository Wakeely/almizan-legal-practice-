// =============================================================================
// Al Mizan — BYOK dispatcher
// -----------------------------------------------------------------------------
// Central entry point for all AI text-generation calls. Resolves the org's
// preferred provider + key (see ai-keys.ts) and dispatches to the correct
// provider lib. Every AI route / agent that needs BYOK should go through
// `dispatchAiText()` instead of calling callGemini/callOpenAI/callXai directly.
//
//   - Org key present  → uses it (source: "org").
//   - No org key       → platform env key (source: "platform").
//   - No key at all    → the provider lib returns its normal stub, so the
//                        feature still degrades gracefully (never crashes).
//
// Tool-enabled calls (Jordanian law MCP) only run on Gemini. For OpenAI/xAI
// we fall back to a plain text call — the app still works, just without the
// extra grounding tools.
// =============================================================================

import "server-only";
import { resolveAiKey, defaultModelForProvider } from "@/lib/ai-keys";
import { callGemini, callGeminiWithTools, type GeminiWithToolsResult } from "@/lib/gemini";
import { callOpenAI } from "@/lib/openai";
import { callXai } from "@/lib/xai";
import { logAiUsage } from "@/lib/ai-usage";
import type { AiProvider, AiKeySource } from "@/lib/types";

export interface DispatchOptions {
  /** The tenant whose key (if any) should be used. */
  organizationId: string;
  prompt: string;
  systemInstruction?: string;
  /** Use tool-enabled calls (Jordanian law MCP). Only honored for Gemini. */
  tools?: boolean;
  /** The tenant user who triggered the call (for AI usage logging). */
  userId?: string;
  /** Route or feature label for AI usage logging (e.g. 'ai.summarize'). */
  feature?: string;
}

export interface DispatchResult {
  text: string;
  _stub: boolean;
  _provider: AiProvider | "groq";
  _keySource: AiKeySource;
  _toolCalls?: Array<{ name: string; args: Record<string, unknown>; success: boolean }>;
}

/**
 * Resolve the org's AI key and dispatch the prompt to the correct provider.
 * Throws only on programming errors — provider failures are surfaced through
 * the result shape (_stub) exactly as the existing libs do.
 */
export async function dispatchAiText(opts: DispatchOptions): Promise<DispatchResult> {
  const resolved = await resolveAiKey(opts.organizationId);
  const apiKey = resolved?.apiKey;
  const keySource: AiKeySource = resolved?.keySource ?? "platform";
  const provider = resolved?.provider ?? "gemini";
  const model = defaultModelForProvider(provider);

  let result: DispatchResult;
  switch (resolved?.provider) {
    case "openai": {
      const r = await callOpenAI(opts.prompt, opts.systemInstruction, {
        apiKey,
        keySource,
        model: undefined,
      });
      result = { text: r.text, _stub: r._stub, _provider: "openai", _keySource: r._keySource ?? keySource };
      break;
    }
    case "xai": {
      const r = await callXai(opts.prompt, opts.systemInstruction, {
        apiKey,
        keySource,
      });
      result = { text: r.text, _stub: r._stub, _provider: "xai", _keySource: r._keySource ?? keySource };
      break;
    }
    case "gemini":
    default: {
      // Gemini path — honors tool calls when requested. When the org has no
      // gemini key, callGemini falls back to the platform GEMINI_API_KEY and
      // then to OpenAI/Groq, exactly as before.
      const r = opts.tools
        ? await callGeminiWithTools(opts.prompt, opts.systemInstruction, {
            apiKey,
            keySource,
          })
        : await callGemini(opts.prompt, opts.systemInstruction, {
            apiKey,
            keySource,
          });
      result = {
        text: r.text,
        _stub: r._stub,
        _provider: (r._provider as DispatchResult["_provider"]) ?? "gemini",
        _keySource: r._keySource ?? keySource,
        _toolCalls: (r as GeminiWithToolsResult)._toolCalls,
      };
      break;
    }
  }

  // ── AI usage logging (Phase 2 §2.4) ─────────────────────────────────────
  // Best-effort, fire-and-forget. Never blocks the response. The actual model
  // that answered may differ from the resolved provider (Gemini falls back to
  // OpenAI/Groq internally) — we log the resolved provider + its default
  // model as a reasonable approximation. Stub calls (no real provider) are
  // logged with stub=true and $0 cost.
  void logAiUsage({
    organizationId: opts.organizationId,
    userId: opts.userId,
    provider: result._provider,
    model,
    feature: opts.feature,
    promptText: opts.prompt,
    outputText: result.text,
    keySource: result._keySource ?? keySource,
    stub: result._stub,
  }).catch(() => {});

  return result;
}

// Re-exported for callers that want the resolved key for status/UI purposes.
export { resolveAiKey } from "@/lib/ai-keys";
export type { ResolvedAiKey } from "@/lib/types";
