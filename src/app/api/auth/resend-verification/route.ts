// =============================================================================
// POST /api/auth/resend-verification
// -----------------------------------------------------------------------------
// Resends a verification email to an unverified user.
//
// SECURITY:
// - Rate-limited per IP (same as register/login)
// - Does NOT reveal whether an email exists in the system — always returns ok: true
//   to prevent email enumeration attacks (same pattern as password reset)
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  generateVerifyToken,
  hashToken,
  buildVerifyUrl,
  sendVerificationEmail,
} from "@/lib/email";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = await authRateLimit(ip);
  if (!limit.ok) {
    // Still return ok:true but with a hint about rate limiting
    // This prevents enumeration while being honest about limits
    return NextResponse.json(
      { ok: true, message: "If the email is registered and unverified, a link will be sent shortly." },
      { status: 200 },
    );
  }

  let email: string;
  try {
    const body = await req.json();
    email = body.email?.toLowerCase()?.trim();
  } catch {
    // Return success anyway to prevent enumeration
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (!email) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  try {
    // Find user by email — don't reveal existence
    const user = await db.user.findUnique({
      where: { email },
    });

    // Only resend if user exists AND is not yet verified
    if (user && !user.emailVerified) {
      // Generate new token
      const rawToken = generateVerifyToken();
      const tokenHash = hashToken(rawToken);
      const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await db.user.update({
        where: { id: user.id },
        data: {
          emailVerifyToken: tokenHash,
          emailVerifyExpires: verifyExpires,
        },
      });

      const verifyUrl = buildVerifyUrl(rawToken, user.email);

      // Attempt to send — failure is logged but doesn't affect response
      await sendVerificationEmail({
        to: user.email,
        name: user.name,
        verifyUrl,
      }).catch((err) => {
        console.error("[resend-verification] Failed to send:", err);
      });
    }

    // Always return success to prevent email enumeration
    return NextResponse.json(
      {
        ok: true,
        message: "If the email is registered and unverified, a verification link has been sent.",
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[resend-verification] Error:", err);
    // Still return ok to prevent enumeration
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
