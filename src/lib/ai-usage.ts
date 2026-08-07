// =============================================================================
// Al Mizan — AI usage logging (Phase 2 §2.4)
// -----------------------------------------------------------------------------
// Lightweight per-call cost tracking. Written at the point where
// dispatchAiText() returns. Best-effort, async — never blocks the AI
// response (failures are logged, not thrown).
//
// Cost estimation (PRD v0.4 Open Question 2): rough token-count × per-model
// rate. Rates are configurable via env so they can be tuned without a code
// change. Defaults reflect public pricing as of mid-2026; exact reconciliation
// with provider invoices is out of scope for v1.
// =============================================================================

import "server-only";
import { db } from "@/lib/db";

// ── Per-model cost rates (USD per 1M tokens) ───────────────────────────────
// Input and output rates differ for most providers. Looked up by model name
// prefix. Configurable via env: AI_COST_RATES_JSON (a JSON object mapping
// model → { in, out } in USD per 1M tokens).
interface Rate { in: number; out: number; }

const DEFAULT_RATES: Record<string, Rate> = {
  // Gemini (Google AI Studio default-tier pricing)
  "gemini-2.5-flash-lite": { in: 0.075, out: 0.30 },
  "gemini-2.5-flash": { in: 0.15, out: 0.60 },
  "gemini-2.0-flash-lite": { in: 0.075, out: 0.30 },
  "gemini-2.0-flash": { in: 0.10, out: 0.40 },
  // OpenAI
  "gpt-4o-mini": { in: 0.15, out: 0.60 },
  "gpt-4o": { in: 2.50, out: 10.00 },
  // xAI / Grok
  "grok-3": { in: 3.00, out: 15.00 },
  "grok-3-mini": { in: 0.30, out: 0.90 },
  "grok-2-latest": { in: 2.00, out: 10.00 },
  // Groq (free tier — cost is $0 but we log the call)
  "llama-3.3-70b": { in: 0.59, out: 0.79 },
};

function loadRates(): Record<string, Rate> {
  const envJson = process.env.AI_COST_RATES_JSON;
  if (envJson) {
    try {
      return { ...DEFAULT_RATES, ...JSON.parse(envJson) };
    } catch {
      console.warn("[ai-usage] AI_COST_RATES_JSON is set but invalid JSON — using defaults.");
    }
  }
  return DEFAULT_RATES;
}

function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const rates = loadRates();
  // Try exact match first, then prefix match (e.g. "gemini-2.5-flash-lite-001")
  const exact = rates[model];
  if (exact) {
    return (tokensIn * exact.in + tokensOut * exact.out) / 1_000_000;
  }
  for (const [key, rate] of Object.entries(rates)) {
    if (model.startsWith(key)) {
      return (tokensIn * rate.in + tokensOut * rate.out) / 1_000_000;
    }
  }
  // Unknown model — use a conservative fallback ($0.50 / $1.50 per 1M)
  return (tokensIn * 0.5 + tokensOut * 1.5) / 1_000_000;
}

// ── Rough token estimation (when the provider doesn't return exact counts) ─
// ~4 chars per token is the standard heuristic for English text. Arabic text
// tokenizes less densely (~2 chars/token) but this is a rough estimate only.
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

// ── The logger ─────────────────────────────────────────────────────────────
export interface AiUsageLogInput {
  organizationId: string;
  userId?: string | null;
  provider: string; // 'gemini' | 'openai' | 'xai' | 'groq'
  model: string;
  feature?: string | null;
  promptText?: string;
  outputText?: string;
  tokensIn?: number;
  tokensOut?: number;
  keySource: "org" | "platform";
  stub: boolean;
}

/**
 * Write a single AiUsageLog row. Best-effort: any failure is logged and
 * swallowed so it can never break the actual AI response. Called from
 * dispatchAiText() after the provider returns.
 */
export async function logAiUsage(input: AiUsageLogInput): Promise<void> {
  try {
    const tokensIn =
      input.tokensIn ?? estimateTokens(input.promptText ?? "");
    const tokensOut =
      input.tokensOut ?? estimateTokens(input.outputText ?? "");
    const estimatedCostUsd = input.stub
      ? 0
      : estimateCost(input.model, tokensIn, tokensOut);

    await db.aiUsageLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        provider: input.provider,
        model: input.model,
        feature: input.feature ?? null,
        tokensIn,
        tokensOut,
        estimatedCostUsd,
        keySource: input.keySource,
        stub: input.stub,
      },
    });
  } catch (err) {
    console.error("[ai-usage] failed to log:", (err as Error)?.message);
  }
}

// ── Spike detection (Phase 2 §2.4 — dashboard alert) ───────────────────────
// Compares an org's spend in the current calendar day vs. the trailing 7-day
// average. If today's spend exceeds 2× the average (and the average is
// non-trivial), the org is flagged. Returns the flagged orgs with their
// numbers so the dashboard can show a banner.
export interface SpendSpike {
  organizationId: string;
  organizationName: string;
  todaySpendUsd: number;
  trailing7DayAvgUsd: number;
  ratio: number;
}

export async function detectSpendSpike(): Promise<SpendSpike[]> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(startOfToday.getTime() - 7 * 86400000);

  // Today's spend per org
  const today = await db.aiUsageLog.groupBy({
    by: ["organizationId"],
    where: { createdAt: { gte: startOfToday } },
    _sum: { estimatedCostUsd: true },
  });

  // Trailing 7-day spend per org (excluding today)
  const trailing = await db.aiUsageLog.groupBy({
    by: ["organizationId"],
    where: {
      createdAt: { gte: sevenDaysAgo, lt: startOfToday },
    },
    _sum: { estimatedCostUsd: true },
  });

  const trailingMap = new Map(
    trailing.map((t) => [t.organizationId, (t._sum.estimatedCostUsd ?? 0) / 7]),
  );

  const flagged: SpendSpike[] = [];
  for (const t of today) {
    const todaySpend = t._sum.estimatedCostUsd ?? 0;
    const avg = trailingMap.get(t.organizationId) ?? 0;
    // Flag if today's spend is > 2× the trailing average AND non-trivial
    // (> $1 today, to avoid noise from tiny absolute numbers).
    if (todaySpend > 1 && avg > 0 && todaySpend > 2 * avg) {
      const org = await db.organization.findUnique({
        where: { id: t.organizationId },
        select: { name: true },
      });
      flagged.push({
        organizationId: t.organizationId,
        organizationName: org?.name ?? "—",
        todaySpendUsd: todaySpend,
        trailing7DayAvgUsd: avg,
        ratio: todaySpend / avg,
      });
    }
  }
  return flagged.sort((a, b) => b.ratio - a.ratio);
}
