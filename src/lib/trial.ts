// =============================================================================
// Al Mizan — Trial expiry helpers (PRD v0.8 §3)
// -----------------------------------------------------------------------------
// Computes trial expiry at READ TIME rather than storing a decrementing counter.
// This avoids drift from missed cron runs and is trivially correct even if
// nothing ever runs on a schedule.
//
// Design:
//   • Trial start = user.createdAt (reused, no new column needed for the common
//     case — a Free Trial user's trial started when they registered).
//   • Trial duration = 14 days.
//   • trialDaysLeft becomes a COMPUTED value: max(0, 14 - daysSince(createdAt)).
//   • planStatus gets explicitly flipped to "Expired" the first time the
//     computed expiry is detected (lazy transition, not a cron requirement)
//     — so the audit trail + any future reporting see a real status change.
// =============================================================================

import "server-only";
import { db } from "@/lib/db";

export const TRIAL_DURATION_DAYS = 14;
const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

interface TrialUser {
  id: string;
  subscriptionTier: string;
  planStatus: string;
  createdAt: Date;
}

/** Returns true if the user is on a Free Trial and the trial has expired. */
export function isTrialExpired(user: Pick<TrialUser, "subscriptionTier" | "planStatus" | "createdAt">): boolean {
  if (user.subscriptionTier !== "Free Trial") return false;
  if (user.planStatus === "Active") return false; // already upgraded (shouldn't happen on Free Trial, but defensive)
  if (user.planStatus === "Expired") return true;
  return Date.now() - user.createdAt.getTime() >= TRIAL_DURATION_MS;
}

/**
 * Compute the remaining trial days (0 if expired). Returns 0 for non-trial
 * users (they have no trial countdown).
 */
export function computeTrialDaysLeft(user: Pick<TrialUser, "subscriptionTier" | "planStatus" | "createdAt">): number {
  if (user.subscriptionTier !== "Free Trial") return 0;
  if (user.planStatus === "Active") return 0;
  const elapsed = Date.now() - user.createdAt.getTime();
  const remaining = TRIAL_DURATION_MS - elapsed;
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

/**
 * Lazy transition: if the trial is expired but planStatus is still "Trial",
 * flip it to "Expired" in the DB. Called at read points (login, quota checks).
 * Returns the effective planStatus after the (possible) transition.
 *
 * This is a best-effort write — if it fails (e.g. concurrent update), we
 * proceed with the computed state; the next call will retry.
 */
export async function maybeExpireTrial(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true, planStatus: true, createdAt: true },
  });
  if (!user) return;
  if (user.subscriptionTier !== "Free Trial") return;
  if (user.planStatus !== "Trial") return; // already Active or Expired

  if (isTrialExpired(user)) {
    await db.user.update({
      where: { id: userId },
      data: { planStatus: "Expired" },
    }).catch((err) => {
      // Non-fatal — the computed checks still work; next call retries.
      console.error("[trial] failed to lazy-expire:", err);
    });
  }
}
