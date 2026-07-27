// =============================================================================
// /api/privilege-log — top-level create (legacy ref UI posts here)
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, verifyMatterBelongsToOrg } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const privilegeEntryCreateSchema = z.object({
  matterId: z.string().min(1),
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

export async function POST(req: Request) {
  const r = await requireUser();
  if (!r.ok) return r.response;

  const body = await req.json().catch(() => null);
  const parsed = parseBody(privilegeEntryCreateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const owns = await verifyMatterBelongsToOrg(data.matterId, r.session);
  if (!owns) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const entry = await db.privilegeLogEntry.create({
    data: {
      docControlNum: data.docControlNum,
      docDate: data.docDate,
      author: data.author,
      recipients: data.recipients,
      docType: data.docType,
      subject: data.subject,
      privilegeClaimed: data.privilegeClaimed,
      justification: data.justification,
      isRedacted: data.isRedacted,
      reviewStatus: data.reviewStatus,
      matterId: data.matterId,
      organizationId: r.session.organizationId,
    },
  });

  await audit({ action: "privilege-log.create", entity: "privilegeLogEntry", entityId: entry.id, matterId: data.matterId, details: { docControlNum: entry.docControlNum } }, req);

  return NextResponse.json(entry, { status: 201 });
}
