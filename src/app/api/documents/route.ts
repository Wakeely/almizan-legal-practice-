// =============================================================================
// POST /api/documents — top-level create (legacy ref UI calls this)
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, verifyMatterBelongsToOrg } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const documentCreateSchema = z.object({
  matterId: z.string().min(1),
  name: z.string().min(1).max(300),
  category: z.string().min(1).max(80).default("General"),
  fileSize: z.string().max(40).default("0 KB"),
  uploadedBy: z.string().min(1).max(200),
  visibleToClient: z.boolean().default(false),
  version: z.number().int().min(1).default(1),
});

export async function POST(req: Request) {
  const r = await requireUser();
  if (!r.ok) return r.response;

  const body = await req.json().catch(() => null);
  const parsed = parseBody(documentCreateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const owns = await verifyMatterBelongsToOrg(data.matterId, r.session);
  if (!owns) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const doc = await db.document.create({
    data: {
      name: data.name,
      category: data.category,
      fileSize: data.fileSize,
      uploadedBy: data.uploadedBy,
      visibleToClient: data.visibleToClient,
      version: data.version,
      matterId: data.matterId,
      organizationId: r.session.organizationId,
    },
  });

  await audit({ action: "document.create", entity: "document", entityId: doc.id, matterId: data.matterId, details: { name: doc.name } }, req);

  return NextResponse.json({ ...doc, aiTags: [] }, { status: 201 });
}
