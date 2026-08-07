// =============================================================================
// Al Mizan — server-side session helpers
// -----------------------------------------------------------------------------
// All session reads go through this module. It returns the full UserProfile
// (including subscription + firm fields) by joining User ↔ Organization.
//
// SAFETY (v2):
// - getSessionUser() validates that id, email, organizationId are present.
// - getFullUserProfile() loads user by session.id from DB; returns null if
//   not found or if soft-deleted. Never falls back to a different user.
// - All identity fields come from THAT specific user row + THEIR org only.
// =============================================================================

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import { promoProfileFields } from "@/lib/student-access";
import type { UserProfile } from "@/lib/types";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  role: string;
}

/**
 * Returns the authenticated user's identity (id, email, name, org, role)
 * or null if not authenticated. Safe to call in any server component / route.
 *
 * Validates that essential fields exist in the JWT/session before returning
 * a non-null result. This prevents downstream code from operating on
 * incomplete identities.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const u = session.user as any;

  // Validate essential identity fields are present
  // Missing fields indicate a malformed/stale JWT
  if (!u.id || !u.email || !u.organizationId) {
    console.warn(
      `[session] Incomplete identity in session: ` +
      `id=${u.id ?? "MISSING"} email=${u.email ?? "MISSING"} orgId=${u.organizationId ?? "MISSING"}`
    );
    return null;
  }

  return {
    id: u.id,
    email: u.email,
    name: u.name,
    organizationId: u.organizationId,
    role: u.role,
  };
}

/**
 * Returns the full UserProfile (firm, subscription, etc.) or null.
 * Use this when you need the user's firm name or subscription tier.
 *
 * SAFETY:
 * - Loads user by session.id from DB (never guesses)
 * - Returns null if user not found, soft-deleted, or missing org
 * - All data comes from THAT user's row + their own organization
 * - No fallback to other users or default "admin" accounts
 */
export async function getFullUserProfile(): Promise<UserProfile | null> {
  const session = await getSessionUser();
  if (!session) return null;

  // Load FRESH data from DB using the session's user ID
  const user = await db.user.findUnique({
    where: { id: session.id },
    include: { organization: true },
  });

  // Safety: user must exist and NOT be soft-deleted
  if (!user) {
    console.warn(`[session] User ${session.id} from session not found in DB`);
    return null;
  }

  if (user.deletedAt) {
    console.warn(`[session] User ${session.id} is soft-deleted, returning null`);
    return null;
  }

  // Safety: user must have an organization
  if (!user.organization) {
    console.warn(`[session] User ${session.id} has no organization`);
    return null;
  }

  // Safety: verify the loaded user matches the session email
  // This catches edge cases where DB state changed after token was issued
  if (user.email.toLowerCase() !== session.email.toLowerCase()) {
    console.error(
      `[session] EMAIL MISMATCH! Session says ${session.email}, ` +
      `DB has ${user.email} for userId=${session.id}`
    );
    // Return null rather than wrong user's profile
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    firmName: user.organization.name,
    organizationId: user.organizationId,
    role: user.role as UserProfile["role"],
    barAssociationId: user.barAssociationId ?? user.organization.barAssociationId ?? "",
    jurisdiction: user.jurisdiction ?? user.organization.jurisdiction,
    accountType: user.accountType as UserProfile["accountType"],
    avatarUrl: user.avatarUrl ?? undefined,
    subscriptionTier: user.subscriptionTier as UserProfile["subscriptionTier"],
    planStatus: user.planStatus as UserProfile["planStatus"],
    trialDaysLeft: user.trialDaysLeft,
    seats: user.seats,
    maxSeats: user.maxSeats,
    billingCycle: user.billingCycle as UserProfile["billingCycle"],
    renewalDate: user.renewalDate ?? "",
    biometricEnabled: user.biometricEnabled,
    ...promoProfileFields(user),
    // Paid add-on toggles — mirror Organization columns so the client can
    // decide whether to show the module or an upgrade CTA without an extra
    // round-trip. The API still enforces the gate server-side.
    investigationAgentEnabled: (user.organization as any).investigationAgentEnabled ?? false,
  };
}
