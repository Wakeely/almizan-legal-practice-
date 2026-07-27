// =============================================================================
// GET /api/client-portal/matters/[id]/documents — SERVER-FILTERED list
// -----------------------------------------------------------------------------
// SECURITY (per master system prompt rule #4):
// "Client portal data must be filtered server-side to only records marked
//  visible to the client. Never rely on the frontend to hide privileged
//  information."
//
// This endpoint returns ONLY documents where visibleToClient = true, even
// if the caller is the firm's own user. The client portal uses this endpoint
// to ensure no privileged information leaks to clients.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere, verifyMatterBelongsToOrg } from "@/lib/org";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  const owns = await verifyMatterBelongsToOrg(id, r.session);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // SERVER-SIDE FILTER: only visibleToClient === true
  const docs = await db.document.findMany({
    where: {
      matterId: id,
      visibleToClient: true,
      ...orgWhere(r.session),
    },
    orderBy: { uploadedAt: "desc" },
  });

  return NextResponse.json(
    docs.map((d) => ({
      ...d,
      aiTags: d.aiTags ? JSON.parse(d.aiTags) : [],
    })),
  );
}
