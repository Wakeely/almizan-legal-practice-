// =============================================================================
// GET /api/client-portal/matters/[id]/invoices — SERVER-FILTERED invoice list
// -----------------------------------------------------------------------------
// SECURITY (per master system prompt rule #4):
// Client portal data must be filtered server-side. Clients can only see
// invoices with status 'Sent' or 'Paid' — NOT 'Draft' or 'Overdue' (which
// are internal firm workflow states the client shouldn't see).
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

  // SERVER-SIDE FILTER: only show Sent + Paid invoices to clients
  // (Draft and Overdue are internal firm workflow states)
  const invoices = await db.invoice.findMany({
    where: {
      matterId: id,
      status: { in: ["Sent", "Paid"] },
      ...orgWhere(r.session),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      status: true,
      dueDate: true,
      issueDate: true,
    },
  });

  return NextResponse.json(invoices);
}
