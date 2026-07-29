// =============================================================================
// /api/time-entries — CRUD for billable time entries
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere, verifyMatterBelongsToOrg } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const timeEntryCreateSchema = z.object({
  matterId: z.string().min(1),
  description: z.string().min(1).max(2000),
  hours: z.number().min(0).max(24),
  rate: z.number().min(0).max(10000).default(0),
  date: z.string().min(1).max(40).optional().default(() => new Date().toISOString().slice(0, 10)),
  billed: z.boolean().default(false),
  taskCode: z.string().max(20).optional().or(z.literal("")),
  activityCode: z.string().max(20).optional().or(z.literal("")),
  isBillable: z.boolean().default(true),
});

const timeEntryUpdateSchema = z.object({
  description: z.string().min(1).max(2000).optional(),
  hours: z.number().min(0).max(24).optional(),
  rate: z.number().min(0).max(10000).optional(),
  date: z.string().min(1).max(40).optional(),
  billed: z.boolean().optional(),
  taskCode: z.string().max(20).optional().or(z.literal("")),
  activityCode: z.string().max(20).optional().or(z.literal("")),
  isBillable: z.boolean().optional(),
});

export async function GET(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const url = new URL(req.url);
  const matterId = url.searchParams.get("matterId");
  const where = matterId
    ? { matterId, ...orgWhere(r.session) }
    : orgWhere(r.session);

  const entries = await db.timeEntry.findMany({
    where,
    orderBy: { date: "desc" },
  });
  return NextResponse.json(entries);
}

export async function POST(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(timeEntryCreateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const owns = await verifyMatterBelongsToOrg(data.matterId, r.session);
  if (!owns) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const entry = await db.timeEntry.create({
    data: {
      ...data,
      taskCode: data.taskCode || null,
      activityCode: data.activityCode || null,
      organizationId: r.session.organizationId,
    },
  });

  await audit({ action: "time-entry.create", entity: "timeEntry", entityId: entry.id, matterId: data.matterId, details: { hours: entry.hours, rate: entry.rate } }, req);

  return NextResponse.json(entry, { status: 201 });
}

export async function PATCH(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id query param required" }, { status: 400 });

  const existing = await db.timeEntry.findFirst({
    where: { id, ...orgWhere(r.session) },
    select: { id: true, matterId: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(timeEntryUpdateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const updates = parsed.data;

  const cleanUpdates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) cleanUpdates[k] = v;
  }

  const result = await db.timeEntry.updateMany({
    where: { id, ...orgWhere(r.session) },
    data: cleanUpdates,
  });
  if (result.count === 0) return NextResponse.json({ error: 'Not found or not owned by your organization' }, { status: 404 });
  const updated = await db.timeEntry.findFirst({ where: { id, ...orgWhere(r.session) } });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await audit({ action: "time-entry.update", entity: "timeEntry", entityId: id, matterId: existing.matterId, details: cleanUpdates }, req);

  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id query param required" }, { status: 400 });

  const existing = await db.timeEntry.findFirst({
    where: { id, ...orgWhere(r.session) },
    select: { id: true, matterId: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await db.timeEntry.deleteMany({
    where: { id, ...orgWhere(r.session) },
  });
  if (result.count === 0) return NextResponse.json({ error: 'Not found or not owned by your organization' }, { status: 404 });

  await audit({ action: "time-entry.delete", entity: "timeEntry", entityId: id, matterId: existing.matterId }, req);

  return NextResponse.json({ ok: true });
}
