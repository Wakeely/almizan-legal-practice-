// =============================================================================
// GET /api/matters/[id]/transcripts — list deposition transcripts for a matter
// POST /api/matters/[id]/transcripts — create a new deposition transcript
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere, verifyMatterBelongsToOrg } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const transcriptCreateSchema = z.object({
  witnessName: z.string().min(1).max(200),
  witnessRole: z.string().min(1).max(200),
  depositionDate: z.string().min(1).max(40),
  deponentParty: z.enum([
    "Fact Witness",
    "Expert Witness",
    "Adverse Party",
    "Client Corporate Representative",
  ]).default("Fact Witness"),
  pagesCount: z.number().int().min(0).default(0),
  keyAdmissionsSummary: z.string().max(4000).optional().or(z.literal("")),
  pages: z.array(z.object({
    pageNumber: z.number().int().min(1),
    lineNumber: z.string().max(40).optional().or(z.literal("")),
    timestamp: z.string().max(40).optional().or(z.literal("")),
    speaker: z.string().min(1).max(200),
    text: z.string().min(1).max(8000),
    isKeyAdmission: z.boolean().default(false),
    tags: z.array(z.string()).optional().default([]),
  })).optional().default([]),
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

  const transcripts = await db.depositionTranscript.findMany({
    where: { matterId: id, ...orgWhere(r.session) },
    include: { pages: { orderBy: { pageNumber: "asc" } } },
    orderBy: { uploadedAt: "desc" },
  });

  return NextResponse.json(
    transcripts.map((t) => ({
      ...t,
      pages: t.pages.map((p) => ({
        ...p,
        tags: p.tags ? JSON.parse(p.tags) : [],
      })),
    })),
  );
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

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(transcriptCreateSchema, body);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const transcript = await db.depositionTranscript.create({
    data: {
      witnessName: data.witnessName,
      witnessRole: data.witnessRole,
      depositionDate: data.depositionDate,
      deponentParty: data.deponentParty,
      pagesCount: data.pagesCount,
      keyAdmissionsSummary: data.keyAdmissionsSummary || null,
      matterId: id,
      organizationId: r.session.organizationId,
      pages: {
        create: data.pages.map((p) => ({
          pageNumber: p.pageNumber,
          lineNumber: p.lineNumber || null,
          timestamp: p.timestamp || null,
          speaker: p.speaker,
          text: p.text,
          isKeyAdmission: p.isKeyAdmission,
          tags: JSON.stringify(p.tags ?? []),
          organizationId: r.session.organizationId,
        })),
      },
    },
    include: { pages: { orderBy: { pageNumber: "asc" } } },
  });

  await audit({ action: "transcript.create", entity: "depositionTranscript", entityId: transcript.id, matterId: id, details: { witnessName: transcript.witnessName, pagesCount: transcript.pagesCount } }, req);

  return NextResponse.json({
    ...transcript,
    pages: transcript.pages.map((p) => ({
      ...p,
      tags: p.tags ? JSON.parse(p.tags) : [],
    })),
  }, { status: 201 });
}
