// =============================================================================
// /api/matters/[id]/documents — STUB (real route ships in Turn 3)
// Returns an empty list for now so Header's notification loader doesn't crash.
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

  // Stub — real document list returns in Turn 3
  return NextResponse.json([]);
}
