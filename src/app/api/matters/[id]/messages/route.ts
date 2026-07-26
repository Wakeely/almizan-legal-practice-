// =============================================================================
// /api/matters/[id]/messages — STUB (real route ships in Turn 4 with
// ClientPortal + secure lawyer/client messaging)
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser, verifyMatterBelongsToOrg } from "@/lib/org";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  const owns = await verifyMatterBelongsToOrg(id, r.session);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Stub — real client messages return in Turn 4
  return NextResponse.json([]);
}
