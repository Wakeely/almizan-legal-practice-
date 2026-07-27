// =============================================================================
// GET /api/audit-log — Audit log viewer (Managing Partner only)
// -----------------------------------------------------------------------------
// SECURITY (per master system prompt rule #4 + rule #8):
// - Reads are restricted to MANAGING_PARTNER role within the same org.
// - Returns org-scoped entries only (cannot see other firms' audit logs).
// - Supports pagination + filtering by action / entity / userId / matterId.
// - The AuditLog model is APPEND-ONLY — there is no PATCH/DELETE endpoint.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";
import { audit } from "@/lib/audit";

export async function GET(req: Request) {
  const r = await requireUser();
  if (!r.ok) return r.response;

  // Restrict to Managing Partner role (per master system prompt)
  if (r.session.role !== "Managing Partner") {
    return NextResponse.json(
      { error: "Forbidden — audit log access is restricted to Managing Partners" },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const entity = url.searchParams.get("entity");
  const userId = url.searchParams.get("userId");
  const matterId = url.searchParams.get("matterId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10), 0);

  const where: Record<string, unknown> = orgWhere(r.session);
  if (action) where.action = { contains: action };
  if (entity) where.entity = entity;
  if (userId) where.userId = userId;
  if (matterId) where.matterId = matterId;

  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  // Audit the audit-log access itself (meta-audit) — but only the access,
  // not the contents (to avoid recursive logging).
  await audit({
    action: "audit-log.view",
    details: { filters: { action, entity, userId, matterId }, resultCount: entries.length },
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      ...e,
      details: e.details ? JSON.parse(e.details) : null,
    })),
    total,
    limit,
    offset,
  });
}
