// =============================================================================
// Al Mizan — Case Investigation Agent — LLM service (THIN WRAPPER)
// -----------------------------------------------------------------------------
// The ONLY way the investigation agents call the LLM. Wraps the existing
// src/lib/gemini.ts (which itself has a Gemini → OpenAI → Groq fallback chain),
// so the investigation pipeline inherits the same resilience as the rest of
// the app for free.
//
// WHY A WRAPPER?
//   1. The investigation agents always want STRUCTURED JSON output, not free
//      text. This wrapper centralises the JSON-parse + sanitise logic so each
//      agent doesn't reinvent it.
//   2. It surfaces a typed `LlmCallResult` so agents can branch on _stub /
//      _provider without poking at strings.
//   3. It enforces the product rule: when GEMINI_API_KEY is unset, agents get
//      a clean `_stub: true` result and can degrade gracefully (e.g. intake
//      returns an empty extraction with a note, citation-verify marks every
//      citation as 'unverifiable') instead of crashing.
//
// WHAT THIS FILE DOES NOT DO:
//   - It does NOT call a different model than the rest of the app.
//   - It does NOT add a second API key or a second billing path.
//   - It does NOT do retrieval (that's rag-service.ts) or persistence
//     (that's the orchestrator's job).
// =============================================================================

import { callGemini } from "@/lib/gemini";

export interface LlmCallResult<T> {
  /** Parsed JSON object when the model returned valid JSON, else null. */
  data: T | null;
  /** Raw model text (for debugging / audit trace). */
  raw: string;
  /** True when GEMINI_API_KEY was unset or all providers failed. */
  _stub: boolean;
  /** Provider that produced the answer (for the audit trace). */
  _provider?: "gemini" | "openai" | "groq";
  /** Error message when parsing failed (data will be null in that case). */
  parseError?: string;
}

/**
 * Call the LLM with a strict "return JSON only" instruction and parse the
 * result. Strips accidental markdown fences before JSON.parse.
 *
 * If the model call fails entirely (no key, all providers down), returns
 * { data: null, _stub: true }. The caller decides how to degrade.
 *
 * @param systemInstruction  The system prompt. Should include the JSON schema.
 * @param userPrompt         The user prompt. Should include the actual input.
 * @param schemaName         A short label for the audit trace (e.g. "intake").
 */
export async function callLlmForJson<T>(
  systemInstruction: string,
  userPrompt: string,
  schemaName: string,
): Promise<LlmCallResult<T>> {
  const result = await callGemini(userPrompt, systemInstruction);

  if (result._stub) {
    // Stub mode — no LLM answer available. Return cleanly.
    return {
      data: null,
      raw: result.text,
      _stub: true,
      _provider: result._provider,
    };
  }

  // Try to parse the model output as JSON. Strip markdown fences first.
  const cleaned = result.text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    const data = JSON.parse(cleaned) as T;
    return {
      data,
      raw: result.text,
      _stub: false,
      _provider: result._provider,
    };
  } catch (err: any) {
    return {
      data: null,
      raw: result.text,
      _stub: false,
      _provider: result._provider,
      parseError: `JSON parse failed for ${schemaName}: ${err?.message ?? String(err)}`,
    };
  }
}

/** True when the LLM stack is configured (key present). */
export function isLlmConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
