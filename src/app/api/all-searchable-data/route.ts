// =============================================================================
// GET /api/all-searchable-data — bulk aggregator used by GlobalSearchModal
// -----------------------------------------------------------------------------
// Returns all matters + documents + tasks for the user's org in a single
// round-trip. Used by the reference GlobalSearchModal to build a client-side
// search index for instant search-as-you-type.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";

export async function GET() {
  const r = await requireUser();
  if (!r.ok) return r.response;

  const [matters, documents, tasks] = await Promise.all([
    db.matter.findMany({
      where: orgWhere(r.session),
      select: { id: true, title: true, clientName: true, jurisdiction: true, status: true },
    }),
    db.document.findMany({
      where: orgWhere(r.session),
      select: { id: true, name: true, category: true, matterId: true, uploadedBy: true },
    }),
    db.task.findMany({
      where: orgWhere(r.session),
      select: { id: true, title: true, assignedTo: true, status: true, priority: true, matterId: true },
    }),
  ]);

  return NextResponse.json({
    matters,
    documents,
    tasks,
    total: matters.length + documents.length + tasks.length,
  });
}
