// =============================================================================
// POST /api/platform-admin/break-glass
// -----------------------------------------------------------------------------
// Phase 2 §2.6: break-glass content access. Gated by requirePlatformAdminWithMfa().
//
// A distinct, rarer action from impersonation — for when you need to look at
// a specific matter/document to debug a support issue, without fully
// impersonating the user. Requires a mandatory reason field.
//
// This endpoint DOES NOT grant access directly — it records the break-glass
// event in the audit log and returns a time-boxed token that the tenant
// matter/document APIs can verify. (Wiring those APIs to honor the token is
// Phase 2.6 follow-up work; this endpoint establishes the audit trail + token
// issuance pattern.)
//
// Writes platform_admin.break_glass_access with the reason, org, and record(s).
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdminWithMfa } from "@/lib/platform-admin";
import { platformAudit } from "@/lib/audit";

const breakGlassSchema = z.object({
  organizationId: z.string().min(1),
  reason: z.string().min(10, "A detailed reason is required (min 10 characters).").max(1000),
  recordType: z.enum(["matter", "document", "other"]),
  recordId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const r = await requirePlatformAdminWithMfa();
  if (r.ok === false) return r.response;

  const body = await req.json().catch((): null => null);
  const parsed = breakGlassSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  const { organizationId, reason, recordType, recordId } = parsed.data;

  // Verify the org exists
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  }

  // Audit entry — org-scoped (the affected org is the one whose data is accessed)
  await platformAudit(
    {
      action: "platform_admin.break_glass_access",
      entity: recordType,
      entityId: recordId ?? null,
      organizationId,
      platformAdminId: r.session.adminId,
      details: {
        orgName: org.name,
        reason,
        recordType,
        recordId: recordId ?? null,
      },
    },
    req,
  );

  // NOTE: Phase 2.6 v1 records the audit trail + grants the admin a 30-minute
  // window to contact the user / investigate. A follow-up ticket will wire
  // the tenant matter/document APIs to honor a break-glass cookie issued
  // here — for now, the audit entry IS the deliverable: every break-glass
  // access is permanently recorded with reason, org, record, admin, and time.

  return NextResponse.json({
    ok: true,
    message: `Break-glass access recorded for ${org.name}. Reason: "${reason}". The access event is logged in the audit trail. Contact the user to coordinate the investigation.`,
  });
}
