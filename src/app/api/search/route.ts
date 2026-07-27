// =============================================================================
// GET /api/search?q=<query> — Global search across matters, documents, tasks
// -----------------------------------------------------------------------------
// Searches matter title/clientName/jurisdiction, document name/category,
// task title/assignedTo. All org-scoped. Returns grouped results.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";

export async function GET(req: Request) {
  const r = await requireUser();
  if (!r.ok) return r.response;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);

  if (!q || q.length < 2) {
    return NextResponse.json({ matters: [], documents: [], tasks: [], total: 0 });
  }

  // Use Prisma's contains + mode insensitive (Postgres supports this natively)
  // For SQLite (dev), contains is case-insensitive by default for ASCII
  const [matters, documents, tasks] = await Promise.all([
    db.matter.findMany({
      where: {
        ...orgWhere(r.session),
        OR: [
          { title: { contains: q } },
          { clientName: { contains: q } },
          { clientEmail: { contains: q } },
          { jurisdiction: { contains: q } },
          { opposingParty: { contains: q } },
          { opposingCounsel: { contains: q } },
          { judge: { contains: q } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, clientName: true, jurisdiction: true, status: true, riskLevel: true },
    }),
    db.document.findMany({
      where: {
        ...orgWhere(r.session),
        OR: [
          { name: { contains: q } },
          { category: { contains: q } },
          { uploadedBy: { contains: q } },
        ],
      },
      take: limit,
      orderBy: { uploadedAt: "desc" },
      select: { id: true, name: true, category: true, matterId: true, uploadedBy: true, uploadedAt: true },
    }),
    db.task.findMany({
      where: {
        ...orgWhere(r.session),
        OR: [
          { title: { contains: q } },
          { assignedTo: { contains: q } },
          { description: { contains: q } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, assignedTo: true, status: true, priority: true, matterId: true, dueDate: true },
    }),
  ]);

  return NextResponse.json({
    matters,
    documents,
    tasks,
    total: matters.length + documents.length + tasks.length,
    query: q,
  });
}
