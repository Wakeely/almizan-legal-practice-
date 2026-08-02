// =============================================================================
// /api/investigations — Case Investigation Agent (PAID ADD-ON)
// -----------------------------------------------------------------------------
// GET  — list investigations for the user's org (paged, newest first)
// POST — start a new investigation (creates the CaseInvestigation row + runs
//        the pipeline synchronously)
//
// Every request passes through requireInvestigationAccess() which enforces:
//   1. requireUser()   — authenticated
//   2. requireRole()   — Managing Partner / Senior Associate / In-House Counsel
//   3. add-on gate     — Organization.investigationAgentEnabled === true
//
// Audit: every start is logged via src/lib/audit.ts with action
// 'investigation.start' (no privileged intake text in the audit details —
// only the title + matterId + status).
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";
import { verifyMatterBelongsToOrg } from "@/lib/org";
import { requireInvestigationAccess } from "./_gate";
import { runInvestigationPipeline } from "@/lib/agents/orchestrator";

// -----------------------------------------------------------------------------
// Zod schemas
// -----------------------------------------------------------------------------

const startSchema = z.object({
  title: z.string().min(2).max(300),
  intakeInput: z.string().min(20, "Intake text is too short").max(20000),
  matterId: z.string().min(1).optional(),
  verificationTier: z.enum(["1", "2", "3"]).default("2"),
  lang: z.enum(["ar", "en"]).default("ar"),
});

const listSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  matterId: z.string().optional(),
});

// -----------------------------------------------------------------------------
// GET — list
// -----------------------------------------------------------------------------

export async function GET(req: Request) {
  const gate = await requireInvestigationAccess();
  if (gate.ok === false) return gate.response;
  const session = gate.session;

  const { searchParams } = new URL(req.url);
  const parsed = parseBody(listSchema, {
    limit: searchParams.get("limit") ?? 20,
    cursor: searchParams.get("cursor") ?? undefined,
    matterId: searchParams.get("matterId") ?? undefined,
  });
  if (parsed.ok === false)
    return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { limit, cursor, matterId } = parsed.data;

  const where = {
    organizationId: session.organizationId,
    ...(matterId ? { matterId } : {}),
  };

  const investigations = await db.caseInvestigation.findMany({
    where,
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      verificationTier: true,
      lang: true,
      matterId: true,
      failureReason: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const hasMore = investigations.length > limit;
  const trimmed = hasMore ? investigations.slice(0, limit) : investigations;
  const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id : undefined;

  return NextResponse.json({
    data: trimmed,
    pagination: { nextCursor, hasMore, limit },
  });
}

// -----------------------------------------------------------------------------
// POST — start
// -----------------------------------------------------------------------------

export async function POST(req: Request) {
  const gate = await requireInvestigationAccess();
  if (gate.ok === false) return gate.response;
  const session = gate.session;

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(startSchema, body);
  if (parsed.ok === false)
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  // If a matterId was supplied, verify it belongs to the org BEFORE creating
  // the investigation. Same pattern as /api/ai/rag.
  let matterId: string | null = null;
  if (data.matterId) {
    const owns = await verifyMatterBelongsToOrg(data.matterId, session);
    if (!owns) {
      return NextResponse.json({ error: "Matter not found" }, { status: 404 });
    }
    matterId = data.matterId;
  }

  // Look up the matter's jurisdiction (for court routing). Null when standalone.
  let jurisdiction: string | null = null;
  if (matterId) {
    const matter = await db.matter.findUnique({
      where: { id: matterId },
      select: { jurisdiction: true },
    });
    jurisdiction = matter?.jurisdiction ?? null;
  }

  // Create the CaseInvestigation row in 'queued' status.
  const investigation = await db.caseInvestigation.create({
    data: {
      organizationId: session.organizationId,
      matterId,
      startedByUserId: session.id,
      title: data.title,
      status: "queued",
      intakeInput: data.intakeInput,
      verificationTier: data.verificationTier,
      lang: data.lang,
    },
  });

  // Audit the start (NO intake text in the audit — it may be privileged).
  await audit(
    {
      action: "investigation.start",
      entity: "caseInvestigation",
      entityId: investigation.id,
      matterId: matterId ?? undefined,
      details: {
        title: investigation.title,
        verificationTier: investigation.verificationTier,
        lang: investigation.lang,
        intakeLength: data.intakeInput.length,
      },
    },
    req,
  );

  // Run the pipeline. For now this runs synchronously — the request returns
  // when the pipeline finishes (or fails). For very long investigations we
  // could move this to a background job in Phase 3.
  let pipelineResult;
  try {
    pipelineResult = await runInvestigationPipeline({
      investigationId: investigation.id,
      organizationId: session.organizationId,
      matterId,
      jurisdiction,
      lang: data.lang,
      tier: data.verificationTier,
    });
  } catch (err: any) {
    // Defensive: any uncaught exception marks the investigation as failed.
    pipelineResult = {
      status: "failed" as const,
      failureReason: `Pipeline crashed: ${err?.message ?? String(err)}`,
    };
    await db.caseInvestigation.update({
      where: { id: investigation.id },
      data: {
        status: "failed",
        failureReason: pipelineResult.failureReason,
      },
    });
  }

  return NextResponse.json(
    {
      id: investigation.id,
      status: pipelineResult.status,
      failureReason: pipelineResult.failureReason ?? null,
    },
    { status: 201 },
  );
}
