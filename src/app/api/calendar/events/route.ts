// =============================================================================
// /api/calendar/events — top-level calendar events CRUD
// (alternative to /api/matters/[id]/calendar — accepts matterId in body)
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere, verifyMatterBelongsToOrg } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const eventCreateSchema = z.object({
  matterId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  startDate: z.string().min(1).max(40),
  endDate: z.string().max(40).optional().or(z.literal("")),
  time: z.string().max(20).optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  category: z.enum(["Hearing", "Court Deadline", "Client Meeting", "Filing", "Arbitration"]).default("Hearing"),
});

export async function GET(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const url = new URL(req.url);
  const matterId = url.searchParams.get("matterId");
  const where = matterId
    ? { matterId, ...orgWhere(r.session) }
    : orgWhere(r.session);

  const events = await db.calendarEvent.findMany({
    where,
    orderBy: { startDate: "asc" },
  });
  return NextResponse.json(events);
}

export async function POST(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(eventCreateSchema, body);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const owns = await verifyMatterBelongsToOrg(data.matterId, r.session);
  if (!owns) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const event = await db.calendarEvent.create({
    data: {
      title: data.title,
      description: data.description || null,
      startDate: data.startDate,
      endDate: data.endDate || null,
      time: data.time || null,
      location: data.location || null,
      category: data.category,
      matterId: data.matterId,
      organizationId: r.session.organizationId,
    },
  });

  await audit({ action: "calendar-event.create", entity: "calendarEvent", entityId: event.id, matterId: data.matterId, details: { title: event.title } }, req);

  return NextResponse.json(event, { status: 201 });
}
