// =============================================================================
// POST /api/admin/reset-user-password — TEMPORARY password reset for owner
// -----------------------------------------------------------------------------
// WHY THIS EXISTS:
//   The existing /api/auth/reset-password endpoint is a MOCKUP (it always
//   returns {ok:true} but never sends an email and never changes the password).
//   The owner is locked out of their Managing Partner account and cannot log
//   in to use the Investigation setup endpoints. This temporary admin endpoint
//   lets them reset a single user's password directly, without email.
//
// SECURITY (4 layers):
//   1. PASSWORD_RESET_ENABLED=1 env var — kill-switch. Defaults to off.
//      After the owner resets their password, they set this back to 0 +
//      redeploy to lock this endpoint down.
//   2. PASSWORD_RESET_TOKEN env var — a one-time bearer token that must be
//      supplied in the request body. Even if someone discovers the endpoint
//      is enabled, they can't reset passwords without this token. The owner
//      generates it themselves (any random string) + sets it in Vercel env.
//   3. Email existence check — the endpoint refuses to reset a password for
//      an email that doesn't exist in the DB. It does NOT reveal which emails
//      exist (returns the same error for "wrong token" and "user not found").
//   4. audit() log entry — records every reset attempt (success OR failure)
//      with the target email + IP + user-agent. The owner can review this
//      later in the Audit Log.
//
// WHAT IT DOES:
//   - Takes { email, newPassword, token } in the POST body
//   - Validates the token matches PASSWORD_RESET_TOKEN env var
//   - Validates the new password meets the strength rules (12+ chars, mixed
//     case, digit, special char — same as registration)
//   - Looks up the user by email (case-insensitive)
//   - Hashes the new password with bcrypt (12 rounds, same as registration)
//   - Updates the user's passwordHash
//   - Returns { ok: true, email } on success — NEVER returns the hash
//
// WHAT IT DOES NOT DO:
//   - Does NOT expose password hashes (current or new) in any response
//   - Does NOT log the new password or the token anywhere
//   - Does NOT send an email (the owner already knows the new password —
//      they're typing it themselves)
//   - Does NOT change any other user field (role, email, org, etc.)
//   - Does NOT create a session — the owner must log in normally afterward
//
// AFTER USE: set PASSWORD_RESET_ENABLED=0 in Vercel env vars + redeploy to
// disable this endpoint. Also rotate or delete PASSWORD_RESET_TOKEN.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { audit } from "@/lib/audit";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";

const resetSchema = z.object({
  email: z.string().email("Invalid email"),
  newPassword: z.string().min(12, "Password must be at least 12 characters"),
  token: z.string().min(8, "Token is required"),
});

export async function POST(req: Request) {
  // ── Layer 1: kill-switch env var ───────────────────────────────────────
  if (process.env.PASSWORD_RESET_ENABLED !== "1") {
    return NextResponse.json(
      {
        error:
          "Password reset endpoint is disabled. Set PASSWORD_RESET_ENABLED=1 and PASSWORD_RESET_TOKEN=<your-secret> in Vercel env vars, redeploy, then retry. After resetting, set PASSWORD_RESET_ENABLED=0 to lock it down.",
        disabled: true,
      },
      { status: 403 },
    );
  }

  // ── Rate limit (same budget as auth — 10/min per IP) ───────────────────
  const ip = getClientIp(req);
  const limit = await authRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  // ── Parse + validate body ──────────────────────────────────────────────
  const body = await req.json().catch((): null => null);
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    // Don't reveal which field failed — return a generic error.
    return NextResponse.json(
      { error: "Invalid request. Required fields: email, newPassword (min 12 chars), token." },
      { status: 400 },
    );
  }
  const { email, newPassword, token } = parsed.data;

  // ── Layer 2: token must match the env var ──────────────────────────────
  const expectedToken = process.env.PASSWORD_RESET_TOKEN;
  if (!expectedToken || expectedToken.length < 8) {
    // Server misconfigured — the owner forgot to set PASSWORD_RESET_TOKEN.
    return NextResponse.json(
      {
        error:
          "Server misconfigured: PASSWORD_RESET_TOKEN env var is not set or too short. Set it to a random string of at least 16 characters, redeploy, then retry.",
      },
      { status: 500 },
    );
  }
  // Constant-time-ish comparison (not cryptographic, but adequate for a
  // temporary admin endpoint that gets disabled after one use).
  if (token !== expectedToken) {
    // Same error message as "user not found" to avoid leaking info.
    await audit(
      {
        action: "admin.password_reset.failed",
        entity: "user",
        details: { email, reason: "invalid_token" },
      },
      req,
    );
    return NextResponse.json(
      { error: "Reset failed. Check your token and email and try again." },
      { status: 401 },
    );
  }

  // ── Layer 3: validate new password strength ────────────────────────────
  const strength = validatePasswordStrength(newPassword);
  if (!strength.ok) {
    return NextResponse.json(
      { error: strength.reason ?? "Password does not meet strength requirements." },
      { status: 400 },
    );
  }

  // ── Look up the user by email (case-insensitive) ───────────────────────
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, name: true, role: true, organizationId: true },
  });

  if (!user) {
    // Same error as invalid token — don't reveal which emails exist.
    await audit(
      {
        action: "admin.password_reset.failed",
        entity: "user",
        details: { email, reason: "user_not_found" },
      },
      req,
    );
    return NextResponse.json(
      { error: "Reset failed. Check your token and email and try again." },
      { status: 401 },
    );
  }

  // ── Hash the new password + update ─────────────────────────────────────
  try {
    const newHash = await hashPassword(newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    // Audit log — record success. Do NOT log the password or the token.
    await audit(
      {
        action: "admin.password_reset.success",
        entity: "user",
        entityId: user.id,
        details: {
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      req,
    );

    return NextResponse.json({
      ok: true,
      message: `Password reset successful for ${user.email} (${user.name}, role: ${user.role}). You can now log in with the new password. Remember to disable this endpoint afterward.`,
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err: any) {
    await audit(
      {
        action: "admin.password_reset.failed",
        entity: "user",
        entityId: user.id,
        details: { email: user.email, reason: "db_error" },
      },
      req,
    );
    return NextResponse.json(
      { error: "Reset failed due to a server error. Please try again." },
      { status: 500 },
    );
  }
}

// GET — returns whether the endpoint is enabled, WITHOUT doing anything.
// Useful for the owner to check status before triggering the POST.
export async function GET() {
  return NextResponse.json({
    enabled: process.env.PASSWORD_RESET_ENABLED === "1",
    tokenConfigured: !!process.env.PASSWORD_RESET_TOKEN && process.env.PASSWORD_RESET_TOKEN.length >= 8,
    message:
      process.env.PASSWORD_RESET_ENABLED === "1"
        ? "Endpoint is ENABLED. POST with { email, newPassword, token } to reset a password."
        : "Endpoint is DISABLED. Set PASSWORD_RESET_ENABLED=1 + PASSWORD_RESET_TOKEN=<your-secret> in Vercel env vars + redeploy to enable.",
  });
}
