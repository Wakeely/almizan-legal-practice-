// =============================================================================
// Al Mizan — password hashing utilities (bcrypt)
// Server-side only. Used by /api/auth/* routes.
// =============================================================================

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Validate password strength — minimum 8 chars, mix of letters & numbers
export function validatePasswordStrength(plain: string): { ok: boolean; reason?: string } {
  if (plain.length < 8) return { ok: false, reason: "Password must be at least 8 characters" };
  if (!/[A-Za-z]/.test(plain)) return { ok: false, reason: "Password must contain at least one letter" };
  if (!/[0-9]/.test(plain)) return { ok: false, reason: "Password must contain at least one digit" };
  return { ok: true };
}
