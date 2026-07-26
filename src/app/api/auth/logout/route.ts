// POST /api/auth/logout — audit only. Actual cookie clearing handled by
// NextAuth's /api/auth/signout endpoint which the client calls via signOut().

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (session) {
    await audit({ action: "auth.logout", entity: "user", entityId: session.id }, req);
  }
  return NextResponse.json({ ok: true });
}
