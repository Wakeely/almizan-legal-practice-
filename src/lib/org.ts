// =============================================================================
// Al Mizan — multi-tenancy + authorization helpers
// -----------------------------------------------------------------------------
// These helpers enforce:
//   1. Authentication — every sensitive route must call requireUser() or
//      requireRole() at the top.
//   2. Organization isolation — every Prisma query that reads or writes
//      tenant-owned data MUST include `where: { organizationId: session.orgId }`.
//      Use the `orgWhere()` helper to enforce this consistently.
//   3. Role checks — sensitive mutations (e.g. subscription upgrade, audit log
//      reads) require specific roles.
// =============================================================================

import { getSessionUser } from "@/lib/session";
import type { SessionUser } from "@/lib/session";
import { NextResponse } from "next/server";

export interface AuthedRequest {
  session: SessionUser;
}

/** Require an authenticated user. Returns 401 JSON if missing. */
export async function requireUser(): Promise<{ ok: true; session: SessionUser } | { ok: false; response: NextResponse }> {
  const session = await getSessionUser();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, session };
}

/** Require the user to have one of the given roles. */
export async function requireRole(roles: string[]):
  Promise<{ ok: true; session: SessionUser } | { ok: false; response: NextResponse }> {
  const r = await requireUser();
  if (!r.ok) return r;
  if (!roles.includes(r.session.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden — insufficient role" }, { status: 403 }),
    };
  }
  return r;
}

/**
 * Returns a Prisma `where` clause fragment that scopes queries to the
 * authenticated user's organization. Use this on EVERY tenant-owned model.
 *
 * Example:
 *   const matters = await db.matter.findMany({ where: orgWhere(session, { status: 'Active' }) });
 */
export function orgWhere<T extends Record<string, unknown>>(session: SessionUser, extra?: T) {
  return { organizationId: session.organizationId, ...(extra ?? {}) };
}

/**
 * Validates that a given matterId belongs to the user's organization.
 * Use this before any mutation on matter-scoped resources.
 */
export async function verifyMatterBelongsToOrg(matterId: string, session: SessionUser): Promise<boolean> {
  const { db } = await import("@/lib/db");
  const matter = await db.matter.findFirst({
    where: { id: matterId, organizationId: session.organizationId },
    select: { id: true },
  });
  return !!matter;
}
