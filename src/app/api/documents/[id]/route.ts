// =============================================================================
// /api/documents/[id] — STUB PATCH handler (real route ships in Turn 3)
// Header uses this to mark a document as "reviewed" in the notification panel.
// For Turn 2, returns 200 OK without persistence.
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/org";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));

  // Stub — real document update + audit ships in Turn 3
  return NextResponse.json({ ok: true, id, ...body, _stub: true });
}
