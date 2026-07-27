// =============================================================================
// GET /api/matters/[id]/calendar — list calendar events for a matter
// POST /api/matters/[id]/calendar — create a calendar event
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere, verifyMatterBelongsToOrg } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const calendarEventCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  startDate: z.string().min(1).max(40),
  endDate: z.string().max(40).optional().or(z.literal("")),
  time: z.string().max(20).optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  category: z.enum(["Hearing", "Court Deadline", "Client Meeting", "Filing", "Arbitration"]).default("Hearing"),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  const owns = await verifyMatterBelongsToOrg(id, r.session);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const events = await db.calendarEvent.findMany({
    where: { matterId: id, ...orgWhere(r.session) },
    orderBy: { startDate: "asc" },
  });

  return NextResponse.json(events);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  const owns = await verifyMatterBelongsToOrg(id, r.session);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = parseBody(calendarEventCreateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const event = await db.calendarEvent.create({
    data: {
      ...data,
      description: data.description || null,
      endDate: data.endDate || null,
      time: data.time || null,
      location: data.location || null,
      matterId: id,
      organizationId: r.session.organizationId,
    },
  });

  await audit({ action: "calendar-event.create", entity: "calendarEvent", entityId: event.id, matterId: id, details: { title: event.title, startDate: event.startDate } }, req);

  return NextResponse.json(event, { status: 201 });
}
