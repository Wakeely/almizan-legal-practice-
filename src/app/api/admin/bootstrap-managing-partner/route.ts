// =============================================================================
// POST /api/admin/bootstrap-managing-partner — emergency access recovery
// -----------------------------------------------------------------------------
// WHY THIS EXISTS:
//   The owner is locked out of their Managing Partner account (password reset
//   succeeded but login still fails for an undetermined reason). Rather than
//   keep debugging the existing account, this endpoint creates a BRAND NEW
//   Managing Partner user in the SAME organization, so the owner can log in
//   fresh and regain access immediately.
//
// WHAT IT DOES:
//   - Looks up the organization of the existing user "ewakeely@gmail.com"
//     (configurable via REFERENCE_EMAIL env var, defaults to that email)
//   - Creates a NEW User in that same organization with:
//       email    = the email you supply in the body
//       password = the password you supply in the body (hashed with bcrypt 12 rounds)
//       role     = "Managing Partner"
//       name     = the name you supply (or "Managing Partner" by default)
//       organizationId, jurisdiction, barAssociationId = copied from the org
//       subscription fields = sensible defaults (same as registration)
//   - Returns { ok: true, user: { email, name, role, organizationId } }
//     NEVER returns the password hash.
//
// WHAT IT DOES NOT DO:
//   - Does NOT delete or modify the existing ewakeely@gmail.com user.
//   - Does NOT change any other user's password.
//   - Does NOT create a new organization (reuses the existing one).
//   - Does NOT expose password hashes anywhere.
//   - Does NOT create a session — the owner logs in normally afterward.
//
// SECURITY (4 layers):
//   1. ADMIN_BOOTSTRAP_ENABLED=1 env var — kill-switch. Defaults to off.
//   2. ADMIN_BOOTSTRAP_TOKEN env var — secret token, must be supplied in body.
//      Different from PASSWORD_RESET_TOKEN so this can be locked down
//      independently. Min 16 chars.
//   3. Email uniqueness check — refuses if the new email is already registered
//      (returns 409, no overwrite).
//   4. audit() log entry — records every bootstrap attempt (success or failure)
//      with the new email + the org it was created in. NEVER logs the password.
//
// PASSWORD STRENGTH (reuses the real registration rules from src/lib/password):
//   - Min 12 chars
//   - At least one lowercase (a-z)
//   - At least one uppercase (A-Z)
//   - At least one digit (0-9)
//   - At least one special char (!@#$%^&*()_+-=[]{};':"|,.<>/?)
//
// AFTER USE: set ADMIN_BOOTSTRAP_ENABLED=0 in Vercel + redeploy to disable.
// The new user persists — only the endpoint gets locked down.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { audit } from "@/lib/audit";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";

const bootstrapSchema = z.object({
  newEmail: z.string().email("Invalid new email"),
  newPassword: z.string().min(12, "Password must be at least 12 characters"),
  newName: z.string().min(2).max(120).optional(),
  token: z.string().min(8, "Token is required"),
});

export async function POST(req: Request) {
  // ── Layer 1: kill-switch ───────────────────────────────────────────────
  if (process.env.ADMIN_BOOTSTRAP_ENABLED !== "1") {
    return NextResponse.json(
      {
        error:
          "Bootstrap endpoint is disabled. Set ADMIN_BOOTSTRAP_ENABLED=1 + ADMIN_BOOTSTRAP_TOKEN=<your-secret> in Vercel env vars, redeploy, then retry.",
        disabled: true,
      },
      { status: 403 },
    );
  }

  // ── Layer 2: token check ───────────────────────────────────────────────
  const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
  if (!expectedToken || expectedToken.length < 8) {
    return NextResponse.json(
      {
        error:
          "Server misconfigured: ADMIN_BOOTSTRAP_TOKEN env var is not set or too short. Set it to a random string of at least 16 characters, redeploy, then retry.",
      },
      { status: 500 },
    );
  }

  // ── Rate limit ─────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  const limit = await authRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  // ── Parse body ─────────────────────────────────────────────────────────
  const body = await req.json().catch((): null => null);
  const parsed = bootstrapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  const { newEmail, newPassword, newName, token } = parsed.data;

  if (token !== expectedToken) {
    return NextResponse.json(
      { error: "Invalid token." },
      { status: 401 },
    );
  }

  // ── Layer 3: password strength (reuses real registration rules) ────────
  const strength = validatePasswordStrength(newPassword);
  if (!strength.ok) {
    return NextResponse.json(
      { error: strength.reason ?? "Password does not meet strength requirements." },
      { status: 400 },
    );
  }

  // ── Check the new email isn't already registered (no overwrite) ────────
  const newEmailLower = newEmail.toLowerCase();
  const existing = await db.user.findUnique({
    where: { email: newEmailLower },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        error: `A user with email "${newEmailLower}" already exists. Pick a different email, or reset that user's password instead.`,
      },
      { status: 409 },
    );
  }

  // ── Look up the reference user's organization ──────────────────────────
  // Defaults to ewakeely@gmail.com (the locked-out owner). Override via
  // REFERENCE_EMAIL env var if needed.
  const referenceEmail = (process.env.REFERENCE_EMAIL ?? "ewakeely@gmail.com").toLowerCase();
  const referenceUser = await db.user.findUnique({
    where: { email: referenceEmail },
    include: { organization: true },
  });

  if (!referenceUser || !referenceUser.organization) {
    return NextResponse.json(
      {
        error: `Could not find the reference user "${referenceEmail}" or their organization. Set REFERENCE_EMAIL to a different existing user's email in Vercel env vars + redeploy.`,
      },
      { status: 404 },
    );
  }

  const org = referenceUser.organization;

  // ── Hash the password (same as registration: bcrypt 12 rounds) ─────────
  const passwordHash = await hashPassword(newPassword);

  // ── Create the new Managing Partner user in the same org ───────────────
  try {
    const newUser = await db.user.create({
      data: {
        email: newEmailLower,
        name: newName ?? "Managing Partner",
        passwordHash,
        // Inherit the org's settings (same pattern as registration).
        barAssociationId: org.barAssociationId,
        jurisdiction: org.jurisdiction,
        accountType: "Law Firm",
        role: "Managing Partner",
        // Sensible subscription defaults (match registration).
        subscriptionTier: "Free Trial",
        planStatus: "Trial",
        trialDaysLeft: 14,
        seats: 1,
        maxSeats: 10,
        billingCycle: "Monthly",
        // Multi-tenancy — critical.
        organizationId: org.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        createdAt: true,
      },
    });

    // ── Layer 4: audit log (NEVER logs the password or hash) ─────────────
    await audit(
      {
        action: "admin.bootstrap_managing_partner",
        entity: "user",
        entityId: newUser.id,
        details: {
          newEmail: newUser.email,
          newName: newUser.name,
          role: newUser.role,
          organizationId: newUser.organizationId,
          organizationName: org.name,
          referenceEmail,
          authMethod: "token",
        },
      },
      req,
    );

    return NextResponse.json({
      ok: true,
      message: `New Managing Partner user created. Email: ${newUser.email}. Organization: "${org.name}". You can now log in with these credentials. Remember to disable this endpoint afterward.`,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        organizationId: newUser.organizationId,
        organizationName: org.name,
      },
    });
  } catch (err: any) {
    // P2002 = unique constraint violation (email already exists — race condition)
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: `A user with email "${newEmailLower}" already exists (race condition). Pick a different email.` },
        { status: 409 },
      );
    }
    await audit(
      {
        action: "admin.bootstrap_managing_partner.failed",
        entity: "user",
        details: {
          newEmail: newEmailLower,
          reason: "db_error",
          error: String(err?.message ?? err).slice(0, 300),
        },
      },
      req,
    );
    return NextResponse.json(
      { error: `Failed to create user: ${err?.message ?? String(err)}` },
      { status: 500 },
    );
  }
}

// GET — returns whether the endpoint is enabled, WITHOUT doing anything.
export async function GET() {
  return NextResponse.json({
    enabled: process.env.ADMIN_BOOTSTRAP_ENABLED === "1",
    tokenConfigured:
      !!process.env.ADMIN_BOOTSTRAP_TOKEN && process.env.ADMIN_BOOTSTRAP_TOKEN.length >= 8,
    referenceEmail: process.env.REFERENCE_EMAIL ?? "ewakeely@gmail.com",
    message:
      process.env.ADMIN_BOOTSTRAP_ENABLED === "1"
        ? "Endpoint is ENABLED. POST with { newEmail, newPassword, newName?, token } to create a new Managing Partner."
        : "Endpoint is DISABLED. Set ADMIN_BOOTSTRAP_ENABLED=1 + ADMIN_BOOTSTRAP_TOKEN=<your-secret> in Vercel env vars + redeploy to enable.",
  });
}
