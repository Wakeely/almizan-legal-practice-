// =============================================================================
// POST /api/auth/login
// -----------------------------------------------------------------------------
// Validates credentials and returns the user profile. The actual session
// cookie is set by the client calling next-auth/react signIn(), which posts
// to /api/auth/callback/credentials. This route exists for backward
// compatibility with the reference UI's AuthContext contract.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { parseBody, loginSchema } from "@/lib/validation/auth";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { promoProfileFields } from "@/lib/student-access";
import { maybeExpireTrial, computeTrialDaysLeft } from "@/lib/trial";

function publicUser(user: any, org: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    firmName: org.name,
    organizationId: org.id,
    role: user.role,
    barAssociationId: user.barAssociationId ?? org.barAssociationId ?? "",
    jurisdiction: user.jurisdiction ?? org.jurisdiction,
    accountType: user.accountType,
    subscriptionTier: user.subscriptionTier,
    planStatus: user.planStatus,
    // PRD v0.8 §3: trialDaysLeft is now COMPUTED, not the stale stored number
    trialDaysLeft: computeTrialDaysLeft(user),
    seats: user.seats,
    maxSeats: user.maxSeats,
    billingCycle: user.billingCycle,
    renewalDate: user.renewalDate ?? "",
    biometricEnabled: user.biometricEnabled,
    ...promoProfileFields(user),
  };
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = await authRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(loginSchema, body);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { organization: true },
  });
  if (!user || !user.organization) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  // PRD v0.8 §3: lazy trial expiry transition — flip planStatus to "Expired"
  // if the trial is past its 14 days. Reloads the user after the transition
  // so the returned planStatus reflects reality.
  await maybeExpireTrial(user.id);
  const freshUser = await db.user.findUnique({
    where: { id: user.id },
    include: { organization: true },
  });
  if (!freshUser) {
    // Extremely unlikely race — fall back to the pre-expiry user.
    return NextResponse.json({ user: publicUser(user, user.organization) });
  }

  await audit({ action: "auth.login", entity: "user", entityId: freshUser.id, details: { email: freshUser.email } }, req);

  return NextResponse.json({ user: publicUser(freshUser, freshUser.organization) });
}
