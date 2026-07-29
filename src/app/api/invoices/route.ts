// =============================================================================
// /api/invoices — CRUD for invoices
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere, verifyMatterBelongsToOrg } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const invoiceCreateSchema = z.object({
  matterId: z.string().min(1),
  invoiceNumber: z.string().min(1).max(60),
  totalAmount: z.number().min(0),
  status: z.enum(["Draft", "Sent", "Paid", "Overdue"]).default("Draft"),
  dueDate: z.string().min(1).max(40),
  issueDate: z.string().max(40).optional().or(z.literal("")),
});

export async function GET(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const url = new URL(req.url);
  const matterId = url.searchParams.get("matterId");
  const where = matterId
    ? { matterId, ...orgWhere(r.session) }
    : orgWhere(r.session);

  const invoices = await db.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(invoices);
}

export async function POST(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(invoiceCreateSchema, body);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const owns = await verifyMatterBelongsToOrg(data.matterId, r.session);
  if (!owns) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const invoice = await db.invoice.create({
    data: {
      ...data,
      issueDate: data.issueDate || null,
      organizationId: r.session.organizationId,
    },
  });

  // Mark all unbilled time entries on this matter as billed (basic flow;
  // real e-billing systems would link specific entries to invoices)
  await db.timeEntry.updateMany({
    where: { matterId: data.matterId, billed: false, ...orgWhere(r.session) },
    data: { billed: true },
  });

  await audit({ action: "invoice.create", entity: "invoice", entityId: invoice.id, matterId: data.matterId, details: { amount: invoice.totalAmount, status: invoice.status } }, req);

  return NextResponse.json(invoice, { status: 201 });
}
