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
// - EMAIL VERIFICATION REQUIRED: User cannot login until email is verified
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { parseBody, registerSchema } from "@/lib/validation/auth";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { validateStudentCode, redeemStudentCode, promoProfileFields } from "@/lib/student-access";
import {
  generateVerifyToken,
  hashToken,
  buildVerifyUrl,
  sendVerificationEmail,
} from "@/lib/email";

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `firm-${Date.now()}`;
}

/**
 * Map account type to role.
 *
 * Every registration creates a NEW Organization — the user is always the
 * owner of that new firm workspace. Role names reflect their position within
 * THEIR organization only (not a global "site admin" concept).
 *
 * PRD v0.6 §4.3: "Client" is no longer a valid public registration account
 * type. Client accounts are created exclusively via matter-level invitations
 * (POST /api/matters/[id]/client-invitations → POST /api/invitations/accept).
 */
function roleForAccountType(accountType: string): string {
  switch (accountType) {
    case "Law Firm":
      return "Managing Partner";        // Owner of this law firm
    case "Solo Practitioner":
      return "Managing Partner";        // Single-lawyer firm owner
    case "Corporate Counsel":
      return "In-House Counsel";        // Legal team member at a company
    default:
      return "Managing Partner";        // Safe default for unknown types
  }
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
  if (parsed.ok === false) {
    // PRD v0.7 Fix 1b: if the caller tried to register as "Client", give a
    // clear, actionable error instead of the generic Zod message. The API is
    // reachable directly, so we can't rely on the frontend not offering it.
    const rawAccountType = (body as any)?.accountType;
    if (rawAccountType === "Client") {
      return NextResponse.json(
        {
          error: "Client accounts are created by invitation from your attorney. Ask your lawyer to send you an invite.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: parsed.error, fieldErrors: (parsed as any).fieldErrors }, { status: 400 });
  }
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
        maxSeats: 10, // PRD v0.6 §5.4 — authoritative seat limit on Organization
        users: {
          create: {
            email: data.email.toLowerCase(),
            name: data.name,
            passwordHash,
            barAssociationId: data.barAssociationId || null,
            jurisdiction: data.jurisdiction,
            accountType: data.accountType,
            role: roleForAccountType(data.accountType),
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

    // Apply the promo code (atomically consumes it + snapshots limits onto user).
    // If it unexpectedly fails after the account was created (e.g. a race where
    // the code was consumed between our pre-check and now), roll the account back.
    if (data.studentCode) {
      const redeemed = await redeemStudentCode(data.studentCode, user.id);
      if (redeemed.ok === false) {
        await db.organization.delete({ where: { id: org.id } }).catch((): void => undefined);
        return NextResponse.json({ error: redeemed.error }, { status: 400 });
      }
    }

    // ── Email Verification Setup ───────────────────────────────────────────
    // Generate a token, store its hash + expiry on the user, then send email.
    // The user CANNOT login until they verify their email.
    const rawToken = generateVerifyToken();
    const tokenHash = hashToken(rawToken);
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: tokenHash,
        emailVerifyExpires: verifyExpires,
        // emailVerified stays NULL — user must verify before login works
      },
    });

    const verifyUrl = buildVerifyUrl(rawToken, user.email);

    // Attempt to send verification email. If it fails, we still keep the
    // account — the user can request a resend later.
    const emailResult = await sendVerificationEmail({
      to: user.email,
      name: user.name,
      verifyUrl,
    });

    // Audit the registration
    await audit(
      { action: "auth.register", entity: "user", entityId: user.id, details: { email: user.email, emailSent: emailResult.ok } },
      req,
      { userId: user.id, organizationId: org.id },
    );

    // Return success with verification required flag — DO NOT return session data
    // DO NOT auto-login; client must show "check your email" UI
    return NextResponse.json(
      {
        ok: true,
        requiresVerification: true,
        email: user.email,
        ...(emailResult.ok ? {} : { warning: "Account created but verification email failed to send. You can request a resend after signing in." }),
      },
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
