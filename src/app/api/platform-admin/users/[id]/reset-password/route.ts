// =============================================================================
// POST /api/platform-admin/users/[id]/reset-password
// -----------------------------------------------------------------------------
// Resets a user's password. Formalizes what /api/admin/reset-user-password does
// ad hoc with an env-var token — this route uses requirePlatformAdmin() instead.
//
// PRD v0.3 §6: writes a platform_admin.password_reset audit entry with
// organizationId = the user's org (the affected org).
//
// The admin sets the new password directly in v1 (no email flow). Production
// may later send a one-time link instead.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { platformAudit } from "@/lib/audit";

const resetSchema = z.object({
  newPassword: z.string().min(12, "Password must be at least 12 characters"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requirePlatformAdmin();
  if (r.ok === false) return r.response;
  const { id } = await params;

  const body = await req.json().catch((): null => null);
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const strength = validatePasswordStrength(parsed.data.newPassword);
  if (!strength.ok) {
    return NextResponse.json(
      { error: strength.reason ?? "Password does not meet strength requirements." },
      { status: 400 },
    );
  }

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, organizationId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await db.user.update({
    where: { id },
    data: { passwordHash: newHash, updatedAt: new Date() },
  });

  // Destroy active sessions so the user must re-authenticate with the new password
  await db.session.deleteMany({ where: { userId: id } }).catch(() => {});

  await platformAudit(
    {
      action: "platform_admin.password_reset",
      entity: "user",
      entityId: id,
      organizationId: user.organizationId, // affected org
      platformAdminId: r.session.adminId,
      details: { email: user.email, name: user.name, role: user.role },
    },
    req,
  );

  return NextResponse.json({
    ok: true,
    message: `Password reset for ${user.email}. Active sessions invalidated.`,
  });
}
