// =============================================================================
// POST /api/matters/[id]/client-invitations — invite a client to this matter
// GET  /api/matters/[id]/client-invitations — list client invites for this matter
// -----------------------------------------------------------------------------
// PRD v0.6 §4.2: any attorney with access to the matter (i.e. any member of
// the org that owns the matter) can invite a client. Role is hard-coded to
// "Client Representative" server-side — never accepted as client input.
// matterId is fixed by the URL, never client-supplied.
//
// Client invites do NOT count against the org's seat limit (PRD §8 Open Q1).
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, verifyMatterBelongsToOrg } from "@/lib/org";
import { audit } from "@/lib/audit";
import {
  generateInvitationToken,
  buildInvitationAcceptUrl,
  sendInvitationEmail,
} from "@/lib/invitations";

const createSchema = z.object({
  email: z.string().email("Invalid email"),
  // name is optional — the client sets it at acceptance. But we allow the
  // inviter to pre-fill it for the email greeting.
  clientName: z.string().max(200).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (r.ok === false) return r.response;
  const { id: matterId } = await params;

  // Verify the matter belongs to the caller's org
  const owns = await verifyMatterBelongsToOrg(matterId, r.session);
  if (!owns) {
    return NextResponse.json({ error: "Matter not found." }, { status: 404 });
  }

  const body = await req.json().catch((): null => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { email, clientName } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  // Load the matter for the email context + to get clientName/email if not provided
  const matter = await db.matter.findFirst({
    where: { id: matterId, organizationId: r.session.organizationId, deletedAt: null },
    select: { id: true, title: true, clientName: true, clientEmail: true },
  });
  if (!matter) {
    return NextResponse.json({ error: "Matter not found." }, { status: 404 });
  }

  // Check for an existing pending client invitation to the same email for this matter
  const existingPending = await db.invitation.findFirst({
    where: {
      organizationId: r.session.organizationId,
      matterId,
      email: normalizedEmail,
      status: "pending",
    },
    select: { id: true },
  });
  if (existingPending) {
    return NextResponse.json(
      { error: "A pending client invitation already exists for this email on this matter." },
      { status: 409 },
    );
  }

  // Check the email isn't already a Client Representative on this matter
  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, organizationId: true, primaryMatterId: true, role: true },
  });
  if (existingUser && existingUser.organizationId === r.session.organizationId && existingUser.primaryMatterId === matterId) {
    return NextResponse.json(
      { error: "This client is already invited to this matter." },
      { status: 409 },
    );
  }

  // Create the invitation
  const { rawToken, tokenHash, expiresAt } = generateInvitationToken();
  const org = await db.organization.findUnique({
    where: { id: r.session.organizationId },
    select: { name: true },
  });

  const invitation = await db.invitation.create({
    data: {
      organizationId: r.session.organizationId,
      email: normalizedEmail,
      role: "Client Representative", // hard-coded server-side
      matterId, // matter-scoped
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
    role: "Client Representative",
    matterTitle: matter.title,
    acceptUrl,
  });

  await audit(
    {
      action: "matter.client_invite",
      entity: "invitation",
      entityId: invitation.id,
      matterId,
      details: {
        email: normalizedEmail,
        matterTitle: matter.title,
        emailSent: emailResult.ok,
      },
    },
    req,
  );

  return NextResponse.json(
    {
      ok: true,
      invitation: { id: invitation.id, email: normalizedEmail, role: "Client Representative", matterId, status: "pending", expiresAt: expiresAt.toISOString() },
      emailSent: emailResult.ok,
      ...(emailResult.ok ? {} : { warning: "Invitation created but email failed to send. Share the link manually." }),
    },
    { status: 201 },
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (r.ok === false) return r.response;
  const { id: matterId } = await params;

  const owns = await verifyMatterBelongsToOrg(matterId, r.session);
  if (!owns) {
    return NextResponse.json({ error: "Matter not found." }, { status: 404 });
  }

  const invitations = await db.invitation.findMany({
    where: {
      organizationId: r.session.organizationId,
      matterId,
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
