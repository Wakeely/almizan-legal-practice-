// =============================================================================
// Al Mizan — Per-tier subscription limits (PRD v0.8 §4.1)
// -----------------------------------------------------------------------------
// Single source of truth for what each subscription tier allows. Referenced by
// the quota-check functions (assertCanCreateMatter, assertAiQuota) and by the
// platform admin Billing tab (which sets Organization.maxSeats from the tier).
//
// PRD §4.1: "This table should live in one config object, not scattered across
// routes — so adjusting numbers later doesn't mean hunting through nine route
// files."
//
// Values are v1 placeholders per PRD §7 Open Q1 — tune based on real AiUsageLog
// data once a few weeks of it exist.
// =============================================================================

export type SubscriptionTier =
  | "Free Trial"
  | "Solo Practice"
  | "Pro Practice"
  | "Enterprise & Arbitration";

export interface TierLimits {
  /** Max active (non-deleted) matters the org can hold. null = unlimited. */
  maxMatters: number | null;
  /** Max AI calls per calendar month. null = unlimited. */
  maxAiCallsPerMonth: number | null;
  /** Seat limit written to Organization.maxSeats. */
  maxSeats: number;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  "Free Trial": {
    maxMatters: 3,
    maxAiCallsPerMonth: 20,
    maxSeats: 1,
  },
  "Solo Practice": {
    maxMatters: 25,
    maxAiCallsPerMonth: 300,
    maxSeats: 1,
  },
  "Pro Practice": {
    maxMatters: 500, // high soft cap
    maxAiCallsPerMonth: 2000,
    maxSeats: 10,
  },
  "Enterprise & Arbitration": {
    maxMatters: null, // unlimited
    maxAiCallsPerMonth: null, // unlimited
    maxSeats: 50,
  },
};

/** Look up the limits for a tier string (defensive — falls back to Free Trial). */
export function getTierLimits(tier: string): TierLimits {
  return TIER_LIMITS[tier as SubscriptionTier] ?? TIER_LIMITS["Free Trial"];
}
