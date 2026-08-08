// =============================================================================
// POST /api/platform-admin/impersonation/end
// -----------------------------------------------------------------------------
// Phase 2 §2.5: end an active impersonation session. Clears the impersonation
// cookie and writes the platform_admin.impersonate_end audit entry.
// =============================================================================

import { NextResponse } from "next/server";
import { requirePlatformAdmin, clearImpersonationCookie, getImpersonation } from "@/lib/platform-admin";
import { platformAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const r = await requirePlatformAdmin();
  if (r.ok === false) return r.response;

  const active = await getImpersonation();
  if (active) {
    await platformAudit(
      {
        action: "platform_admin.impersonate_end",
        entity: "user",
        entityId: active.targetUserId,
        organizationId: active.targetOrgId,
        platformAdminId: r.session.adminId,
        details: {
          targetEmail: active.targetEmail,
          targetName: active.targetName,
          reason: active.reason,
        },
      },
      req,
    );
  }

  await clearImpersonationCookie();
  return NextResponse.json({ ok: true });
}
