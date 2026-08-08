// =============================================================================
// DELETE /api/matters/[id]/client-invitations/[invitationId] — revoke a client invite
// -----------------------------------------------------------------------------
// Any attorney in the org can revoke a pending client invite for a matter
// in their org (same authorization as creating one).
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, verifyMatterBelongsToOrg } from "@/lib/org";
import { audit } from "@/lib/audit";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; invitationId: string }> },
) {
  const r = await requireUser();
  if (r.ok === false) return r.response;
  const { id: matterId, invitationId } = await params;

  const owns = await verifyMatterBelongsToOrg(matterId, r.session);
  if (!owns) {
    return NextResponse.json({ error: "Matter not found." }, { status: 404 });
  }

  const invitation = await db.invitation.findFirst({
    where: {
      id: invitationId,
      organizationId: r.session.organizationId,
      matterId,
    },
  });
  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  }
  if (invitation.status !== "pending") {
    return NextResponse.json({ error: `Invitation is already ${invitation.status}.` }, { status: 409 });
  }

  await db.invitation.update({
    where: { id: invitationId },
    data: { status: "revoked" },
  });

  await audit(
    {
      action: "matter.client_invite_revoke",
      entity: "invitation",
      entityId: invitationId,
      matterId,
      details: { email: invitation.email },
    },
    req,
  );

  return NextResponse.json({ ok: true });
}
