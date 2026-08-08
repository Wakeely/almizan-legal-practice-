// =============================================================================
// /api/investigations/[id]/review — attorney review gate
// -----------------------------------------------------------------------------
// POST body: { decision: "approve" | "reject" | "request_changes", note?: string }
//
// Only allowed when the investigation status is 'awaiting_attorney_review'.
//   - approve         → status becomes 'completed'
//   - reject          → status becomes 'failed' (terminal)
//   - request_changes → status stays 'awaiting_attorney_review' (the attorney
//                       can re-review after edits; a future restart endpoint
//                       would re-run the pipeline)
//
// note is REQUIRED for reject + request_changes (so the next reviewer / the
// user knows why). Optional for approve.
//
// Authorisation: requireInvestigationAccess() + org-scoped where on the
// investigation row.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";
import { requireInvestigationAccess } from "../../_gate";

const reviewSchema = z
  .object({
    decision: z.enum(["approve", "reject", "request_changes"]),
    note: z.string().max(5000).optional().or(z.literal("")),
  })
  .refine(
    (d) =>
      d.decision === "approve" || (d.note && d.note.trim().length >= 3),
    {
      message:
        "A note (min 3 chars) is required when rejecting or requesting changes.",
    },
  );

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireInvestigationAccess();
  if (gate.ok === false) return gate.response;
  const session = gate.session;
  const { id } = await ctx.params;

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(reviewSchema, body);
  if (parsed.ok === false)
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  // Load the investigation (org-scoped).
  const investigation = await db.caseInvestigation.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true, status: true, title: true },
  });

  if (!investigation) {
    return NextResponse.json(
      { error: "Investigation not found" },
      { status: 404 },
    );
  }

  if (investigation.status !== "awaiting_attorney_review") {
    return NextResponse.json(
      {
        error: "not_awaiting_review",
        message: `Investigation status is '${investigation.status}', not 'awaiting_attorney_review'.`,
        currentStatus: investigation.status,
      },
      { status: 409 }, // Conflict
    );
  }

  // Create the review row.
  const review = await db.investigationReview.create({
    data: {
      organizationId: session.organizationId,
      investigationId: id,
      reviewerId: session.id,
      decision: data.decision,
      note: data.note && data.note.trim() ? data.note.trim() : null,
    },
  });

  // Update the investigation status.
  let newStatus: "completed" | "failed" | "awaiting_attorney_review";
  if (data.decision === "approve") {
    newStatus = "completed";
  } else if (data.decision === "reject") {
    newStatus = "failed";
  } else {
    newStatus = "awaiting_attorney_review"; // request_changes stays in review
  }

  await db.caseInvestigation.update({
    where: { id },
    data: {
      status: newStatus,
      // Clear failureReason on approve / request_changes; set it on reject.
      // (At this point investigation.status is guaranteed "awaiting_attorney_review"
      // — we returned 409 above otherwise — so there's no prior failure to preserve.)
      failureReason:
        data.decision === "reject"
          ? `Rejected by reviewer: ${(data.note ?? "").slice(0, 1500)}`
          : null,
    },
  });

  // Audit the review decision.
  await audit(
    {
      action: `investigation.review.${data.decision}`,
      entity: "caseInvestigation",
      entityId: id,
      details: {
        decision: data.decision,
        newStatus,
        noteLength: data.note?.length ?? 0,
        reviewerRole: session.role,
      },
    },
    req,
  );

  return NextResponse.json({
    reviewId: review.id,
    decision: review.decision,
    newStatus,
  });
}
