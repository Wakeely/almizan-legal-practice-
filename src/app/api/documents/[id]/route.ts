// =============================================================================
// PATCH /api/documents/[id] — update a document (visibility, version, AI summary)
// DELETE /api/documents/[id] — delete a document (org-scoped)
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const documentUpdateSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  category: z.string().min(1).max(80).optional(),
  visibleToClient: z.boolean().optional(),
  version: z.number().int().min(1).optional(),
  aiSummary: z.string().max(4000).optional().or(z.literal("")),
  aiTags: z.array(z.string()).optional(),
  isRedacted: z.boolean().optional(),
  redactionCount: z.number().int().min(0).optional(),
  redactedVersionId: z.string().max(100).optional().or(z.literal("")),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  const existing = await db.document.findFirst({
    where: { id, ...orgWhere(r.session) },
    select: { id: true, matterId: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = parseBody(documentUpdateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const updates = parsed.data;

  // Serialize array field
  const cleanUpdates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined) continue;
    cleanUpdates[k] = k === "aiTags" ? JSON.stringify(v) : v;
  }

  const updated = await db.document.update({
    where: { id },
    data: cleanUpdates,
  });

  await audit({ action: "document.update", entity: "document", entityId: id, matterId: existing.matterId, details: cleanUpdates }, req);

  return NextResponse.json({
    ...updated,
    aiTags: updated.aiTags ? JSON.parse(updated.aiTags) : [],
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  const existing = await db.document.findFirst({
    where: { id, ...orgWhere(r.session) },
    select: { id: true, matterId: true, name: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.document.delete({ where: { id } });

  await audit({ action: "document.delete", entity: "document", entityId: id, matterId: existing.matterId, details: { name: existing.name } }, req);

  return NextResponse.json({ ok: true });
}
