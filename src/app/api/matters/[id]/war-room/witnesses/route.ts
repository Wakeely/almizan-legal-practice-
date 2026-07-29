// =============================================================================
// GET /api/matters/[id]/war-room/witnesses — list witnesses
// POST /api/matters/[id]/war-room/witnesses — create witness
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere, verifyMatterBelongsToOrg } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const witnessCreateSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["Fact", "Expert", "Adverse"]).default("Fact"),
  examinationNotes: z.string().max(4000).optional().or(z.literal("")),
  order: z.number().int().min(0).default(0),
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

  const witnesses = await db.warRoomWitness.findMany({
    where: { matterId: id, ...orgWhere(r.session) },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(witnesses);
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
  const parsed = parseBody(witnessCreateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const witness = await db.warRoomWitness.create({
    data: {
      ...data,
      examinationNotes: data.examinationNotes || null,
      matterId: id,
      organizationId: r.session.organizationId,
    },
  });

  await audit({ action: "war-room.witness.create", entity: "warRoomWitness", entityId: witness.id, matterId: id, details: { name: witness.name, type: witness.type } }, req);

  return NextResponse.json(witness, { status: 201 });
}
