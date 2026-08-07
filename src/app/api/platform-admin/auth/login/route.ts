// =============================================================================
// POST /api/platform-admin/auth/login
// -----------------------------------------------------------------------------
// Platform admin login. Sets a SEPARATE cookie (almizan.platform-admin-token)
// distinct from the tenant NextAuth cookie. The two sessions never collide.
//
// PRD v0.3 §4: MFA is NOT active in Phase 1. The client may send an `mfa` field
// but this route does NOT verify it — any value (or none) is accepted. Real
// TOTP is mandatory before impersonation / break-glass ship.
//
// SECURITY: strong password (bcrypt 12 rounds) + strict rate limit (10/min/IP)
// + 8-hour short session. Compensates for no MFA in v1.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";
import { setPlatformAdminCookie } from "@/lib/platform-admin";
import { platformAudit } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
  mfa: z.string().optional(), // PRD v0.3 §4: placeholder, not verified in v1
});

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
  const { email, password } = parsed.data;

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
  });

  // Audit log — platform-only action, organizationId = null (PRD v0.3 §6)
  await platformAudit(
    {
      action: "platform_admin.login",
      entity: "platform_admin",
      entityId: admin.id,
      organizationId: null,
      platformAdminId: admin.id,
      details: { email: admin.email, ip, mfa: false },
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
