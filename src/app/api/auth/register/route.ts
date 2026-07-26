// =============================================================================
// POST /api/auth/register
// -----------------------------------------------------------------------------
// Creates a new Organization + User with the Managing Partner role by default.
//
// SECURITY:
// - Password hashed with bcrypt (12 rounds)
// - Email is lowercased + uniqueness enforced at DB level
// - Organization slug derived from firm name (lowercase, kebab-case)
// - All inputs validated via Zod
// - Rate-limited per IP via authRateLimit
// - Audit log written on success
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { parseBody, registerSchema } from "@/lib/validation/auth";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `firm-${Date.now()}`;
}

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
  const limit = authRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = parseBody(registerSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const strength = validatePasswordStrength(data.password);
  if (!strength.ok) return NextResponse.json({ error: strength.reason }, { status: 400 });

  const existing = await db.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "Email is already registered" }, { status: 409 });

  const slug = slugify(data.firmName);
  const slugUnique = await db.organization.findUnique({ where: { slug } });
  const finalSlug = slugUnique ? `${slug}-${Math.random().toString(36).slice(2, 6)}` : slug;

  const passwordHash = await hashPassword(data.password);

  const org = await db.organization.create({
    data: {
      name: data.firmName,
      slug: finalSlug,
      barAssociationId: data.barAssociationId || null,
      jurisdiction: data.jurisdiction,
      users: {
        create: {
          email: data.email.toLowerCase(),
          name: data.name,
          passwordHash,
          barAssociationId: data.barAssociationId || null,
          jurisdiction: data.jurisdiction,
          accountType: data.accountType,
          role: data.role ?? "Managing Partner",
          subscriptionTier: "Free Trial",
          planStatus: "Trial",
          trialDaysLeft: 14,
          seats: 1,
          maxSeats: 10,
          billingCycle: "Monthly",
        },
      },
    },
    include: { users: true },
  });

  const user = org.users[0];
  // Pass explicit ctx — session does not exist yet at register time.
  await audit(
    { action: "auth.register", entity: "user", entityId: user.id, details: { email: user.email } },
    req,
    { userId: user.id, organizationId: org.id },
  );

  return NextResponse.json({ user: publicUser(user, org) }, { status: 201 });
}
