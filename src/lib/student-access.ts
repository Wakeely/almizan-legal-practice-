// =============================================================================
// Student / promo code access control — free limited access for marketing.
// -----------------------------------------------------------------------------
// Server-side enforcement for accounts registered or upgraded with a StudentCode.
//
// Design decisions:
//   • Only accounts whose accessKind === "promo" are gated. "free" (default
//     trial) and "paid" (subscription) accounts are untouched → the existing
//     paid system and free trials keep working exactly as before.
//   • Limits are snapshotted onto the user row at redemption, so later edits
//     to the StudentCode row do not retroactively change an existing account.
//   • Matter limiting counts ACTIVE (non-deleted) matters for the user's org.
//   • AI quota is enforced + consumed atomically per request on the redeeming
//     user (period-aware: 'total' or 'monthly').
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { AccessKind, AiQuotaPeriod, PromoAllowance } from "@/lib/types";
import { getTierLimits } from "@/lib/subscription-limits";
import { isTrialExpired, maybeExpireTrial } from "@/lib/trial";

export const ACCESS_FREE: AccessKind = "free";
export const ACCESS_PAID: AccessKind = "paid";
export const ACCESS_PROMO: AccessKind = "promo";

export const ERROR_MATTER_LIMIT = "PROMO_MATTER_LIMIT_REACHED";
export const ERROR_AI_LIMIT = "PROMO_AI_LIMIT_REACHED";
export const ERROR_EXPIRED = "PROMO_EXPIRED";
export const ERROR_TRIAL_EXPIRED = "TRIAL_EXPIRED";
export const ERROR_TIER_MATTER_LIMIT = "TIER_MATTER_LIMIT_REACHED";
export const ERROR_TIER_AI_LIMIT = "TIER_AI_LIMIT_REACHED";

/** Current UTC month key "YYYY-MM" used to scope a monthly AI quota. */
export function currentMonthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isPromo(accessKind?: AccessKind | null): boolean {
  return accessKind === ACCESS_PROMO;
}

/** Redact a code for display (e.g. STUDENT-ABCD → STUDENT-…B4C2). */
export function redactCode(code: string): string {
  const parts = code.split("-").filter(Boolean);
  if (parts.length < 2) {
    return code.length > 12 ? `${code.slice(0, 6)}…${code.slice(-4)}` : code;
  }
  const last = parts[parts.length - 1];
  return `${parts[0]}-…${last.slice(-4)}`;
}

/** The promo fields we expose on the user profile object (client-facing). */
export function promoProfileFields(user: {
  accessKind?: string | null;
  promoCode?: string | null;
  promoMaxMatters?: number | null;
  promoAiQuota?: number | null;
  promoAiQuotaPeriod?: string | null;
  promoAiUsed?: number | null;
  promoExpiresAt?: string | null;
}) {
  return {
    accessKind: (user.accessKind as AccessKind) ?? ACCESS_FREE,
    promoCode: user.promoCode ?? undefined,
    promoMaxMatters: user.promoMaxMatters ?? 0,
    promoAiQuota: user.promoAiQuota ?? 0,
    promoAiQuotaPeriod: (user.promoAiQuotaPeriod as AiQuotaPeriod) ?? "total",
    promoAiUsed: user.promoAiUsed ?? 0,
    promoExpiresAt: user.promoExpiresAt ?? undefined,
  };
}

function blockedResponse(message: string, code: string) {
  return NextResponse.json(
    {
      error: message,
      code,
      upgradeRequired: true,
    },
    { status: 403 },
  );
}

// -----------------------------------------------------------------------------
// Matter limit
// -----------------------------------------------------------------------------

interface SessionLike {
  id: string;
  organizationId: string;
}

export async function assertCanCreateMatter(session: SessionLike): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      accessKind: true,
      subscriptionTier: true,
      planStatus: true,
      createdAt: true,
      promoMaxMatters: true,
      promoExpiresAt: true,
    },
  });
  if (!user) return { ok: true }; // defensive — shouldn't happen

  // ── Promo accounts: existing student-code-based limits (unchanged) ──────
  if (isPromo(user.accessKind as AccessKind)) {
    const expiresAt = user.promoExpiresAt ? new Date(user.promoExpiresAt).getTime() : null;
    if (expiresAt !== null && expiresAt < Date.now()) {
      return {
        ok: false,
        response: blockedResponse(
          "Your student access has expired. Please upgrade to a paid plan to continue.",
          ERROR_EXPIRED,
        ),
      };
    }
    const used = await db.matter.count({
      where: { organizationId: session.organizationId, deletedAt: null },
    });
    if (used >= (user.promoMaxMatters ?? 0)) {
      return {
        ok: false,
        response: blockedResponse(
          `Student access limit reached: you can have up to ${user.promoMaxMatters} matters. Please upgrade to a paid plan to add more.`,
          ERROR_MATTER_LIMIT,
        ),
      };
    }
    return { ok: true };
  }

  // ── Non-promo accounts: PRD v0.8 §4.2 — check tier limits ───────────────
  // Lazy-expire the trial first so an expired trial blocks the same way a
  // used-up promo does.
  await maybeExpireTrial(session.id);
  if (isTrialExpired(user)) {
    return {
      ok: false,
      response: blockedResponse(
        "Your free trial has expired. Please upgrade to a paid plan to continue creating matters.",
        ERROR_TRIAL_EXPIRED,
      ),
    };
  }

  const limits = getTierLimits(user.subscriptionTier);
  if (limits.maxMatters === null) return { ok: true }; // unlimited

  const used = await db.matter.count({
    where: { organizationId: session.organizationId, deletedAt: null },
  });
  if (used >= limits.maxMatters) {
    return {
      ok: false,
      response: blockedResponse(
        `Your plan (${user.subscriptionTier}) allows up to ${limits.maxMatters} matters. Please upgrade to add more.`,
        ERROR_TIER_MATTER_LIMIT,
      ),
    };
  }
  return { ok: true };
}

// -------------------------------------------------------------------------
// AI quota
// -------------------------------------------------------------------------

export async function assertAiQuota(userId: string): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      accessKind: true,
      subscriptionTier: true,
      planStatus: true,
      createdAt: true,
      organizationId: true,
      promoAiQuota: true,
      promoAiUsed: true,
      promoAiQuotaPeriod: true,
      promoAiPeriodStart: true,
      promoExpiresAt: true,
    },
  });
  if (!user) return { ok: true }; // defensive

  // ── Promo accounts: existing student-code-based quota (unchanged) ────────
  if (isPromo(user.accessKind as AccessKind)) {
    const expiresAt = user.promoExpiresAt ? new Date(user.promoExpiresAt).getTime() : null;
    if (expiresAt !== null && expiresAt < Date.now()) {
      return {
        ok: false,
        response: blockedResponse(
          "Your student access has expired. Please upgrade to a paid plan to continue.",
          ERROR_EXPIRED,
        ),
      };
    }

    const monthKey = currentMonthKey();
    const period = (user.promoAiQuotaPeriod as AiQuotaPeriod) ?? "total";
    const quota = user.promoAiQuota ?? 0;
    let used = user.promoAiUsed ?? 0;
    let resetPeriod = false;

    if (period === "monthly" && user.promoAiPeriodStart !== monthKey) {
      used = 0;
      resetPeriod = true;
    }

    if (used >= quota) {
      return {
        ok: false,
        response: blockedResponse(
          period === "monthly"
            ? `Student AI usage limit reached for this month (${quota} calls). Please upgrade to a paid plan for more.`
            : `Student AI usage limit reached (${quota} calls). Please upgrade to a paid plan for unlimited AI.`,
          ERROR_AI_LIMIT,
        ),
      };
    }

    // Reserve this call now (atomic) — promo accounts use the on-user counter.
    await db.user.update({
      where: { id: userId },
      data: resetPeriod
        ? { promoAiUsed: 1, promoAiPeriodStart: monthKey }
        : { promoAiUsed: { increment: 1 } },
    });

    return { ok: true };
  }

  // ── Non-promo accounts: PRD v0.8 §4.2 — count AiUsageLog rows this month ─
  // Lazy-expire the trial first.
  await maybeExpireTrial(userId);
  if (isTrialExpired(user)) {
    return {
      ok: false,
      response: blockedResponse(
        "Your free trial has expired. Please upgrade to a paid plan to continue using AI features.",
        ERROR_TRIAL_EXPIRED,
      ),
    };
  }

  const limits = getTierLimits(user.subscriptionTier);
  if (limits.maxAiCallsPerMonth === null) return { ok: true }; // unlimited

  // Count this month's AI calls for the user's org. AiUsageLog was built in
  // Phase 2 §2.4 — we reuse it rather than inventing a new counter.
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const used = await db.aiUsageLog.count({
    where: {
      organizationId: user.organizationId,
      createdAt: { gte: startOfMonth },
      stub: false, // don't count stub calls (no real provider answered)
    },
  });

  if (used >= limits.maxAiCallsPerMonth) {
    return {
      ok: false,
      response: blockedResponse(
        `Your plan (${user.subscriptionTier}) allows ${limits.maxAiCallsPerMonth} AI calls per month. You've used ${used}. Please upgrade for more.`,
        ERROR_TIER_AI_LIMIT,
      ),
    };
  }

  // Note: we do NOT increment a counter here — the AiUsageLog row written by
  // dispatchAiText() (Phase 2) IS the counter. The next call will see it.
  return { ok: true };
}

// -------------------------------------------------------------------------
// Redemption
// -------------------------------------------------------------------------

/** Cheap pre-flight check used before creating a user during registration. */
export async function validateStudentCode(code: string): Promise<
  { ok: true; limits: { maxMatters: number; aiQuota: number } } | { ok: false; error: string }
> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, error: "Enter a promo code" };

  const found = await db.studentCode.findUnique({ where: { code: trimmed } });
  if (!found) return { ok: false, error: "Invalid promo code" };
  if (!found.isActive) return { ok: false, error: "This promo code has been disabled." };
  if (found.expiresAt && found.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This promo code has expired." };
  }
  return { ok: true, limits: { maxMatters: found.maxMatters, aiQuota: found.aiQuota } };
}

export async function redeemStudentCode(
  code: string,
  userId: string,
): Promise<{ ok: true; limits: { maxMatters: number; aiQuota: number } } | { ok: false; error: string }> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, error: "Enter a promo code" };

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { accessKind: true, organizationId: true },
  });
  if (!user) return { ok: false, error: "User not found" };

  // Never downgrade an already-paid account back to a limited promo tier.
  if (user.accessKind === ACCESS_PAID) {
    return { ok: false, error: "A paid plan is already active on this account." };
  }

  const found = await db.studentCode.findUnique({ where: { code: trimmed } });
  if (!found) return { ok: false, error: "Invalid promo code" };
  if (!found.isActive) return { ok: false, error: "This promo code has been disabled." };
  if (found.expiresAt && found.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This promo code has expired." };
  }

  // Atomically consume the code (guards against double redemption under race).
  const consumed = await db.studentCode.updateMany({
    where: {
      id: found.id,
      isActive: true,
    },
    data: { usedCount: { increment: 1 } },
  });
  if (consumed.count === 0) return { ok: false, error: "This promo code is no longer available." };

  await db.user.update({
    where: { id: userId },
    data: {
      accessKind: ACCESS_PROMO,
      promoCode: redactCode(found.code),
      promoMaxMatters: found.maxMatters,
      promoAiQuota: found.aiQuota,
      promoAiQuotaPeriod: (found.aiQuotaPeriod as AiQuotaPeriod) ?? "total",
      promoAiUsed: 0,
      promoAiPeriodStart:
        (found.aiQuotaPeriod as AiQuotaPeriod) === "monthly" ? currentMonthKey() : null,
      promoExpiresAt: found.expiresAt ? found.expiresAt.toISOString() : null,
    },
  });

  await db.auditLog.create({
    data: {
      organizationId: user.organizationId,
      userId,
      action: "student_code.redeem",
      entity: "user",
      entityId: userId,
      details: JSON.stringify({ code: redactCode(found.code), maxMatters: found.maxMatters, aiQuota: found.aiQuota }),
    },
  });

  return { ok: true, limits: { maxMatters: found.maxMatters, aiQuota: found.aiQuota } };
}

/** Promote a paid (or future) account: clears promo limits, keeps paid tier working. */
export async function setPaidAccess(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      accessKind: ACCESS_PAID,
      promoCode: null,
      promoMaxMatters: 0,
      promoAiQuota: 0,
      promoAiUsed: 0,
      promoAiPeriodStart: null,
      promoExpiresAt: null,
    },
  });
}

// -------------------------------------------------------------------------
// Usage summary (shown to the client in the promo banner)
// -------------------------------------------------------------------------

export async function getPromoAllowance(userId: string): Promise<PromoAllowance | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      accessKind: true,
      promoMaxMatters: true,
      promoAiQuota: true,
      promoAiQuotaPeriod: true,
      promoAiUsed: true,
      promoAiPeriodStart: true,
      promoExpiresAt: true,
      organizationId: true,
    },
  });
  if (!user || !isPromo(user.accessKind as AccessKind)) return null;

  const mattersUsed = await db.matter.count({
    where: { organizationId: user.organizationId, deletedAt: null },
  });
  const monthKey = currentMonthKey();
  let aiUsed = user.promoAiUsed ?? 0;
  if ((user.promoAiQuotaPeriod as AiQuotaPeriod) === "monthly" && user.promoAiPeriodStart !== monthKey) {
    aiUsed = 0;
  }

  return {
    accessKind: ACCESS_PROMO,
    mattersUsed,
    mattersMax: user.promoMaxMatters ?? 0,
    aiUsed,
    aiQuota: user.promoAiQuota ?? 0,
    aiQuotaPeriod: (user.promoAiQuotaPeriod as AiQuotaPeriod) ?? "total",
    expiresAt: user.promoExpiresAt ?? null,
  };
}