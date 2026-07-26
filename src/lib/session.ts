// =============================================================================
// Al Mizan — server-side session helpers
// -----------------------------------------------------------------------------
// All session reads go through this module. It returns the full UserProfile
// (including subscription + firm fields) by joining User ↔ Organization.
// =============================================================================

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
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
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const u = session.user as any;
  if (!u.id || !u.organizationId) return null;
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
 */
export async function getFullUserProfile(): Promise<UserProfile | null> {
  const session = await getSessionUser();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.id },
    include: { organization: true },
  });
  if (!user || !user.organization) return null;

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
  };
}
