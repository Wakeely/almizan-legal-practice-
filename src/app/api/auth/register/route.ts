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
import { validateStudentCode, redeemStudentCode, promoProfileFields } from "@/lib/student-access";

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
  const parsed = parseBody(registerSchema, body);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error, fieldErrors: (parsed as any).fieldErrors }, { status: 400 });
  const data = parsed.data;

  const strength = validatePasswordStrength(data.password);
  if (!strength.ok) {
    return NextResponse.json(
      { error: strength.reason, fieldErrors: { password: [strength.reason!] } },
      { status: 400 },
    );
  }

  const existing = await db.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "Email is already registered" }, { status: 409 });

  // Validate the promo code BEFORE creating anything so an invalid code can't
  // leave orphan accounts behind.
  if (data.studentCode) {
    const pre = await validateStudentCode(data.studentCode);
    if (pre.ok === false) return NextResponse.json({ error: pre.error }, { status: 400 });
  }

  const slug = slugify(data.firmName);
  const slugUnique = await db.organization.findUnique({ where: { slug } });
  const finalSlug = slugUnique ? `${slug}-${Math.random().toString(36).slice(2, 6)}` : slug;

  const passwordHash = await hashPassword(data.password);

  try {
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
            planStatus: "Active",
            trialDaysLeft: 0,
            seats: 1,
            maxSeats: 10,
            billingCycle: "Monthly",
          },
        },
      },
      include: { users: true },
    });

    const user = org.users[0];

    if (data.studentCode) {
      const redeemed = await redeemStudentCode(data.studentCode, user.id);
      if (redeemed.ok === false) {
        await db.organization.delete({ where: { id: org.id } }).catch((): void => undefined);
        return NextResponse.json({ error: redeemed.error }, { status: 400 });
      }
    }

    const updatedUser = await db.user.findUnique({
      where: { id: user.id },
      include: { organization: true },
    });
    if (!updatedUser) {
      return NextResponse.json(
        { error: "Account created but could not be loaded" },
        { status: 500 },
      );
    }

    await audit(
      { action: "auth.register", entity: "user", entityId: user.id, details: { email: user.email } },
      req,
      { userId: user.id, organizationId: org.id },
    );

    return NextResponse.json(
      { user: publicUser(updatedUser, updatedUser.organization) },
      { status: 201 },
    );
  } catch (dbError: unknown) {
    console.error("[REGISTER] Database error:", dbError);

    if (
      dbError &&
      typeof dbError === "object" &&
      "code" in dbError &&
      (dbError as { code: string }).code === "P2002"
    ) {
      const meta = (dbError as { meta?: { target?: string[] } }).meta;
      const target = (meta?.target ?? []).join(" ");
      if (target.includes("email")) {
        return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
      }
      if (target.includes("slug")) {
        return NextResponse.json(
          { error: "Organization name is already taken. Try a different firm name." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "A record with this information already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 },
    );
  }
}
