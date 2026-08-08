// =============================================================================
// POST /api/student-codes/redeem — apply a promo code to the signed-in user
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/org";
import { parseBody, redeemStudentCodeSchema } from "@/lib/validation/auth";
import { redeemStudentCode, getPromoAllowance } from "@/lib/student-access";

export async function POST(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(redeemStudentCodeSchema, body);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await redeemStudentCode(parsed.data.code, r.session.id);
  if (result.ok === false) return NextResponse.json({ error: result.error }, { status: 400 });

  const allowance = await getPromoAllowance(r.session.id);
  return NextResponse.json({ ok: true, limits: result.limits, allowance });
}