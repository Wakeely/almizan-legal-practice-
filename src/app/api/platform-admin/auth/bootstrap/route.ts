// =============================================================================
// POST /api/platform-admin/auth/bootstrap
// -----------------------------------------------------------------------------
// PRD v0.3 §9: One-shot token-gated creation of the FIRST PlatformAdmin.
//
// SECURITY (4 layers, mirrors the existing /api/admin/reset-user-password pattern):
//   1. PLATFORM_ADMIN_BOOTSTRAP_ENABLED=1 env var — kill-switch. Defaults off.
//   2. PLATFORM_ADMIN_BOOTSTRAP_TOKEN — one-time bearer token in the request
//      body. Must be >= 16 chars.
//   3. REFUSES if any PlatformAdmin already exists (one-shot). Even if the
//      kill-switch is re-enabled later, this endpoint will not run again.
//   4. audit() entry — records the bootstrap with the new admin's id + IP.
//
// AFTER USE: set PLATFORM_ADMIN_BOOTSTRAP_ENABLED=0 + redeploy to lock this
// endpoint down. Also rotate or delete PLATFORM_ADMIN_BOOTSTRAP_TOKEN.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { platformAudit } from "@/lib/audit";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";

const bootstrapSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().min(1, "Name is required").max(120),
  password: z.string().min(12, "Password must be at least 12 characters"),
  token: z.string().min(16, "Token is required (min 16 characters)"),
});

export async function POST(req: Request) {
  // ── Layer 1: kill-switch ───────────────────────────────────────────────
  if (process.env.PLATFORM_ADMIN_BOOTSTRAP_ENABLED !== "1") {
    return NextResponse.json(
      {
        error:
          "Bootstrap is disabled. Set PLATFORM_ADMIN_BOOTSTRAP_ENABLED=1 and PLATFORM_ADMIN_BOOTSTRAP_TOKEN=<your-secret> in env vars, redeploy, then retry. After bootstrapping, set ENABLED=0 to lock it down.",
        disabled: true,
      },
      { status: 403 },
    );
  }

  // ── Rate limit ──────────────────────────────────────────────────────────
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
  const parsed = bootstrapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request. Required: email, name, password (min 12 chars), token (min 16 chars)." },
      { status: 400 },
    );
  }
  const { email, name, password, token } = parsed.data;

  // ── Layer 2: token must match env var ──────────────────────────────────
  const expectedToken = process.env.PLATFORM_ADMIN_BOOTSTRAP_TOKEN;
  if (!expectedToken || expectedToken.length < 16) {
    return NextResponse.json(
      {
        error:
          "Server misconfigured: PLATFORM_ADMIN_BOOTSTRAP_TOKEN is not set or too short. Set it to a random string of at least 16 characters, redeploy, then retry.",
      },
      { status: 500 },
    );
  }
  if (token !== expectedToken) {
    return NextResponse.json(
      { error: "Bootstrap failed. Check your token." },
      { status: 401 },
    );
  }

  // ── Layer 3: refuse if any PlatformAdmin already exists (one-shot) ─────
  const existingCount = await db.platformAdmin.count();
  if (existingCount > 0) {
    return NextResponse.json(
      {
        error:
          "Bootstrap refused: a PlatformAdmin already exists. Bootstrap is one-shot. Use an existing Super Admin account to create additional admins from the dashboard.",
      },
      { status: 409 },
    );
  }

  // ── Validate password strength ─────────────────────────────────────────
  const strength = validatePasswordStrength(password);
  if (!strength.ok) {
    return NextResponse.json(
      { error: strength.reason ?? "Password does not meet strength requirements." },
      { status: 400 },
    );
  }

  // ── Create the first PlatformAdmin ─────────────────────────────────────
  const passwordHash = await hashPassword(password);
  const admin = await db.platformAdmin.create({
    data: {
      email: email.toLowerCase(),
      name,
      passwordHash,
      role: "super_admin",
      createdByBootstrap: true,
    },
    select: { id: true, email: true, name: true, role: true },
  });

  // ── Layer 4: audit log (organizationId = null — platform-only action) ──
  await platformAudit(
    {
      action: "platform_admin.bootstrap",
      entity: "platform_admin",
      entityId: admin.id,
      organizationId: null, // PRD v0.3 §6: platform-only action
      platformAdminId: admin.id,
      details: {
        email: admin.email,
        name: admin.name,
        method: "one_shot_token",
        ip,
      },
    },
    req,
  );

  return NextResponse.json(
    {
      ok: true,
      message:
        "Bootstrap successful. Sign in at /platform-admin with the new credentials. IMPORTANT: set PLATFORM_ADMIN_BOOTSTRAP_ENABLED=0 and redeploy to lock this endpoint down.",
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    },
    { status: 201 },
  );
}

// GET — returns bootstrap state WITHOUT doing anything. Useful for checking
// whether bootstrap is available before attempting the POST.
export async function GET() {
  const count = await db.platformAdmin.count();
  return NextResponse.json({
    enabled: process.env.PLATFORM_ADMIN_BOOTSTRAP_ENABLED === "1",
    tokenConfigured:
      !!process.env.PLATFORM_ADMIN_BOOTSTRAP_TOKEN &&
      process.env.PLATFORM_ADMIN_BOOTSTRAP_TOKEN.length >= 16,
    firstAdminExists: count > 0,
    message:
      process.env.PLATFORM_ADMIN_BOOTSTRAP_ENABLED === "1"
        ? count > 0
          ? "Bootstrap is ENABLED but a PlatformAdmin already exists — POST will be refused (one-shot)."
          : "Bootstrap is ENABLED. POST with { email, name, password, token } to create the first admin."
        : "Bootstrap is DISABLED. Set PLATFORM_ADMIN_BOOTSTRAP_ENABLED=1 + PLATFORM_ADMIN_BOOTSTRAP_TOKEN in env vars + redeploy to enable.",
  });
}
