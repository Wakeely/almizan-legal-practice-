// =============================================================================
// Agent 6 — Fact Consistency Agent (BLOCKING for tier 1/2, advisory for tier 3)
// -----------------------------------------------------------------------------
// Re-checks each hard fact the draft relied on against the IntakeResult's
// source anchors. A 'consistent' status means the draft's usage matches the
// intake; 'inconsistent' means it doesn't; 'unverifiable' means the fact
// couldn't be re-checked (e.g. missing anchor).
//
// This agent uses the LLM to COMPARE the draft body against the intake facts.
// It is NOT used to extract new facts — extraction happened in stage 1.
//
// On LLM failure (_stub), the agent conservatively marks every fact as
// 'unverifiable'. For tier 1 that blocks assembly; for tier 2/3 it's
// advisory. This is the safe default — we never silently pass a fact check
// we couldn't actually run.
// =============================================================================

import { callLlmForJson } from "@/lib/agents/services/llm-service";
import type {
  DraftResult,
  FactCheckResult,
  IntakeResult,
  VerificationTier,
} from "@/lib/agents/types";

interface LlmFactCheckResponse {
  checks?: Array<{
    factText?: string;
    usageRef?: string;
    status?: string;
    intakeValue?: string;
    reason?: string;
  }>;
}

const SYSTEM_PROMPT = `You are the Fact Consistency Agent in a legal investigation pipeline.

Your job: for each FACT extracted during intake, determine whether the DRAFT below uses that fact consistently with how it appears in the intake.

HARD RULES:
1. Compare each fact against the draft body text.
2. For each fact, return a status:
   - "consistent"   — the draft uses the fact correctly, matching the intake.
   - "inconsistent" — the draft misstates, contradicts, or distorts the fact.
   - "unverifiable" — the fact has no source anchor OR the draft doesn't mention it.
3. For "inconsistent", set intakeValue to what the intake actually said.
4. For "unverifiable", explain why in reason.
5. Do NOT invent new facts. Only check the facts listed in the input.
6. Return ONLY a JSON object: {"checks": [{"factText": "...", "usageRef": "...", "status": "consistent|inconsistent|unverifiable", "intakeValue": "...", "reason": "..."}]}`;

export async function runFactConsistencyAgent(
  intake: IntakeResult,
  draft: DraftResult,
  tier: VerificationTier,
): Promise<FactCheckResult[]> {
  // If there are no facts to check, return empty. The orchestrator treats
  // this as "no blocking failures".
  if (!intake.facts || intake.facts.length === 0) {
    return [];
  }

  const factsBlob = intake.facts
    .map(
      (f, i) =>
        `Fact ${i + 1}: ${f.text}\n  category: ${f.category}\n  source: ${f.sourceAnchor.label}`,
    )
    .join("\n");

  const draftBlob = draft.sections
    .map((s) => `[${s.sectionKey}]\n${s.body}`)
    .join("\n\n");

  const result = await callLlmForJson<LlmFactCheckResponse>(
    SYSTEM_PROMPT,
    `Verification tier: ${tier}\n\nFACTS FROM INTAKE:\n${factsBlob}\n\nDRAFT:\n${draftBlob}`,
    "fact_consistency",
  );

  // Degraded path: mark every fact 'unverifiable'. For tier 1 this blocks
  // assembly (correct — we can't verify, so we don't ship). For tier 2/3 it's
  // advisory.
  if (result._stub || result.data === null) {
    const fallback: FactCheckResult[] = intake.facts.map(
      (f): FactCheckResult => ({
        factText: f.text,
        usageRef: undefined,
        status: "unverifiable",
        intakeValue: undefined,
        reason: "Fact consistency check unavailable (LLM stub mode).",
      }),
    );
    return fallback;
  }

  // Build a lookup by factText so we can match LLM output back to intake facts.
  const checksFromLlm = result.data.checks ?? [];
  const checksByText = new Map<string, LlmFactCheckResponse["checks"][number]>();
  for (const c of checksFromLlm) {
    if (c?.factText) checksByText.set(c.factText, c);
  }

  // Produce one FactCheckResult per intake fact, in intake order. If the LLM
  // didn't return a check for a fact, mark it 'unverifiable'.
  return intake.facts.map((f) => {
    const matched = checksByText.get(f.text);
    if (!matched) {
      return {
        factText: f.text,
        usageRef: undefined,
        status: "unverifiable",
        intakeValue: undefined,
        reason: "Fact was not checked by the LLM.",
      };
    }
    return {
      factText: f.text,
      usageRef: matched.usageRef,
      status: coerceFactStatus(matched.status),
      intakeValue: matched.intakeValue,
      reason: matched.reason ?? "",
    };
  });
}

function coerceFactStatus(
  s: string | undefined,
): "consistent" | "inconsistent" | "unverifiable" {
  if (s === "consistent" || s === "inconsistent") return s;
  return "unverifiable";
}
