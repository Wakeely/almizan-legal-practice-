// =============================================================================
// GET /api/matters/[id]/invoices/[invoiceId]/ledes — LEDES 1998B export
// -----------------------------------------------------------------------------
// Returns a pipe-delimited plain-text response. Format: LEDES 1998B (16 cols).
// CURRENT LIMITATION (per master system prompt rule #7): basic format only —
// full LEDES validation (line-item tax handling, trust reconciliation, XML
// format) is a separate undertaking.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere, verifyMatterBelongsToOrg } from "@/lib/org";
import { audit } from "@/lib/audit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; invoiceId: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id, invoiceId } = await params;

  const owns = await verifyMatterBelongsToOrg(id, r.session);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, matterId: id, ...orgWhere(r.session) },
    include: { matter: true },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  // Pull time entries that were billed on this matter
  const timeEntries = await db.timeEntry.findMany({
    where: { matterId: id, billed: true, ...orgWhere(r.session) },
    orderBy: { date: "asc" },
  });

  // LEDES 1998B header
  const lines: string[] = [];
  lines.push(
    "INVOICE_DATE|INVOICE_NUMBER|CLIENT_ID|LAW_FIRM_MATTER_ID|INVOICE_TOTAL|BILLING_START_DATE|BILLING_END_DATE|INVOICE_DESCRIPTION|LINE_ITEM_DATE|LINE_ITEM_NUMBER|EXP_CODE|ACT_CODE|TIMEKEEPER_ID|DESCRIPTION|UNITS|RATE",
  );

  // Single invoice row (line 0 is the invoice itself, with empty line-item fields)
  lines.push(
    [
      invoice.issueDate || invoice.createdAt.toISOString().slice(0, 10),
      invoice.invoiceNumber,
      invoice.matter.clientEmail,
      invoice.matterId,
      invoice.totalAmount.toFixed(2),
      invoice.issueDate || "",
      invoice.dueDate,
      `Invoice ${invoice.invoiceNumber} for matter ${invoice.matter.title}`,
      "",
      "1",
      "",
      "",
      "",
      "Invoice Total",
      "0",
      "0.00",
    ].join("|"),
  );

  // One line per billed time entry
  let lineNo = 2;
  for (const te of timeEntries) {
    lines.push(
      [
        invoice.issueDate || invoice.createdAt.toISOString().slice(0, 10),
        invoice.invoiceNumber,
        invoice.matter.clientEmail,
        invoice.matterId,
        "",
        "",
        "",
        "",
        te.date,
        String(lineNo++),
        te.taskCode || "",
        te.activityCode || "",
        te.organizationId.slice(-6).toUpperCase(),
        te.description.replace(/\|/g, ";").replace(/\n/g, " "),
        te.hours.toFixed(2),
        te.rate.toFixed(2),
      ].join("|"),
    );
  }

  await audit({ action: "invoice.ledes-export", entity: "invoice", entityId: invoiceId, matterId: id, details: { lineCount: lines.length - 1 } }, req);

  // Return as downloadable .txt
  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="LEDES_${invoice.invoiceNumber}.txt"`,
    },
  });
}
