// =============================================================================
// GET /api/platform-admin/users
// -----------------------------------------------------------------------------
// Cross-org user search. Gated by requirePlatformAdmin(). Read-only.
// Query params: ?q= &role= &plan= &org= &deleted= &limit= &cursor=
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const r = await requirePlatformAdmin();
  if (r.ok === false) return r.response;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const role = searchParams.get("role") || undefined;
  const plan = searchParams.get("plan") || undefined;
  const orgId = searchParams.get("org") || undefined;
  const includeDeleted = searchParams.get("deleted") === "1";
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 200);
  const cursor = searchParams.get("cursor") || undefined;

  const where: Prisma.UserWhereInput = {};
  if (!includeDeleted) {
    where.deletedAt = null;
  }
  if (role) where.role = role;
  if (plan) where.subscriptionTier = plan;
  if (orgId) where.organizationId = orgId;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { barAssociationId: { contains: q, mode: "insensitive" } },
    ];
  }

  const users = await db.user.findMany({
    where,
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      accountType: true,
      barAssociationId: true,
      jurisdiction: true,
      subscriptionTier: true,
      planStatus: true,
      trialDaysLeft: true,
      seats: true,
      maxSeats: true,
      billingCycle: true,
      renewalDate: true,
      accessKind: true,
      promoCode: true,
      deletedAt: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
      organization: {
        select: { id: true, name: true, slug: true, status: true },
      },
    },
  });

  const hasMore = users.length > limit;
  const trimmed = hasMore ? users.slice(0, limit) : users;
  const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id : undefined;

  return NextResponse.json({
    data: trimmed.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      accountType: u.accountType,
      barAssociationId: u.barAssociationId,
      jurisdiction: u.jurisdiction,
      subscriptionTier: u.subscriptionTier,
      planStatus: u.planStatus,
      trialDaysLeft: u.trialDaysLeft,
      seats: u.seats,
      maxSeats: u.maxSeats,
      billingCycle: u.billingCycle,
      renewalDate: u.renewalDate,
      accessKind: u.accessKind,
      promoCode: u.promoCode,
      deletedAt: u.deletedAt?.toISOString() ?? null,
      emailVerified: u.emailVerified?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      organization: u.organization
        ? {
            id: u.organization.id,
            name: u.organization.name,
            slug: u.organization.slug,
            status: u.organization.status,
          }
        : null,
    })),
    pagination: { nextCursor, hasMore, limit },
  });
}
