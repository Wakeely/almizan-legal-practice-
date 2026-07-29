// =============================================================================
// PATCH /api/conflict-check/[id] — update conflict check (set ethical wall, etc.)
// DELETE /api/conflict-check/[id] — delete conflict check
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const conflictCheckUpdateSchema = z.object({
  certificateNumber: z.string().max(60).optional(),
  searchQuery: z.string().min(1).max(500).optional(),
  matchedEntities: z.array(z.any()).optional(),
  clearanceStatus: z.enum(["Pending", "Cleared", "Conflict"]).optional(),
  ethicalWallSet: z.boolean().optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  const existing = await db.conflictCheck.findFirst({
    where: { id, ...orgWhere(r.session) },
    select: { id: true, certificateNumber: true, clearanceStatus: true, ethicalWallSet: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = parseBody(conflictCheckUpdateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const updates = parsed.data;

  const cleanUpdates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined) continue;
    cleanUpdates[k] = k === "matchedEntities" && Array.isArray(v) ? JSON.stringify(v) : v;
  }

  const result = await db.conflictCheck.updateMany({
    where: { id, ...orgWhere(r.session) },
    data: cleanUpdates,
  });
  if (result.count === 0) return NextResponse.json({ error: 'Not found or not owned by your organization' }, { status: 404 });
  const updated = await db.conflictCheck.findFirst({ where: { id, ...orgWhere(r.session) } });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await audit({
    action: "conflict-check.update",
    entity: "conflictCheck",
    entityId: id,
    details: {
      certificateNumber: existing.certificateNumber,
      from: { clearanceStatus: existing.clearanceStatus, ethicalWallSet: existing.ethicalWallSet },
      to: { clearanceStatus: updates.clearanceStatus, ethicalWallSet: updates.ethicalWallSet },
    },
  }, req);

  return NextResponse.json({
    ...updated,
    matchedEntities: updated.matchedEntities ? JSON.parse(updated.matchedEntities) : [],
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  const existing = await db.conflictCheck.findFirst({
    where: { id, ...orgWhere(r.session) },
    select: { id: true, certificateNumber: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await db.conflictCheck.deleteMany({
    where: { id, ...orgWhere(r.session) },
  });
  if (result.count === 0) return NextResponse.json({ error: 'Not found or not owned by your organization' }, { status: 404 });

  await audit({
    action: "conflict-check.delete",
    entity: "conflictCheck",
    entityId: id,
    details: { certificateNumber: existing.certificateNumber },
  }, req);

  return NextResponse.json({ ok: true });
}
