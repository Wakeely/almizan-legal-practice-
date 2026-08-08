// =============================================================================
// POST /api/platform-admin/impersonation/start
// -----------------------------------------------------------------------------
// Phase 2 §2.5: begin impersonating a tenant user. Gated by
// requirePlatformAdminWithMfa() — MFA is mandatory before impersonation.
//
// Sets a SEPARATE impersonation cookie (almizan.platform-admin-impersonation)
// that the tenant app checks. The cookie is time-boxed to 30 minutes and
// carries the admin id (for audit) + target user id + expiry.
//
// Impersonated sessions inherit the target user's actual permissions — no
// privilege escalation, this is strictly "see what they see." The tenant
// app must render a non-dismissible banner when the impersonation cookie
// is present.
//
// Writes platform_admin.impersonate_start with the target user, org, and
// optional reason.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdminWithMfa, setImpersonationCookie } from "@/lib/platform-admin";
import { platformAudit } from "@/lib/audit";

const startSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const r = await requirePlatformAdminWithMfa();
  if (r.ok === false) return r.response;

  const body = await req.json().catch((): null => null);
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { userId, reason } = parsed.data;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      organizationId: true,
      deletedAt: true,
      organization: { select: { status: true } },
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (user.deletedAt) {
    return NextResponse.json({ error: "Cannot impersonate a soft-deleted user." }, { status: 400 });
  }
  if (!user.organizationId) {
    return NextResponse.json({ error: "User has no organization." }, { status: 400 });
  }

  // Set the impersonation cookie (30-minute expiry baked in)
  await setImpersonationCookie({
    adminId: r.session.adminId,
    targetUserId: user.id,
    targetEmail: user.email,
    targetName: user.name,
    targetOrgId: user.organizationId,
    reason: reason ?? null,
  });

  await platformAudit(
    {
      action: "platform_admin.impersonate_start",
      entity: "user",
      entityId: user.id,
      organizationId: user.organizationId,
      platformAdminId: r.session.adminId,
      details: {
        targetEmail: user.email,
        targetName: user.name,
        targetRole: user.role,
        reason: reason ?? null,
      },
    },
    req,
  );

  return NextResponse.json({
    ok: true,
    target: {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
    },
    redirectTo: "/workspace",
    message: `Impersonating ${user.name}. A banner will be shown in the tenant app. Session ends in 30 minutes.`,
  });
}
