// =============================================================================
// Al Mizan — Platform Admin auth + session helpers
// -----------------------------------------------------------------------------
// PRD v0.3 §1: Platform Super Admin is NOT a tenant User with a special role.
// This module is the SOLE entry point for cross-org authorization. It lives
// parallel to src/lib/org.ts (requireUser / requireRole / orgWhere) and is
// NEVER imported by any existing /api/* route — only by /api/platform-admin/*.
//
// SESSION DESIGN:
// - Separate cookie name: `almizan.platform-admin-token` (distinct from the
//   tenant `almizan.session-token` set by NextAuth). The two sessions never
//   collide — a tenant user and a platform admin can be signed in
//   simultaneously in the same browser without identity bleed.
// - The cookie value is a JWT signed with NEXTAUTH_SECRET (same secret, different
//   cookie name + different payload shape so a tenant JWT can't be replayed as
//   a platform-admin JWT and vice versa).
// - 8-hour max age (short session — PRD v0.3 §4 compensates for no MFA in v1).
// - HttpOnly + SameSite=Lax + Secure in production.
//
// MFA (PRD v0.3 §4):
// - Phase 1 ships WITHOUT real TOTP. The login screen shows a 6-digit
//   placeholder field but this module does NOT verify it. Real TOTP +
//   recovery codes are mandatory before impersonation / break-glass ship.
// - The mfaEnabled / mfaSecretEncrypted columns exist on PlatformAdmin so the
//   future rollout doesn't require another migration.
// =============================================================================

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ── Secret ────────────────────────────────────────────────────────────────
// Reuse NEXTAUTH_SECRET (already required by the tenant auth path). If a
// separate secret is desired later, add PLATFORM_ADMIN_SECRET and fall back.
const _SECRET = process.env.NEXTAUTH_SECRET;
if (!_SECRET) {
  throw new Error(
    "[platform-admin] FATAL: NEXTAUTH_SECRET is not set. Platform admin auth cannot operate.",
  );
}
// Non-null assertion is safe — the throw above guarantees _SECRET is a string.
const SECRET: string = _SECRET;

// ── Cookie config ─────────────────────────────────────────────────────────
export const PLATFORM_ADMIN_COOKIE = "almizan.platform-admin-token";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

// ── Session payload ───────────────────────────────────────────────────────
export interface PlatformAdminSession {
  adminId: string;
  email: string;
  name: string;
  role: string; // 'super_admin' | 'ops_admin'
}

interface TokenPayload extends PlatformAdminSession {
  iat: number;
  exp: number;
}

// ── Token sign / verify (HMAC-SHA256, no external deps) ───────────────────
// Format: base64url(jsonPayload).base64url(hmacSignature)
// This is functionally a compact JWT without the header overhead. The signature
// is computed over the payload string, so any tampering is detected.
function b64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

function signSession(payload: PlatformAdminSession): string {
  const now = Math.floor(Date.now() / 1000);
  const full: TokenPayload = {
    ...payload,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };
  const payloadJson = JSON.stringify(full);
  const payloadB64 = b64url(payloadJson);
  const sig = createHmac("sha256", SECRET).update(payloadB64).digest();
  const sigB64 = b64url(sig);
  return `${payloadB64}.${sigB64}`;
}

function verifySession(token: string): PlatformAdminSession | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;

  // Verify signature (constant-time comparison)
  const expectedSig = createHmac("sha256", SECRET).update(payloadB64).digest();
  let providedSig: Buffer;
  try {
    providedSig = Buffer.from(sigB64, "base64url");
  } catch {
    return null;
  }
  if (providedSig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(providedSig, expectedSig)) return null;

  // Decode payload
  let payload: TokenPayload;
  try {
    const json = Buffer.from(payloadB64, "base64url").toString("utf8");
    payload = JSON.parse(json);
  } catch {
    return null;
  }

  // Check expiry
  if (!payload.exp || Math.floor(Date.now() / 1000) >= payload.exp) return null;
  if (!payload.adminId || !payload.email || !payload.role) return null;

  return {
    adminId: payload.adminId,
    email: payload.email,
    name: payload.name,
    role: payload.role,
  };
}

// ── Cookie read / write / clear ───────────────────────────────────────────
export async function setPlatformAdminCookie(payload: PlatformAdminSession): Promise<void> {
  const token = signSession(payload);
  const store = await cookies();
  store.set(PLATFORM_ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearPlatformAdminCookie(): Promise<void> {
  const store = await cookies();
  store.delete(PLATFORM_ADMIN_COOKIE);
}

async function readPlatformAdminCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(PLATFORM_ADMIN_COOKIE)?.value;
}

// ── The gate ──────────────────────────────────────────────────────────────
/**
 * requirePlatformAdmin()
 *
 * The SOLE authorization gate for every /api/platform-admin/* route.
 * Returns the session on success, or a 401 NextResponse on failure.
 *
 * Usage:
 *   const r = await requirePlatformAdmin();
 *   if (r.ok === false) return r.response;
 *   // r.session.adminId, r.session.email, r.session.role
 */
export async function requirePlatformAdmin(): Promise<
  { ok: true; session: PlatformAdminSession } | { ok: false; response: NextResponse }
> {
  const token = await readPlatformAdminCookie();
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized — platform admin session required." },
        { status: 401 },
      ),
    };
  }

  const payload = await verifySession(token);
  if (!payload) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized — invalid or expired platform admin session." },
        { status: 401 },
      ),
    };
  }

  // Verify the admin still exists and is not disabled. (Phase 1 has no
  // disabled flag, but this guards against deleted-admin token reuse.)
  const admin = await db.platformAdmin.findUnique({
    where: { id: payload.adminId },
    select: { id: true, email: true, role: true },
  });
  if (!admin || admin.email.toLowerCase() !== payload.email.toLowerCase()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized — platform admin no longer exists." },
        { status: 401 },
      ),
    };
  }

  return {
    ok: true,
    session: {
      adminId: admin.id,
      email: admin.email,
      name: payload.name,
      role: admin.role,
    },
  };
}

/**
 * Convenience: returns the session or null (no response). Useful in server
 * components / layout files that render UI rather than return JSON.
 */
export async function getPlatformAdminSession(): Promise<PlatformAdminSession | null> {
  const token = await readPlatformAdminCookie();
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  const admin = await db.platformAdmin.findUnique({
    where: { id: payload.adminId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!admin) return null;
  return {
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
  };
}

// ── Bootstrap state (PRD v0.3 §9) ─────────────────────────────────────────
export interface BootstrapState {
  enabled: boolean;
  tokenConfigured: boolean;
  firstAdminExists: boolean;
}

export async function getBootstrapState(): Promise<BootstrapState> {
  const enabled = process.env.PLATFORM_ADMIN_BOOTSTRAP_ENABLED === "1";
  const tokenConfigured =
    !!process.env.PLATFORM_ADMIN_BOOTSTRAP_TOKEN &&
    process.env.PLATFORM_ADMIN_BOOTSTRAP_TOKEN.length >= 16;
  const count = await db.platformAdmin.count();
  return { enabled, tokenConfigured, firstAdminExists: count > 0 };
}
