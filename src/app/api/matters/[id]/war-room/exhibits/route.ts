// =============================================================================
// GET /api/matters/[id]/war-room/exhibits — list exhibits
// POST /api/matters/[id]/war-room/exhibits — create exhibit
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere, verifyMatterBelongsToOrg } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const exhibitCreateSchema = z.object({
  exhibitNumber: z.string().min(1).max(40),
  description: z.string().min(1).max(1000),
  admissionStatus: z.enum(["Pending", "Admitted", "Excluded"]).default("Pending"),
  party: z.enum(["Plaintiff", "Defense"]).default("Plaintiff"),
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

  const exhibits = await db.warRoomExhibit.findMany({
    where: { matterId: id, ...orgWhere(r.session) },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(exhibits);
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

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(exhibitCreateSchema, body);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const exhibit = await db.warRoomExhibit.create({
    data: {
      ...data,
      matterId: id,
      organizationId: r.session.organizationId,
    },
  });

  await audit({ action: "war-room.exhibit.create", entity: "warRoomExhibit", entityId: exhibit.id, matterId: id, details: { exhibitNumber: exhibit.exhibitNumber, party: exhibit.party } }, req);

  return NextResponse.json(exhibit, { status: 201 });
}
