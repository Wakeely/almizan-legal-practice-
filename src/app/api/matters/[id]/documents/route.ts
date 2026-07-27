// =============================================================================
// GET /api/matters/[id]/documents — list documents for a matter (org-scoped)
// POST /api/matters/[id]/documents — create a new document metadata record
// -----------------------------------------------------------------------------
// NOTE: This route stores DOCUMENT METADATA only. Actual file upload (S3 / Vercel
// Blob / local file system) is a separate concern and is documented as a
// CURRENT LIMITATION in the README. The reference UI simulates file uploads by
// recording name + category + size + uploader; we preserve that pattern.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere, verifyMatterBelongsToOrg } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const documentCreateSchema = z.object({
  name: z.string().min(1).max(300),
  category: z.string().min(1).max(80).default("General"),
  fileSize: z.string().max(40).default("0 KB"),
  uploadedBy: z.string().min(1).max(200),
  visibleToClient: z.boolean().default(false),
  version: z.number().int().min(1).default(1),
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

  const docs = await db.document.findMany({
    where: { matterId: id, ...orgWhere(r.session) },
    orderBy: { uploadedAt: "desc" },
  });

  // Parse JSON fields
  return NextResponse.json(
    docs.map((d) => ({
      ...d,
      aiTags: d.aiTags ? JSON.parse(d.aiTags) : [],
    })),
  );
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
  const parsed = parseBody(documentCreateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const doc = await db.document.create({
    data: {
      ...data,
      matterId: id,
      organizationId: r.session.organizationId,
    },
  });

  await audit({ action: "document.create", entity: "document", entityId: doc.id, matterId: id, details: { name: doc.name } }, req);

  return NextResponse.json({ ...doc, aiTags: [] }, { status: 201 });
}
