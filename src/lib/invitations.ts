// =============================================================================
// Al Mizan — Invitation helpers (PRD v0.6 §5)
// -----------------------------------------------------------------------------
// Shared logic for teammate + client invitations:
//   • Token generation + hashing (same discipline as email verification)
//   • Seat-capacity check (teammates only — clients don't count against seats)
//   • Matter-access check (for client invites — inviter must have the matter)
//   • Invitation email (via existing Resend integration)
// =============================================================================

import "server-only";
import { db } from "@/lib/db";
import { generateVerifyToken, hashToken } from "@/lib/email";
import type { SendEmailResult } from "@/lib/email";

const NEXTAUTH_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";
const INVITATION_EXPIRY_DAYS = 7; // PRD §6: 7 days (longer than email-verify's 24h)

// ── Token + expiry ──────────────────────────────────────────────────────────
export function generateInvitationToken(): { rawToken: string; tokenHash: string; expiresAt: Date } {
  const rawToken = generateVerifyToken(); // 32-byte random hex
  const tokenHash = hashToken(rawToken);  // SHA-256 hash — raw never stored
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  return { rawToken, tokenHash, expiresAt };
}

export function buildInvitationAcceptUrl(rawToken: string): string {
  return `${NEXTAUTH_URL}/api/invitations/accept?token=${rawToken}`;
}

// ── Seat capacity (PRD v0.6 §5.4) ──────────────────────────────────────────
// Teammates count against the org's maxSeats. Clients do NOT (a client isn't
// a paid "seat" — PRD §8 Open Q1 recommendation).
export async function checkSeatCapacity(organizationId: string): Promise<{
  ok: boolean;
  activeUsers: number;
  maxSeats: number;
  remaining: number;
}> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { maxSeats: true },
  });
  if (!org) {
    return { ok: false, activeUsers: 0, maxSeats: 0, remaining: 0 };
  }
  // Count active (non-deleted) non-client users — clients don't count
  const activeUsers = await db.user.count({
    where: {
      organizationId,
      deletedAt: null,
      role: { not: "Client Representative" },
    },
  });
  const remaining = org.maxSeats - activeUsers;
  return { ok: remaining > 0, activeUsers, maxSeats: org.maxSeats, remaining };
}

// ── Matter access check (PRD v0.6 §4.2, §6) ────────────────────────────────
// For client invites: the inviter must be a member of the org AND the matter
// must belong to that org. The PRD says "any attorney with access to that
// specific matter" — the existing schema has `Matter.assignedTo` (a string
// field), but the most reliable org-level check is: the matter belongs to the
// inviter's org. A tighter per-matter-assignment check can be layered in
// later if `assignedTo` is reliably populated.
export async function canInviteClientToMatter(
  matterId: string,
  inviterOrgId: string,
): Promise<boolean> {
  const matter = await db.matter.findFirst({
    where: {
      id: matterId,
      organizationId: inviterOrgId,
      deletedAt: null,
    },
    select: { id: true },
  });
  return !!matter;
}

// ── Invitation email ─────────────────────────────────────────────────────────
interface InvitationEmailParams {
  to: string;
  inviterName: string;
  orgName: string;
  role: string;
  matterTitle?: string;
  acceptUrl: string;
}

export async function sendInvitationEmail(params: InvitationEmailParams): Promise<SendEmailResult> {
  const { to, inviterName, orgName, role, matterTitle, acceptUrl } = params;
  const isClient = role === "Client Representative";
  const subject = isClient
    ? `You're invited to view your case on Al Mizan — ${orgName}`
    : `You're invited to join ${orgName} on Al Mizan`;

  const roleLabel = isClient
    ? "view your case"
    : `join as ${role}`;

  const contextLine = matterTitle
    ? `<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">Case: <strong>${escapeHtml(matterTitle)}</strong></p>`
    : "";

  const html = `
<!DOCTYPE html>
<html dir="ltr" lang="en">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr>
    <td style="background:linear-gradient(135deg,#1e3a5f,#2d5a87);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">Al Mizan Legal Practice</h1>
      <p style="color:#b8d4f1;margin:8px 0 0;font-size:14px;">Invitation to ${escapeHtml(roleLabel)}</p>
    </td>
  </tr>
  <tr>
    <td style="padding:32px;">
      <p style="margin:0 0 16px;color:#334155;font-size:16px;line-height:1.6;">
        ${escapeHtml(inviterName)} has invited you to ${escapeHtml(roleLabel)} at <strong>${escapeHtml(orgName)}</strong>.
      </p>
      ${contextLine}
      <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
        Click the button below to accept the invitation and set up your account.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="background:#1e3a5f;border-radius:8px;text-align:center;">
            <a href="${acceptUrl}"
               style="display:inline-block;padding:14px 32px;color:#fff;text-decoration:none;font-weight:600;font-size:15px;border-radius:8px;">
              Accept Invitation
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:20px 0 0;color:#94a3b8;font-size:13px;text-align:center;">
        Or copy and paste this link:<br>
        <span style="word-break:break-all;color:#64748b;">${acceptUrl}</span>
      </p>
      <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">
        This invitation expires in ${INVITATION_EXPIRY_DAYS} days. If you weren't expecting this invitation, you can safely ignore this email.
      </p>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = `
Al Mizan Legal Practice — Invitation

${inviterName} has invited you to ${roleLabel} at ${orgName}.
${matterTitle ? `Case: ${matterTitle}` : ""}

Accept the invitation:
${acceptUrl}

This invitation expires in ${INVITATION_EXPIRY_DAYS} days.
`;

  // Reuse the existing Resend client
  const { sendInvitationEmailInternal } = await import("@/lib/email");
  return sendInvitationEmailInternal({ to, subject, html, text });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
