// =============================================================================
// /api/matters/[id]/billing — combined billing endpoint
// GET returns timeEntries + invoices + aggregated totals for the matter.
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

  const [timeEntries, invoices] = await Promise.all([
    db.timeEntry.findMany({
      where: { matterId: id, ...orgWhere(r.session) },
      orderBy: { date: "desc" },
    }),
    db.invoice.findMany({
      where: { matterId: id, ...orgWhere(r.session) },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const unbilledEntries = timeEntries.filter((t) => !t.billed);
  const unbilledHours = unbilledEntries.reduce((s, t) => s + t.hours, 0);
  const unbilledTotal = unbilledEntries.reduce((s, t) => s + t.hours * t.rate, 0);
  const totalBilled = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalCollected = invoices
    .filter((i) => i.status === "Paid")
    .reduce((s, i) => s + i.totalAmount, 0);

  return NextResponse.json({
    timeEntries,
    invoices,
    unbilledHours,
    unbilledTotal,
    totalBilled,
    totalCollected,
    trustBalance: totalCollected - totalBilled,
  });
}
