// =============================================================================
// POST /api/platform-admin/auth/mfa/disable
// -----------------------------------------------------------------------------
// Phase 2 §2.1: disable MFA for the acting PlatformAdmin. Requires a valid
// TOTP code (or recovery code) to prevent an attacker who momentarily has
// the session cookie from disabling MFA. Clears mfaEnabled +
// mfaSecretEncrypted + all recovery codes.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { platformAudit } from "@/lib/audit";
import { decryptSecret } from "@/lib/ai-keys";
import { verifyTotp } from "@/lib/totp";

const disableSchema = z.object({
  code: z.string().min(1, "MFA code required to confirm disable."),
});

function hashRecoveryCode(code: string): string {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}

export async function POST(req: Request) {
  const r = await requirePlatformAdmin();
  if (r.ok === false) return r.response;

  const body = await req.json().catch((): null => null);
  const parsed = disableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { code } = parsed.data;

  if (!r.session.mfaEnabled) {
    return NextResponse.json({ error: "MFA is not enabled." }, { status: 400 });
  }

  // Verify the code (TOTP or recovery)
  const admin = await db.platformAdmin.findUnique({
    where: { id: r.session.adminId },
    select: { mfaSecretEncrypted: true },
  });
  let verified = false;
  if (admin?.mfaSecretEncrypted) {
    const secret = decryptSecret(admin.mfaSecretEncrypted);
    if (secret && verifyTotp(code, secret)) verified = true;
  }
  if (!verified) {
    const codeHash = hashRecoveryCode(code);
    const recovery = await db.platformAdminRecoveryCode.findUnique({
      where: { codeHash },
      select: { id: true, usedAt: true },
    });
    if (recovery && !recovery.usedAt) {
      await db.platformAdminRecoveryCode.update({
        where: { id: recovery.id },
        data: { usedAt: new Date() },
      });
      verified = true;
    }
  }
  if (!verified) {
    return NextResponse.json({ error: "Invalid MFA code." }, { status: 401 });
  }

  await db.$transaction([
    db.platformAdmin.update({
      where: { id: r.session.adminId },
      data: { mfaEnabled: false, mfaSecretEncrypted: null },
    }),
    db.platformAdminRecoveryCode.deleteMany({
      where: { platformAdminId: r.session.adminId },
    }),
  ]);

  await platformAudit(
    {
      action: "platform_admin.mfa_disable",
      entity: "platform_admin",
      entityId: r.session.adminId,
      organizationId: null,
      platformAdminId: r.session.adminId,
      details: {},
    },
    req,
  );

  return NextResponse.json({ ok: true });
}
