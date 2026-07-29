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
    trialDaysLeft: user.trialDaysLeft,
    seats: user.seats,
    maxSeats: user.maxSeats,
    billingCycle: user.billingCycle,
    renewalDate: user.renewalDate ?? "",
    biometricEnabled: user.biometricEnabled,
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

  const body = await req.json().catch(() => null);
  const parsed = parseBody(loginSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
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

  await audit({ action: "auth.login", entity: "user", entityId: user.id, details: { email: user.email } }, req);

  return NextResponse.json({ user: publicUser(user, user.organization) });
}
