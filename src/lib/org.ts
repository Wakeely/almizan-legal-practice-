import { getSessionUser } from "@/lib/session";
import type { SessionUser } from "@/lib/session";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export interface AuthedRequest {
  session: SessionUser;
}

export async function requireUser(): Promise<
  { ok: true; session: SessionUser } | { ok: false; response: NextResponse }
> {
  const session = await getSessionUser();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  // ── Suspended-org gate (PRD v0.3 §7) ────────────────────────────────────
  // If the caller's organization is suspended or archived, every tenant API
  // call must fail with a clear error. This catches sessions issued BEFORE
  // the org was suspended (the login route also rejects new logins for
  // suspended orgs — see src/lib/auth-options.ts authorize()).
  //
  // This is an ADDITIVE guard. It does NOT bypass orgWhere() — it adds a
  // status check on top of the existing organizationId scoping. The existing
  // tenant /api/* handlers continue to use orgWhere() exactly as before.
  const org = await db.organization.findUnique({
    where: { id: session.organizationId },
    select: { status: true },
  });
  if (!org || org.status !== "active") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Your organization is not active. Contact your platform administrator.",
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, session };
}

export async function requireRole(roles: string[]): Promise<
  { ok: true; session: SessionUser } | { ok: false; response: NextResponse }
> {
  const r = await requireUser();
  if (r.ok === false) return r;
  if (!roles.includes(r.session.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden — insufficient role" },
        { status: 403 },
      ),
    };
  }
  return r;
}

export function orgWhere<T extends Record<string, unknown>>(
  session: SessionUser,
  extra?: T,
) {
  return {
    organizationId: session.organizationId,
    deletedAt: null as Date | null,
    ...(extra ?? {}),
  };
}

export function orgWhereWithDeleted<T extends Record<string, unknown>>(
  session: SessionUser,
  extra?: T,
) {
  return {
    organizationId: session.organizationId,
    ...(extra ?? {}),
  };
}

export async function verifyMatterBelongsToOrg(
  matterId: string,
  session: SessionUser,
): Promise<boolean> {
  const matter = await db.matter.findFirst({
    where: { id: matterId, organizationId: session.organizationId, deletedAt: null },
    select: { id: true },
  });
  return !!matter;
}
