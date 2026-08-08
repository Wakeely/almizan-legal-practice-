// =============================================================================
// PATCH /api/platform-admin/student-codes/[id]
// -----------------------------------------------------------------------------
// Deactivate a student code. PRD v0.3 §6: platform-only action, organizationId
// = null in the audit entry.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { platformAudit } from "@/lib/audit";

const patchSchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requirePlatformAdmin();
  if (r.ok === false) return r.response;
  const { id } = await params;

  const body = await req.json().catch((): null => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const code = await db.studentCode.findUnique({
    where: { id },
    select: { id: true, code: true, isActive: true },
  });
  if (!code) {
    return NextResponse.json({ error: "Code not found." }, { status: 404 });
  }

  if (code.isActive === parsed.data.isActive) {
    return NextResponse.json({ ok: true, message: "No change." });
  }

  await db.studentCode.update({
    where: { id },
    data: { isActive: parsed.data.isActive },
  });

  await platformAudit(
    {
      action: parsed.data.isActive
        ? "platform_admin.student_code_activate"
        : "platform_admin.student_code_deactivate",
      entity: "student_code",
      entityId: id,
      organizationId: null, // platform-only action (PRD v0.3 §6)
      platformAdminId: r.session.adminId,
      details: { code: code.code, isActive: parsed.data.isActive },
    },
    req,
  );

  return NextResponse.json({ ok: true });
}
