// =============================================================================
// POST /api/platform-admin/auth/mfa/enroll
// -----------------------------------------------------------------------------
// Phase 2 §2.1: TOTP enrollment for the acting PlatformAdmin.
//
// Two-step flow:
//   1. POST with { step: "begin" } → returns { secret, otpauthUrl } for the
//      authenticator app to scan. The secret is NOT yet persisted — the admin
//      must confirm with a valid code in step 2.
//   2. POST with { step: "confirm", secret, code } → verifies the code against
//      the secret; if valid, encrypts + persists the secret to
//      mfaSecretEncrypted, sets mfaEnabled = true, generates 10 recovery
//      codes (hashed at rest), and returns the plaintext recovery codes ONCE.
//
// The admin must already be authenticated (platform-admin session cookie).
// Enrollment can be re-run to rotate the secret + recovery codes.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { platformAudit } from "@/lib/audit";
import { encryptSecret } from "@/lib/ai-keys";
import {
  generateTotpSecret,
  generateRecoveryCodes,
  buildOtpAuthUrl,
  verifyTotp,
} from "@/lib/totp";
import { createHash } from "crypto";

const enrollSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("begin") }),
  z.object({
    step: z.literal("confirm"),
    secret: z.string().min(16),
    code: z.string().regex(/^\d{6}$/),
  }),
]);

function hashRecoveryCode(code: string): string {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}

export async function POST(req: Request) {
  const r = await requirePlatformAdmin();
  if (r.ok === false) return r.response;

  const body = await req.json().catch((): null => null);
  const parsed = enrollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (parsed.data.step === "begin") {
    // Generate a fresh secret + otpauth URL. NOT persisted yet — the admin
    // must scan + confirm with a valid code in step 2.
    const secret = generateTotpSecret();
    const otpauthUrl = buildOtpAuthUrl(r.session.email, secret);
    return NextResponse.json({ secret, otpauthUrl });
  }

  // step === "confirm"
  const { secret, code } = parsed.data;
  if (!verifyTotp(code, secret)) {
    return NextResponse.json(
      { error: "Invalid TOTP code. Make sure your device clock is correct and try again." },
      { status: 400 },
    );
  }

  // Encrypt + persist the secret
  const encrypted = encryptSecret(secret);
  if (!encrypted) {
    return NextResponse.json(
      { error: "Server misconfigured: KEYS_ENCRYPTION_KEY not set." },
      { status: 500 },
    );
  }

  // Generate recovery codes (plaintext returned ONCE, hashed at rest)
  const recoveryCodes = generateRecoveryCodes(10);

  // Persist in a transaction: update admin + replace all recovery codes
  await db.$transaction([
    db.platformAdmin.update({
      where: { id: r.session.adminId },
      data: { mfaEnabled: true, mfaSecretEncrypted: encrypted },
    }),
    // Delete any prior recovery codes (re-enrollment rotates them)
    db.platformAdminRecoveryCode.deleteMany({
      where: { platformAdminId: r.session.adminId },
    }),
    // Insert the new hashed recovery codes
    ...recoveryCodes.map((code) =>
      db.platformAdminRecoveryCode.create({
        data: {
          platformAdminId: r.session.adminId,
          codeHash: hashRecoveryCode(code),
        },
      }),
    ),
  ]);

  await platformAudit(
    {
      action: "platform_admin.mfa_enroll",
      entity: "platform_admin",
      entityId: r.session.adminId,
      organizationId: null,
      platformAdminId: r.session.adminId,
      details: { recoveryCodesIssued: recoveryCodes.length },
    },
    req,
  );

  return NextResponse.json({
    ok: true,
    recoveryCodes,
    message:
      "MFA enabled. Save these recovery codes in a secure location — they will not be shown again. Each can be used once in place of a TOTP code.",
  });
}
