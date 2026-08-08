// =============================================================================
// DELETE /api/matters/[id]/assignments/[userId] — remove an attorney from a matter
// -----------------------------------------------------------------------------
// Managing Partner (owner-override) or an already-assigned attorney can remove.
// You can't remove yourself if you're the only assigned attorney (prevents
// locking everyone out of the matter's client-invite flow).
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, verifyMatterBelongsToOrg } from "@/lib/org";
import { audit } from "@/lib/audit";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const r = await requireUser();
  if (r.ok === false) return r.response;
  const { id: matterId, userId } = await params;

  const owns = await verifyMatterBelongsToOrg(matterId, r.session);
  if (!owns) return NextResponse.json({ error: "Matter not found." }, { status: 404 });

  // Permission: Managing Partner or already-assigned attorney
  if (r.session.role !== "Managing Partner") {
    const selfAssignment = await db.matterAssignment.findUnique({
      where: { matterId_userId: { matterId, userId: r.session.id } },
      select: { id: true },
    });
    if (!selfAssignment) {
      return NextResponse.json(
        { error: "Only assigned attorneys or the Managing Partner can manage assignments." },
        { status: 403 },
      );
    }
  }

  const assignment = await db.matterAssignment.findUnique({
    where: { matterId_userId: { matterId, userId } },
  });
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }

  // Prevent removing the last assigned attorney (would lock out client invites
  // for non-Managing-Partners). The Managing Partner can still invite via
  // owner-override, but this guard keeps the matter manageable.
  const count = await db.matterAssignment.count({ where: { matterId } });
  if (count <= 1) {
    return NextResponse.json(
      { error: "Cannot remove the last assigned attorney. Assign someone else first." },
      { status: 409 },
    );
  }

  await db.matterAssignment.delete({ where: { id: assignment.id } });

  await audit(
    {
      action: "matter.assignment_remove",
      entity: "matter_assignment",
      entityId: assignment.id,
      matterId,
      details: { userId },
    },
    req,
  );

  return NextResponse.json({ ok: true });
}
