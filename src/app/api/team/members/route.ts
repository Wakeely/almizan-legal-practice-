// =============================================================================
// GET /api/team/members — list current org's users
// -----------------------------------------------------------------------------
// PRD v0.6 §5.2, §5.3: the missing piece for the Team workspace page.
// Any org member can view; only Managing Partner can invite/remove (enforced
// at the invite/remove routes, not here).
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhereWithDeleted } from "@/lib/org";

export async function GET() {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const users = await db.user.findMany({
    where: orgWhereWithDeleted(r.session),
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      accountType: true,
      primaryMatterId: true,
      deletedAt: true,
      createdAt: true,
      emailVerified: true,
    },
  });

  return NextResponse.json({
    data: users.map((u) => ({
      ...u,
      deletedAt: u.deletedAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      emailVerified: u.emailVerified?.toISOString() ?? null,
      isCurrentUser: u.id === r.session.id,
    })),
  });
}
