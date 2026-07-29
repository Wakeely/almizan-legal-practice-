import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function validatePasswordStrength(plain: string): { ok: boolean; reason?: string } {
  if (plain.length < 12) {
    return { ok: false, reason: "Password must be at least 12 characters" };
  }
  if (!/[a-z]/.test(plain)) {
    return { ok: false, reason: "Password must contain at least one lowercase letter" };
  }
  if (!/[A-Z]/.test(plain)) {
    return { ok: false, reason: "Password must contain at least one uppercase letter" };
  }
  if (!/[0-9]/.test(plain)) {
    return { ok: false, reason: "Password must contain at least one digit" };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(plain)) {
    return { ok: false, reason: "Password must contain at least one special character" };
  }
  return { ok: true };
}
