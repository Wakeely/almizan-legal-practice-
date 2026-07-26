// =============================================================================
// PATCH /api/invoices/[id] — update invoice status
// DELETE /api/invoices/[id] — delete invoice
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const invoiceUpdateSchema = z.object({
  invoiceNumber: z.string().min(1).max(60).optional(),
  totalAmount: z.number().min(0).optional(),
  status: z.enum(["Draft", "Sent", "Paid", "Overdue"]).optional(),
  dueDate: z.string().min(1).max(40).optional(),
  issueDate: z.string().max(40).optional().or(z.literal("")),
  paymentTxId: z.string().max(100).optional().or(z.literal("")),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  const existing = await db.invoice.findFirst({
    where: { id, ...orgWhere(r.session) },
    select: { id: true, matterId: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = parseBody(invoiceUpdateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const updates = parsed.data;

  const cleanUpdates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) cleanUpdates[k] = v;
  }

  const updated = await db.invoice.update({
    where: { id },
    data: cleanUpdates,
  });

  await audit({ action: "invoice.update", entity: "invoice", entityId: id, matterId: existing.matterId, details: { from: existing.status, to: updates.status, changes: cleanUpdates } }, req);

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  const existing = await db.invoice.findFirst({
    where: { id, ...orgWhere(r.session) },
    select: { id: true, matterId: true, invoiceNumber: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.invoice.delete({ where: { id } });

  await audit({ action: "invoice.delete", entity: "invoice", entityId: id, matterId: existing.matterId, details: { invoiceNumber: existing.invoiceNumber } }, req);

  return NextResponse.json({ ok: true });
}
