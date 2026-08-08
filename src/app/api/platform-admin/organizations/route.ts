// =============================================================================
// GET /api/platform-admin/organizations
// -----------------------------------------------------------------------------
// List/search all organizations across the platform. Cross-org read — gated
// by requirePlatformAdmin(). Writes NO audit entry (read-only).
//
// Query params: ?q= &status= &jurisdiction= &limit= &cursor=
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
  const status = searchParams.get("status") || undefined;
  const jurisdiction = searchParams.get("jurisdiction") || undefined;
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 200);
  const cursor = searchParams.get("cursor") || undefined;

  const where: Prisma.OrganizationWhereInput = {};
  if (status && ["active", "suspended", "archived"].includes(status)) {
    where.status = status;
  }
  if (jurisdiction) {
    where.jurisdiction = jurisdiction;
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { barAssociationId: { contains: q, mode: "insensitive" } },
    ];
  }

  const orgs = await db.organization.findMany({
    where,
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      barAssociationId: true,
      jurisdiction: true,
      status: true,
      investigationAgentEnabled: true,
      aiKeyProvider: true,
      // Select the encrypted key columns ONLY to derive aiKeyConfigured (bool).
      // The key VALUES are never serialized to the client — only the boolean.
      aiKeyOpenaiEncrypted: true,
      aiKeyXaiEncrypted: true,
      aiKeyGeminiEncrypted: true,
      aiKeyLastVerifiedAt: true,
      suspendedAt: true,
      suspendedReason: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          users: { where: { deletedAt: null } },
          matters: { where: { deletedAt: null } },
          documents: true,
          auditLogs: true,
        },
      },
    },
  });

  const hasMore = orgs.length > limit;
  const trimmed = hasMore ? orgs.slice(0, limit) : orgs;
  const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id : undefined;

  return NextResponse.json({
    data: trimmed.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      barAssociationId: o.barAssociationId,
      jurisdiction: o.jurisdiction,
      status: o.status,
      investigationAgentEnabled: o.investigationAgentEnabled,
      aiKeyProvider: o.aiKeyProvider,
      aiKeyConfigured:
        !!o.aiKeyOpenaiEncrypted ||
        !!o.aiKeyXaiEncrypted ||
        !!o.aiKeyGeminiEncrypted,
      aiKeyLastVerifiedAt: o.aiKeyLastVerifiedAt?.toISOString() ?? null,
      suspendedAt: o.suspendedAt?.toISOString() ?? null,
      suspendedReason: o.suspendedReason,
      userCount: o._count.users,
      matterCount: o._count.matters,
      documentCount: o._count.documents,
      auditLogCount: o._count.auditLogs,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    })),
    pagination: { nextCursor, hasMore, limit },
  });
}
