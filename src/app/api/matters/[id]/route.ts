// =============================================================================
// GET /api/matters/[id] — fetch a single matter (must belong to user's org)
// PATCH /api/matters/[id] — update a matter (org-scoped)
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere, verifyMatterBelongsToOrg } from "@/lib/org";
import { parseBody, matterUpdateSchema } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  // Verify matter belongs to user's org (consistent with all other matter-scoped routes)
  const owns = await verifyMatterBelongsToOrg(id, r.session);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const matter = await db.matter.findFirst({
    where: { id, ...orgWhere(r.session) },
  });
  if (!matter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(matter);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  // Verify matter belongs to user's org before allowing update
  const owns = await verifyMatterBelongsToOrg(id, r.session);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = parseBody(matterUpdateSchema, { ...body, id });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { id: _id, ...updates } = parsed.data;

  // Filter out undefined + empty strings for optional fields
  const cleanUpdates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) cleanUpdates[k] = v;
  }

  // Use updateMany with orgWhere so the org check is atomic with the update
  const result = await db.matter.updateMany({
    where: { id, ...orgWhere(r.session) },
    data: cleanUpdates,
  });
  if (result.count === 0) return NextResponse.json({ error: "Not found or not owned by your organization" }, { status: 404 });
  const updated = await db.matter.findFirst({ where: { id, ...orgWhere(r.session) } });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await audit({ action: "matter.update", entity: "matter", entityId: id, details: cleanUpdates }, req);

  return NextResponse.json(updated);
}
