// =============================================================================
// PATCH /api/privilege-log/[id] — update a privilege log entry (org-scoped)
// DELETE /api/privilege-log/[id] — delete a privilege log entry
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const privilegeEntryUpdateSchema = z.object({
  docControlNum: z.string().min(1).max(60).optional(),
  docDate: z.string().min(1).max(40).optional(),
  author: z.string().min(1).max(200).optional(),
  recipients: z.string().min(1).max(500).optional(),
  docType: z.string().min(1).max(100).optional(),
  subject: z.string().min(1).max(500).optional(),
  privilegeClaimed: z.enum([
    "Attorney-Client Privilege",
    "Work-Product Doctrine",
    "Common Interest Privilege",
    "Bank Confidentiality",
    "Sharia Professional Secrecy",
  ]).optional(),
  justification: z.string().min(1).max(2000).optional(),
  isRedacted: z.boolean().optional(),
  reviewStatus: z.enum(["Flagged", "Verified", "Withheld"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  const existing = await db.privilegeLogEntry.findFirst({
    where: { id, ...orgWhere(r.session) },
    select: { id: true, matterId: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = parseBody(privilegeEntryUpdateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const updates = parsed.data;

  const cleanUpdates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) cleanUpdates[k] = v;
  }

  const result = await db.privilegeLogEntry.updateMany({
    where: { id, ...orgWhere(r.session) },
    data: cleanUpdates,
  });
  if (result.count === 0) return NextResponse.json({ error: 'Not found or not owned by your organization' }, { status: 404 });
  const updated = await db.privilegeLogEntry.findFirst({ where: { id, ...orgWhere(r.session) } });

  await audit({ action: "privilege-log.update", entity: "privilegeLogEntry", entityId: id, matterId: existing.matterId, details: cleanUpdates }, req);

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  const existing = await db.privilegeLogEntry.findFirst({
    where: { id, ...orgWhere(r.session) },
    select: { id: true, matterId: true, docControlNum: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await db.privilegeLogEntry.deleteMany({
    where: { id, ...orgWhere(r.session) },
  });
  if (result.count === 0) return NextResponse.json({ error: 'Not found or not owned by your organization' }, { status: 404 });

  await audit({ action: "privilege-log.delete", entity: "privilegeLogEntry", entityId: id, matterId: existing.matterId, details: { docControlNum: existing.docControlNum } }, req);

  return NextResponse.json({ ok: true });
}
