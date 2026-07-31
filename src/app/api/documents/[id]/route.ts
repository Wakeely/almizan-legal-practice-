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
import { deleteDocumentChunks } from "@/lib/rag/ingest";

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
  if (r.ok === false) return r.response;
  const { id } = await params;

  const existing = await db.document.findFirst({
    where: { id, ...orgWhere(r.session) },
    select: { id: true, matterId: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(documentUpdateSchema, body);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const updates = parsed.data;

  // Serialize array field
  const cleanUpdates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined) continue;
    cleanUpdates[k] = k === "aiTags" ? JSON.stringify(v) : v;
  }

  const result = await db.document.updateMany({
    where: { id, ...orgWhere(r.session) },
    data: cleanUpdates,
  });
  if (result.count === 0) return NextResponse.json({ error: 'Not found or not owned by your organization' }, { status: 404 });
  // Use select to exclude fileContent from the response
  const updated = await db.document.findFirst({
    where: { id, ...orgWhere(r.session) },
    select: {
      id: true, organizationId: true, matterId: true, name: true, category: true,
      fileSize: true, uploadedBy: true, uploadedAt: true, visibleToClient: true,
      version: true, aiSummary: true, aiTags: true, isRedacted: true,
      redactedVersionId: true, redactionCount: true, blobUrl: true, fileMimeType: true,
    },
  });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await audit({ action: "document.update", entity: "document", entityId: id, matterId: existing.matterId, details: cleanUpdates }, req);

  return NextResponse.json({
    ...updated,
    aiTags: updated.aiTags ? (() => { try { return JSON.parse(updated.aiTags); } catch { return []; } })() : [],
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (r.ok === false) return r.response;
  const { id } = await params;

  const existing = await db.document.findFirst({
    where: { id, ...orgWhere(r.session) },
    select: { id: true, matterId: true, name: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await db.document.deleteMany({
    where: { id, ...orgWhere(r.session) },
  });
  if (result.count === 0) return NextResponse.json({ error: 'Not found or not owned by your organization' }, { status: 404 });

  // --- RAG chunk cleanup --------------------------------------------------
  // Remove all chunks for this document so they don't surface in future
  // matter Q&A. Org-scoped delete for defense in depth (the doc delete above
  // already enforced org scope, but we double-check here).
  try {
    const removed = await deleteDocumentChunks(r.session.organizationId, id);
    if (removed > 0) {
      await audit({
        action: "ai.rag.ingest.delete",
        entity: "document",
        entityId: id,
        matterId: existing.matterId,
        details: { chunksRemoved: removed },
      }, req);
    }
  } catch (err: any) {
    console.error("[documents/delete] RAG chunk cleanup failed (non-blocking):", err?.message ?? err);
  }

  await audit({ action: "document.delete", entity: "document", entityId: id, matterId: existing.matterId, details: { name: existing.name } }, req);

  return NextResponse.json({ ok: true });
}
