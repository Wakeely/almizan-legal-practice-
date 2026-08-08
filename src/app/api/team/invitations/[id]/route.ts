// =============================================================================
// DELETE /api/team/invitations/[id] — revoke a pending teammate invitation
// -----------------------------------------------------------------------------
// PRD v0.6 §5.2, §6: revoking sets status to 'revoked'. The accept route
// checks status, not just token existence, so a revoked invite cannot be
// accepted even if the raw token is known.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, orgWhere } from "@/lib/org";
import { audit } from "@/lib/audit";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireRole(["Managing Partner"]);
  if (r.ok === false) return r.response;
  const { id } = await params;

  const invitation = await db.invitation.findFirst({
    where: { id, ...orgWhere(r.session), matterId: null },
  });
  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  }
  if (invitation.status !== "pending") {
    return NextResponse.json({ error: `Invitation is already ${invitation.status}.` }, { status: 409 });
  }

  await db.invitation.update({
    where: { id },
    data: { status: "revoked" },
  });

  await audit(
    {
      action: "team.invite_revoke",
      entity: "invitation",
      entityId: id,
      details: { email: invitation.email, role: invitation.role },
    },
    req,
  );

  return NextResponse.json({ ok: true });
}
