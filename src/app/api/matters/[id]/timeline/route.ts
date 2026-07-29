// =============================================================================
// GET /api/matters/[id]/timeline — list timeline events for a matter
// POST /api/matters/[id]/timeline — create a new timeline event
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere, verifyMatterBelongsToOrg } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const timelineEventCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  date: z.string().min(1).max(40),
  visibleToClient: z.boolean().default(false),
  type: z.string().max(60).optional().or(z.literal("")),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (r.ok === false) return r.response;
  const { id } = await params;

  const owns = await verifyMatterBelongsToOrg(id, r.session);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const events = await db.timelineEvent.findMany({
    where: { matterId: id, ...orgWhere(r.session) },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(events);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (r.ok === false) return r.response;
  const { id } = await params;

  const owns = await verifyMatterBelongsToOrg(id, r.session);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = parseBody(timelineEventCreateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const event = await db.timelineEvent.create({
    data: {
      title: data.title,
      description: data.description,
      date: data.date,
      visibleToClient: data.visibleToClient,
      type: data.type || null,
      matterId: id,
      organizationId: r.session.organizationId,
    },
  });

  await audit({ action: "timeline-event.create", entity: "timelineEvent", entityId: event.id, matterId: id, details: { title: event.title, visibleToClient: event.visibleToClient } }, req);

  return NextResponse.json(event, { status: 201 });
}
