// =============================================================================
// POST /api/platform-admin/auth/logout
// -----------------------------------------------------------------------------
// Clears the platform-admin session cookie. Writes a platform_admin.logout
// audit entry (best-effort — if the cookie is already gone, just return ok).
// =============================================================================

import { NextResponse } from "next/server";
import {
  clearPlatformAdminCookie,
  getPlatformAdminSession,
} from "@/lib/platform-admin";
import { platformAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await getPlatformAdminSession();
  if (session) {
    await platformAudit(
      {
        action: "platform_admin.logout",
        entity: "platform_admin",
        entityId: session.adminId,
        organizationId: null,
        platformAdminId: session.adminId,
        details: { email: session.email },
      },
      req,
    );
  }
  await clearPlatformAdminCookie();
  return NextResponse.json({ ok: true });
}
