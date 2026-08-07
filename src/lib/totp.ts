// =============================================================================
// Al Mizan — TOTP (RFC 6238) implementation for PlatformAdmin MFA
// -----------------------------------------------------------------------------
// Pure Node `crypto` implementation of HOTP/TOTP — no external dependency
// (otplib etc.). Implements the standard 30-second window, 6-digit code,
// SHA-1 HMAC. Compatible with Google Authenticator, 1Password, Authy, etc.
//
// Phase 2 PRD §2.1: real MFA is the prerequisite for impersonation and
// break-glass. The mfaEnabled / mfaSecretEncrypted columns were already
// reserved on PlatformAdmin in Phase 1 — this module populates them.
// =============================================================================

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// ── Base32 (RFC 4648) — the encoding authenticator apps expect ─────────────
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ── Secret generation ──────────────────────────────────────────────────────
/** Generate a fresh 20-byte (160-bit) base32-encoded TOTP secret. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Generate a 6-digit recovery code (alphanumeric, no ambiguous chars). */
export function generateRecoveryCode(): string {
  // 8 chars, avoiding 0/O/1/I/L
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  // Format as XXXX-XXXX for readability
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => generateRecoveryCode());
}

// ── HOTP / TOTP core ──────────────────────────────────────────────────────
function hotp(secretBuffer: Buffer, counter: number, digits = 6): string {
  const counterBuffer = Buffer.alloc(8);
  // Write counter as big-endian 64-bit
  counterBuffer.writeBigInt64BE(BigInt(counter), 0);

  const hmac = createHmac("sha1", secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  const code = binary % Math.pow(10, digits);
  return code.toString().padStart(digits, "0");
}

/**
 * Generate the current TOTP code for a base32 secret. Mainly used for tests
 * and diagnostics — production verifies codes, never generates them server-side.
 */
export function generateTotp(secretBase32: string, now: number = Date.now()): string {
  const counter = Math.floor(now / 1000 / 30);
  return hotp(base32Decode(secretBase32), counter);
}

/**
 * Verify a TOTP code against a base32 secret. Allows ±1 window (±30s) to
 * accommodate clock drift between the authenticator app and the server.
 *
 * Uses a constant-time comparison of the derived code (not the input) to
 * avoid timing side-channels on the user-supplied value.
 */
export function verifyTotp(
  token: string,
  secretBase32: string,
  now: number = Date.now(),
  windowSteps = 1,
): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  const counter = Math.floor(now / 1000 / 30);
  let secretBuffer: Buffer;
  try {
    secretBuffer = base32Decode(secretBase32);
  } catch {
    return false;
  }
  for (let i = -windowSteps; i <= windowSteps; i++) {
    const expected = hotp(secretBuffer, counter + i);
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(token);
    if (
      expectedBuf.length === providedBuf.length &&
      timingSafeEqual(expectedBuf, providedBuf)
    ) {
      return true;
    }
  }
  return false;
}

// ── otpauth URL (for QR code generation) ───────────────────────────────────
/**
 * Build the otpauth:// URL that authenticator apps scan. Format:
 *   otpauth://totp/Al%20Mizan:admin@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Al%20Mizan
 */
export function buildOtpAuthUrl(
  email: string,
  secretBase32: string,
  issuer = "Al Mizan",
): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
