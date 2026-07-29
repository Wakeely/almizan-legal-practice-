// =============================================================================
// GET /api/all-searchable-data — bulk aggregator used by GlobalSearchModal
// -----------------------------------------------------------------------------
// Returns all matters + documents + tasks for the user's org in a single
// round-trip. Used by the reference GlobalSearchModal to build a client-side
// search index for instant search-as-you-type.
//
// PAGINATION: capped at 500 records per entity type to prevent DoS on very
// large organizations. The GlobalSearchModal client-side search works fine
// with 500 records; if an org exceeds this, they should use /api/search
// (server-side search with proper pagination) instead.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";

const MAX_PER_TYPE = 500;

export async function GET() {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const [matters, documents, tasks] = await Promise.all([
    db.matter.findMany({
      where: orgWhere(r.session),
      select: { id: true, title: true, clientName: true, jurisdiction: true, status: true },
      take: MAX_PER_TYPE,
      orderBy: { updatedAt: "desc" },
    }),
    db.document.findMany({
      where: orgWhere(r.session),
      select: { id: true, name: true, category: true, matterId: true, uploadedBy: true },
      take: MAX_PER_TYPE,
      orderBy: { uploadedAt: "desc" },
    }),
    db.task.findMany({
      where: orgWhere(r.session),
      select: { id: true, title: true, assignedTo: true, status: true, priority: true, matterId: true },
      take: MAX_PER_TYPE,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const total = matters.length + documents.length + tasks.length;
  const truncated = matters.length === MAX_PER_TYPE || documents.length === MAX_PER_TYPE || tasks.length === MAX_PER_TYPE;

  return NextResponse.json({
    matters,
    documents,
    tasks,
    total,
    ...(truncated ? { _warning: `Results capped at ${MAX_PER_TYPE} per type. Use /api/search for server-side search.` } : {}),
  });
}
