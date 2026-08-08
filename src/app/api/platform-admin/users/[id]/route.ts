// =============================================================================
// GET  /api/platform-admin/users/[id] — full user detail (cross-org)
// PATCH /api/platform-admin/users/[id] — soft-delete / restore
// -----------------------------------------------------------------------------
// PRD v0.3 §6: user-scoped admin actions write a platform_admin.* audit entry
// with organizationId = the user's org (the affected org).
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { platformAudit } from "@/lib/audit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requirePlatformAdmin();
  if (r.ok === false) return r.response;
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    include: {
      organization: { select: { id: true, name: true, slug: true, status: true } },
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      accountType: user.accountType,
      barAssociationId: user.barAssociationId,
      jurisdiction: user.jurisdiction,
      subscriptionTier: user.subscriptionTier,
      planStatus: user.planStatus,
      trialDaysLeft: user.trialDaysLeft,
      seats: user.seats,
      maxSeats: user.maxSeats,
      billingCycle: user.billingCycle,
      renewalDate: user.renewalDate,
      biometricEnabled: user.biometricEnabled,
      accessKind: user.accessKind,
      promoCode: user.promoCode,
      promoMaxMatters: user.promoMaxMatters,
      promoAiQuota: user.promoAiQuota,
      promoAiQuotaPeriod: user.promoAiQuotaPeriod,
      promoAiUsed: user.promoAiUsed,
      promoExpiresAt: user.promoExpiresAt,
      emailVerified: user.emailVerified?.toISOString() ?? null,
      deletedAt: user.deletedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      organization: user.organization
        ? {
            id: user.organization.id,
            name: user.organization.name,
            slug: user.organization.slug,
            status: user.organization.status,
          }
        : null,
    },
  });
}

const patchSchema = z.object({
  action: z.enum(["soft_delete", "restore"]),
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

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, deletedAt: true, organizationId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const now = new Date();
  if (parsed.data.action === "soft_delete") {
    if (user.deletedAt) {
      return NextResponse.json({ error: "User is already soft-deleted." }, { status: 409 });
    }
    await db.user.update({
      where: { id },
      data: { deletedAt: now, updatedAt: now },
    });
    // Also destroy active sessions so the user can't keep using the app
    await db.session.deleteMany({ where: { userId: id } }).catch(() => {});
    await platformAudit(
      {
        action: "platform_admin.user_soft_delete",
        entity: "user",
        entityId: id,
        organizationId: user.organizationId, // affected org
        platformAdminId: r.session.adminId,
        details: { email: user.email, name: user.name },
      },
      req,
    );
  } else {
    if (!user.deletedAt) {
      return NextResponse.json({ error: "User is not soft-deleted." }, { status: 409 });
    }
    await db.user.update({
      where: { id },
      data: { deletedAt: null, updatedAt: now },
    });
    await platformAudit(
      {
        action: "platform_admin.user_restore",
        entity: "user",
        entityId: id,
        organizationId: user.organizationId,
        platformAdminId: r.session.adminId,
        details: { email: user.email, name: user.name },
      },
      req,
    );
  }

  return NextResponse.json({ ok: true });
}
