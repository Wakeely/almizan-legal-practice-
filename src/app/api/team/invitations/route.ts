// =============================================================================
// POST /api/team/invitations — create a teammate invitation
// GET  /api/team/invitations — list pending/past invitations for this org
// -----------------------------------------------------------------------------
// PRD v0.6 §4.1, §5.2: teammate invites are Managing-Partner-only.
// Roles: Senior Associate, In-House Counsel, Legal Executive.
// (Managing Partner is not handed out casually; Client Representative has its
// own matter-scoped flow.)
//
// Seat capacity is checked before creating the invite (PRD §5.4).
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, orgWhere } from "@/lib/org";
import { audit } from "@/lib/audit";
import {
  generateInvitationToken,
  buildInvitationAcceptUrl,
  checkSeatCapacity,
  sendInvitationEmail,
} from "@/lib/invitations";

const TEAMMATE_ROLES = ["Senior Associate", "In-House Counsel", "Legal Executive"];

const createSchema = z.object({
  email: z.string().email("Invalid email"),
  role: z.enum(["Senior Associate", "In-House Counsel", "Legal Executive"]),
});

export async function POST(req: Request) {
  const r = await requireRole(["Managing Partner"]);
  if (r.ok === false) return r.response;

  const body = await req.json().catch((): null => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { email, role } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  // ── Seat capacity check (PRD §5.4) ───────────────────────────────────────
  const capacity = await checkSeatCapacity(r.session.organizationId);
  if (!capacity.ok) {
    return NextResponse.json(
      {
        error: `Seat limit reached. Your organization has ${capacity.activeUsers}/${capacity.maxSeats} active seats. Remove a member or contact the platform admin to raise the limit.`,
      },
      { status: 409 },
    );
  }

  // ── Check for an existing pending invitation to the same email ──────────
  const existingPending = await db.invitation.findFirst({
    where: {
      organizationId: r.session.organizationId,
      email: normalizedEmail,
      status: "pending",
    },
    select: { id: true },
  });
  if (existingPending) {
    return NextResponse.json(
      { error: "A pending invitation already exists for this email. Revoke it first if you want to reissue." },
      { status: 409 },
    );
  }

  // ── Check the email isn't already a member of this org ──────────────────
  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, organizationId: true },
  });
  if (existingUser && existingUser.organizationId === r.session.organizationId) {
    return NextResponse.json(
      { error: "This email is already a member of your organization." },
      { status: 409 },
    );
  }

  // ── Create the invitation + send email ──────────────────────────────────
  const { rawToken, tokenHash, expiresAt } = generateInvitationToken();
  const org = await db.organization.findUnique({
    where: { id: r.session.organizationId },
    select: { name: true },
  });

  const invitation = await db.invitation.create({
    data: {
      organizationId: r.session.organizationId,
      email: normalizedEmail,
      role,
      matterId: null, // teammate invites are not matter-scoped
      tokenHash,
      invitedByUserId: r.session.id,
      expiresAt,
    },
  });

  const acceptUrl = buildInvitationAcceptUrl(rawToken);
  const emailResult = await sendInvitationEmail({
    to: normalizedEmail,
    inviterName: r.session.name,
    orgName: org?.name ?? "your firm",
    role,
    acceptUrl,
  });

  await audit(
    {
      action: "team.invite",
      entity: "invitation",
      entityId: invitation.id,
      details: { email: normalizedEmail, role, emailSent: emailResult.ok },
    },
    req,
  );

  return NextResponse.json(
    {
      ok: true,
      invitation: { id: invitation.id, email: normalizedEmail, role, status: "pending", expiresAt: expiresAt.toISOString() },
      emailSent: emailResult.ok,
      ...(emailResult.ok ? {} : { warning: "Invitation created but email failed to send. Share the link manually." }),
    },
    { status: 201 },
  );
}

export async function GET(req: Request) {
  const r = await requireRole(["Managing Partner"]);
  if (r.ok === false) return r.response;

  const invitations = await db.invitation.findMany({
    where: {
      ...orgWhere(r.session),
      matterId: null, // teammate invites only (client invites have matterId set)
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      acceptedAt: true,
      invitedByUserId: true,
    },
  });

  return NextResponse.json({ data: invitations });
}
