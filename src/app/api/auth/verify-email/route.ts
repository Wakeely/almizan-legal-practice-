// =============================================================================
// POST/GET /api/auth/verify-email
// -----------------------------------------------------------------------------
// Verifies a user's email address using a token sent during registration.
//
// Accepts:
//   - POST with JSON body { email, token }
//   - GET with query params ?token=TOKEN&email=EMAIL (for link clicks)
//
// SECURITY:
// - Rate-limited per IP
// - Token is SHA-256 hashed in DB — we hash the incoming token and compare
// - Token expires after 24 hours
// - Sets emailVerified = now() on success, clears token fields
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { hashToken } from "@/lib/email";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = await authRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please retry shortly." },
      { status: 429 },
    );
  }

  let email: string;
  let token: string;

  try {
    const body = await req.json();
    email = body.email?.toLowerCase()?.trim();
    token = body.token?.trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !token) {
    return NextResponse.json({ error: "Email and token are required" }, { status: 400 });
  }

  return await verifyEmailToken(email, token, req);
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const limit = await authRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please retry shortly." },
      { status: 429 },
    );
  }

  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.toLowerCase()?.trim();
  const token = url.searchParams.get("token")?.trim();

  if (!email || !token) {
    // Redirect to home with error for GET requests (link clicks)
    const redirectUrl = new URL("/", url.origin);
    redirectUrl.searchParams.set("verify", "error");
    redirectUrl.searchParams.set("message", "missing_params");
    return NextResponse.redirect(redirectUrl);
  }

  const result = await verifyEmailToken(email, token, req);

  // For GET requests (link clicks), redirect to verify-email page with result
  if (result.status === 200) {
    const redirectUrl = new URL("/verify-email", url.origin);
    redirectUrl.searchParams.set("verify", "success");
    redirectUrl.searchParams.set("email", encodeURIComponent(email));
    return NextResponse.redirect(redirectUrl);
  } else {
    const redirectUrl = new URL("/verify-email", url.origin);
    redirectUrl.searchParams.set("verify", "error");
    const errorData = await result.clone().json().catch(() => ({ error: "Verification failed" }));
    redirectUrl.searchParams.set("message", errorData.error || "unknown_error");
    return NextResponse.redirect(redirectUrl);
  }
}

async function verifyEmailToken(email: string, token: string, req: Request): Promise<NextResponse> {
  // Find user by email
  const user = await db.user.findUnique({
    where: { email },
    include: { organization: true },
  });

  if (!user) {
    // Don't reveal whether email exists — generic error
    return NextResponse.json({ error: "Invalid or expired verification link" }, { status: 400 });
  }

  // Check if already verified
  if (user.emailVerified) {
    return NextResponse.json({ ok: true, message: "Email already verified" }, { status: 200 });
  }

  // Check token exists and hasn't expired
  if (!user.emailVerifyToken || !user.emailVerifyExpires) {
    return NextResponse.json({ error: "No verification pending. Request a new verification email." }, { status: 400 });
  }

  if (new Date() > new Date(user.emailVerifyExpires)) {
    // Clear expired token
    await db.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: null, emailVerifyExpires: null },
    });
    return NextResponse.json({ error: "Verification link has expired. Request a new one." }, { status: 400 });
  }

  // Compare hashed tokens
  const tokenHash = hashToken(token);
  if (tokenHash !== user.emailVerifyToken) {
    return NextResponse.json({ error: "Invalid or expired verification link" }, { status: 400 });
  }

  // ── Success: Mark as verified ────────────────────────────────────────────
  await db.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
      emailVerifyToken: null,
      emailVerifyExpires: null,
    },
  });

  // Audit the verification
  await audit(
    { action: "auth.email.verified", entity: "user", entityId: user.id, details: { email: user.email } },
    req,
    { userId: user.id, organizationId: user.organizationId },
  );

  return NextResponse.json({ ok: true, message: "Email verified successfully" }, { status: 200 });
}
