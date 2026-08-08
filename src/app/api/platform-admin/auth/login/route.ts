// =============================================================================
// POST /api/platform-admin/auth/login
// -----------------------------------------------------------------------------
// Platform admin login. Sets a SEPARATE cookie (almizan.platform-admin-token)
// distinct from the tenant NextAuth cookie. The two sessions never collide.
//
// PRD v0.4 §2.1 (Phase 2): MFA is now REAL. When the admin has mfaEnabled,
// the `mfa` field is verified as a TOTP code (±1 window for clock drift) OR
// as a single-use recovery code (matched against the hashed
// PlatformAdminRecoveryCode rows). When mfaEnabled is false, the `mfa` field
// is still accepted but not verified — this is the transitional state while
// enrollment is being rolled out. The dashboard will force-enroll before
// allowing impersonation / break-glass.
//
// SECURITY: strong password (bcrypt 12 rounds) + strict rate limit (10/min/IP)
// + 8-hour short session + real TOTP when enrolled.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";
import { setPlatformAdminCookie } from "@/lib/platform-admin";
import { platformAudit } from "@/lib/audit";
import { verifyTotp } from "@/lib/totp";
import { decryptSecret } from "@/lib/ai-keys";

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
  mfa: z.string().optional(),
});

function hashRecoveryCode(code: string): string {
  // Normalize: uppercase, strip dashes/spaces
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return createHash("sha256").update(normalized).digest("hex");
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
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { email, password, mfa } = parsed.data;

  const admin = await db.platformAdmin.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!admin) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const ok = await verifyPassword(password, admin.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  // ── MFA verification (Phase 2 §2.1) ─────────────────────────────────────
  let mfaVerified = false;
  let mfaMethod: "none" | "totp" | "recovery" | "skipped" = "none";

  if (admin.mfaEnabled) {
    if (!mfa) {
      return NextResponse.json(
        { error: "MFA code required.", mfaRequired: true },
        { status: 401 },
      );
    }

    // Try TOTP first (±1 window for clock drift)
    if (admin.mfaSecretEncrypted) {
      const secret = decryptSecret(admin.mfaSecretEncrypted);
      if (secret && verifyTotp(mfa, secret)) {
        mfaVerified = true;
        mfaMethod = "totp";
      }
    }

    // Fall back to recovery code lookup
    if (!mfaVerified) {
      const codeHash = hashRecoveryCode(mfa);
      const recovery = await db.platformAdminRecoveryCode.findUnique({
        where: { codeHash },
        select: { id: true, usedAt: true },
      });
      if (recovery && !recovery.usedAt) {
        await db.platformAdminRecoveryCode.update({
          where: { id: recovery.id },
          data: { usedAt: new Date() },
        });
        mfaVerified = true;
        mfaMethod = "recovery";
      }
    }

    if (!mfaVerified) {
      return NextResponse.json(
        { error: "Invalid MFA code.", mfaRequired: true },
        { status: 401 },
      );
    }
  } else {
    // Admin hasn't enrolled in MFA yet — accept any value (transitional).
    // The dashboard will prompt for enrollment; impersonation/break-glass
    // are blocked until mfaEnabled = true.
    mfaMethod = mfa ? "skipped" : "none";
  }

  // Update last-login metadata
  await db.platformAdmin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ip },
  });

  // Set the platform-admin session cookie
  await setPlatformAdminCookie({
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    mfaEnabled: admin.mfaEnabled,
  });

  // Audit log — platform-only action, organizationId = null (PRD v0.3 §6)
  await platformAudit(
    {
      action: "platform_admin.login",
      entity: "platform_admin",
      entityId: admin.id,
      organizationId: null,
      platformAdminId: admin.id,
      details: { email: admin.email, ip, mfa: mfaMethod },
    },
    req,
  );

  return NextResponse.json({
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      mfaEnabled: admin.mfaEnabled,
    },
  });
}
