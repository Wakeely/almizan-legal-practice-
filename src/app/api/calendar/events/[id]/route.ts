// =============================================================================
// PATCH /api/calendar/events/[id] — update event
// DELETE /api/calendar/events/[id] — delete event
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const eventUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().or(z.literal("")),
  startDate: z.string().min(1).max(40).optional(),
  endDate: z.string().max(40).optional().or(z.literal("")),
  time: z.string().max(20).optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  category: z.enum(["Hearing", "Court Deadline", "Client Meeting", "Filing", "Arbitration"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (r.ok === false) return r.response;
  const { id } = await params;

  const existing = await db.calendarEvent.findFirst({
    where: { id, ...orgWhere(r.session) },
    select: { id: true, matterId: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = parseBody(eventUpdateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const updates = parsed.data;

  const cleanUpdates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) cleanUpdates[k] = v;
  }

  const result = await db.calendarEvent.updateMany({
    where: { id, ...orgWhere(r.session) },
    data: cleanUpdates,
  });
  if (result.count === 0) return NextResponse.json({ error: 'Not found or not owned by your organization' }, { status: 404 });
  const updated = await db.calendarEvent.findFirst({ where: { id, ...orgWhere(r.session) } });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await audit({ action: "calendar-event.update", entity: "calendarEvent", entityId: id, matterId: existing.matterId, details: cleanUpdates }, req);

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (r.ok === false) return r.response;
  const { id } = await params;

  const existing = await db.calendarEvent.findFirst({
    where: { id, ...orgWhere(r.session) },
    select: { id: true, matterId: true, title: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await db.calendarEvent.deleteMany({
    where: { id, ...orgWhere(r.session) },
  });
  if (result.count === 0) return NextResponse.json({ error: 'Not found or not owned by your organization' }, { status: 404 });

  await audit({ action: "calendar-event.delete", entity: "calendarEvent", entityId: id, matterId: existing.matterId, details: { title: existing.title } }, req);

  return NextResponse.json({ ok: true });
}
