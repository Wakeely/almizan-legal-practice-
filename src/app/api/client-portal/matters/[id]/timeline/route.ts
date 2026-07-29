// =============================================================================
// GET /api/client-portal/matters/[id]/timeline — SERVER-FILTERED timeline
// -----------------------------------------------------------------------------
// SECURITY: returns ONLY timeline events where visibleToClient = true.
// Client portal must never see internal-only events.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere, verifyMatterBelongsToOrg } from "@/lib/org";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (r.ok === false) return r.response;
  const { id } = await params;

  const owns = await verifyMatterBelongsToOrg(id, r.session);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // SERVER-SIDE FILTER: only visibleToClient === true
  const events = await db.timelineEvent.findMany({
    where: {
      matterId: id,
      visibleToClient: true,
      ...orgWhere(r.session),
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(events);
}
