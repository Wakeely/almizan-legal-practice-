// =============================================================================
// Email service — Resend API integration
// -----------------------------------------------------------------------------
// Sends transactional emails (verification, password reset) via Resend.
// Falls back gracefully when RESEND_API_KEY is not configured.
//
// ENV VARS:
//   RESEND_API_KEY  — Resend API key (https://resend.com/api-keys)
//   EMAIL_FROM      — Sender address (default: "Al Mizan <onboarding@resend.dev>")
//   NEXTAUTH_URL    — Used to build absolute verification links
// =============================================================================

import { createHash, randomBytes } from "crypto";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "Al Mizan <onboarding@resend.dev>";
const NEXTAUTH_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

export interface SendEmailResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

// ── Token generation & hashing ──────────────────────────────────────────────

/** Generate a cryptographically random hex token (32 bytes = 64 hex chars). */
export function generateVerifyToken(): string {
  return randomBytes(32).toString("hex");
}

/** Hash a token for storage — we never store raw tokens. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Build the verification URL that goes in the email. */
export function buildVerifyUrl(token: string, email: string): string {
  const encoded = encodeURIComponent(email);
  return `${NEXTAUTH_URL}/verify-email?token=${token}&email=${encoded}`;
}

// ── Resend API client ─────────────────────────────────────────────────────

async function resendSend(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendEmailResult> {
  if (!RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — email not sent");
    return { ok: false, error: "Email service not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.message || `Resend API error ${res.status}`;
      console.error("[email] Resend failed:", msg);
      return { ok: false, error: msg };
    }

    const data = await res.json();
    return { ok: true, messageId: data?.id };
  } catch (err: any) {
    console.error("[email] Network error:", err);
    return { ok: false, error: err.message || "Network error sending email" };
  }
}

// ── Verification email ─────────────────────────────────────────────────────

interface VerifyEmailParams {
  to: string;
  name: string;
  verifyUrl: string;
}

/**
 * Send an email verification link. Bilingual (English + Arabic).
 * Returns { ok: true } on success or { ok: false, error } on failure.
 */
export async function sendVerificationEmail({
  to,
  name,
  verifyUrl,
}: VerifyEmailParams): Promise<SendEmailResult> {
  const subject = "Verify your email — Al Mizan Legal Practice";
  const displayName = name || "there";

  const html = `
<!DOCTYPE html>
<html dir="ltr" lang="en">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr>
    <td style="background:linear-gradient(135deg,#1e3a5f,#2d5a87);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">Al Mizan Legal Practice</h1>
      <p style="color:#b8d4f1;margin:8px 0 0;font-size:14px;">Verify your email address</p>
    </td>
  </tr>
  <tr>
    <td style="padding:32px;">
      <p style="margin:0 0 16px;color:#334155;font-size:16px;line-height:1.6;">
        Hi ${displayName},
      </p>
      <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
        Thanks for registering with Al Mizan Legal Practice. Please verify your email
        address by clicking the button below. This helps us keep your account secure.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="background:#1e3a5f;border-radius:8px;text-align:center;">
            <a href="${verifyUrl}"
               style="display:inline-block;padding:14px 32px;color:#fff;text-decoration:none;font-weight:600;font-size:15px;border-radius:8px;">
              Verify Email Address
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:20px 0 0;color:#94a3b8;font-size:13px;text-align:center;">
        Or copy and paste this link into your browser:<br>
        <span style="word-break:break-all;color:#64748b;">${verifyUrl}</span>
      </p>
      <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">
        This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
      </p>
    </td>
  </tr>
  <tr>
    <td style="background:#f1f5f9;padding:16px 32px;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">
        &copy; ${new Date().getFullYear()} Al Mizan Legal Practice. All rights reserved.
      </p>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = `
Al Mizan Legal Practice — Verify Your Email

Hi ${displayName},

Thanks for registering with Al Mizan Legal Practice. Please verify your email address:

${verifyUrl}

This link expires in 24 hours.

If you didn't create an account, you can safely ignore this email.
`;

  return resendSend({ to, subject, html, text });
}

// ── Password reset email (stub for future use) ─────────────────────────────

/**
 * Send a password reset email. Currently stubbed — structure ready for implementation.
 * Returns { ok: false, error: "Password reset not yet implemented" }.
 */
export async function sendPasswordResetEmail(_params: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<SendEmailResult> {
  // TODO: Implement password reset email template and flow
  console.warn("[email] sendPasswordResetEmail called but not yet implemented");
  return { ok: false, error: "Password reset not yet implemented" };
}

// ── Internal generic sender (reused by invitations.ts) ──────────────────────

/**
 * Internal: send a pre-built email through the Resend client. Reused by
 * the invitation system so it doesn't need to duplicate the Resend HTTP
 * plumbing. Not exported outside the lib.
 */
export async function sendInvitationEmailInternal(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  return resendSend(params);
}
