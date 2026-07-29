// =============================================================================
// GET /api/matters/[id]/privilege-log — list privilege log entries for a matter
// POST /api/matters/[id]/privilege-log — create a new privilege log entry
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere, verifyMatterBelongsToOrg } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const privilegeEntryCreateSchema = z.object({
  docControlNum: z.string().min(1).max(60),
  docDate: z.string().min(1).max(40),
  author: z.string().min(1).max(200),
  recipients: z.string().min(1).max(500),
  docType: z.string().min(1).max(100),
  subject: z.string().min(1).max(500),
  privilegeClaimed: z.enum([
    "Attorney-Client Privilege",
    "Work-Product Doctrine",
    "Common Interest Privilege",
    "Bank Confidentiality",
    "Sharia Professional Secrecy",
  ]).default("Attorney-Client Privilege"),
  justification: z.string().min(1).max(2000),
  isRedacted: z.boolean().default(false),
  reviewStatus: z.enum(["Flagged", "Verified", "Withheld"]).default("Flagged"),
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

  const entries = await db.privilegeLogEntry.findMany({
    where: { matterId: id, ...orgWhere(r.session) },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(entries);
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
  const parsed = parseBody(privilegeEntryCreateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const entry = await db.privilegeLogEntry.create({
    data: {
      ...data,
      matterId: id,
      organizationId: r.session.organizationId,
    },
  });

  await audit({ action: "privilege-log.create", entity: "privilegeLogEntry", entityId: entry.id, matterId: id, details: { docControlNum: entry.docControlNum } }, req);

  return NextResponse.json(entry, { status: 201 });
}
