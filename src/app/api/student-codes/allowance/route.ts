// =============================================================================
// GET /api/student-codes/allowance — current promo usage summary (any user)
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/org";
import { getPromoAllowance } from "@/lib/student-access";

export async function GET() {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const allowance = await getPromoAllowance(r.session.id);
  // Non-promo accounts report null (no promo banner shown on the client).
  return NextResponse.json({ allowance });
}