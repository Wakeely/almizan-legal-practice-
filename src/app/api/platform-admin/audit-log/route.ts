// =============================================================================
// GET /api/platform-admin/audit-log
// -----------------------------------------------------------------------------
// Platform-wide audit log read view. Gated by requirePlatformAdmin().
// PRD v0.3 §6: returns entries with nullable organizationId intact —
// platform-only actions (organizationId = null) are included.
//
// Query params: ?org= &category= &actorType= &q= &limit= &cursor=
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const r = await requirePlatformAdmin();
  if (r.ok === false) return r.response;

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("org") || undefined;
  const category = searchParams.get("category") || undefined;
  const actorType = searchParams.get("actorType") || undefined;
  const q = searchParams.get("q")?.trim() || undefined;
  const limit = Math.min(Number(searchParams.get("limit") || "100"), 500);
  const cursor = searchParams.get("cursor") || undefined;

  const where: Prisma.AuditLogWhereInput = {};
  if (orgId) where.organizationId = orgId;
  if (actorType && ["tenant_user", "platform_admin", "system"].includes(actorType)) {
    where.actorType = actorType;
  }
  if (category) {
    where.action = { startsWith: `${category}.` };
  }
  if (q) {
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { ipAddress: { contains: q, mode: "insensitive" } },
      { organization: { name: { contains: q, mode: "insensitive" } } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { platformAdmin: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const entries = await db.auditLog.findMany({
    where,
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      organizationId: true,
      organization: { select: { name: true } },
      actorType: true,
      userId: true,
      user: { select: { name: true } },
      platformAdminId: true,
      platformAdmin: { select: { name: true } },
      action: true,
      entity: true,
      entityId: true,
      matterId: true,
      details: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
    },
  });

  const hasMore = entries.length > limit;
  const trimmed = hasMore ? entries.slice(0, limit) : entries;
  const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id : undefined;

  return NextResponse.json({
    data: trimmed.map((al) => ({
      id: al.id,
      organizationId: al.organizationId,
      organizationName: al.organization?.name ?? null,
      actorType: al.actorType,
      userId: al.userId,
      userName: al.user?.name ?? null,
      platformAdminId: al.platformAdminId,
      platformAdminName: al.platformAdmin?.name ?? null,
      action: al.action,
      entity: al.entity,
      entityId: al.entityId,
      matterId: al.matterId,
      details: al.details ? (() => { try { return JSON.parse(al.details); } catch { return null; } })() : null,
      ipAddress: al.ipAddress,
      userAgent: al.userAgent,
      createdAt: al.createdAt.toISOString(),
    })),
    pagination: { nextCursor, hasMore, limit },
  });
}
