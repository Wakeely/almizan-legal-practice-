// =============================================================================
// POST /api/auth/reset-password
// MVP: always returns 200 (does not leak whether email exists).
// Real email delivery is a documented CURRENT LIMITATION — see README.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, resetPasswordSchema } from "@/lib/validation/auth";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = await authRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(resetPasswordSchema, body);
  if (!parsed.ok) return NextResponse.json({ ok: true }); // don't leak

  const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (user) {
    // TODO: implement real email delivery (SendGrid / SES / SMTP).
    await audit({ action: "auth.password-reset.requested", entity: "user", entityId: user.id, details: { email: user.email } }, req);
  }

  return NextResponse.json({ ok: true });
}
