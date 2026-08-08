// =============================================================================
// Al Mizan — Bring Your Own AI Key (BYOK)
// -----------------------------------------------------------------------------
// Paid organizations may store their own AI provider keys (OpenAI / xAI /
// Gemini). Keys are stored ENCRYPTED at rest on the Organization row using
// AES-256-GCM with a master secret from env (KEYS_ENCRYPTION_KEY, falling
// back to AUTH_SECRET / NEXTAUTH_SECRET).
//
// SERVER-SIDE ONLY — decrypted keys never leave the server. The API only
// exposes whether an org key exists and which provider is active.
// =============================================================================

import "server-only";
import crypto from "crypto";
import { db } from "@/lib/db";
import type { AiProvider, OrgAiKeys, ResolvedAiKey, AiKeySource } from "@/lib/types";

// -----------------------------------------------------------------------------
// Encryption
// -----------------------------------------------------------------------------

const KEY_ENV_NAMES = ["KEYS_ENCRYPTION_KEY", "AUTH_SECRET", "NEXTAUTH_SECRET"] as const;

function getMasterKey(): Buffer | null {
  for (const name of KEY_ENV_NAMES) {
    const value = process.env[name];
    if (value && value.length >= 16) {
      return crypto.createHash("sha256").update(value).digest();
    }
  }
  return null;
}

/** AES-256-GCM encrypt. Output: base64(iv):base64(ciphertext+tag). */
export function encryptSecret(plaintext: string): string | null {
  const masterKey = getMasterKey();
  if (!masterKey) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${Buffer.concat([encrypted, tag]).toString("base64")}`;
}

/** AES-256-GCM decrypt. Accepts the output of encryptSecret(). */
export function decryptSecret(stored: string): string | null {
  const masterKey = getMasterKey();
  if (!masterKey) return null;
  const [ivB64, dataB64] = stored.split(":");
  if (!ivB64 || !dataB64) return null;
  try {
    const iv = Buffer.from(ivB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    const tag = data.subarray(data.length - 16);
    const ciphertext = data.subarray(0, data.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (err) {
    console.error("[ai-keys] decrypt failed:", (err as Error)?.message);
    return null;
  }
}

// -----------------------------------------------------------------------------
// Storage accessors
// -----------------------------------------------------------------------------

/**
 * Load the org's stored (still-encrypted) AI key fields. Caller decides
 * whether to decrypt. Never include these in client responses.
 */
export async function getOrgAiKeyFields(organizationId: string): Promise<OrgAiKeys | null> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      aiKeyProvider: true,
      aiKeyOpenaiEncrypted: true,
      aiKeyXaiEncrypted: true,
      aiKeyGeminiEncrypted: true,
      aiKeyUpdatedAt: true,
      aiKeyLastVerifiedAt: true,
    },
  });
  if (!org) return null;
  return {
    provider: (org.aiKeyProvider as AiProvider | null) ?? null,
    openai: org.aiKeyOpenaiEncrypted ?? null,
    xai: org.aiKeyXaiEncrypted ?? null,
    gemini: org.aiKeyGeminiEncrypted ?? null,
    updatedAt: org.aiKeyUpdatedAt ? org.aiKeyUpdatedAt.toISOString() : null,
    lastVerifiedAt: org.aiKeyLastVerifiedAt ? org.aiKeyLastVerifiedAt.toISOString() : null,
  };
}

/** Decrypt every stored key the org has (server-only use). */
export async function getOrgAiKeysDecrypted(organizationId: string): Promise<{
  provider: AiProvider | null;
  keys: Record<AiProvider, string | null>;
}> {
  const fields = await getOrgAiKeyFields(organizationId);
  if (!fields) return { provider: null, keys: { openai: null, xai: null, gemini: null } };
  const decrypt = (s: string | null) => (s ? decryptSecret(s) : null);
  return {
    provider: fields.provider,
    keys: {
      openai: decrypt(fields.openai),
      xai: decrypt(fields.xai),
      gemini: decrypt(fields.gemini),
    },
  };
}

// -----------------------------------------------------------------------------
// Key resolution (preferred provider → org key → platform env key)
// -----------------------------------------------------------------------------

const PROVIDERS: AiProvider[] = ["openai", "xai", "gemini"];

/**
 * Decide which provider + key to use for an AI call.
 *
 * Order:
 *  1. Org's preferred provider (aiKeyProvider) if it has a stored key.
 *  2. Any other org-stored key, in order openai → xai → gemini.
 *  3. Platform fallback: env key for that provider (openai → xai → gemini).
 *
 * Returns null only if NO provider has any key at all (caller should stub).
 */
export async function resolveAiKey(organizationId: string): Promise<ResolvedAiKey | null> {
  const decrypted = await getOrgAiKeysDecrypted(organizationId);

  // 1. Preferred provider with a stored key.
  if (decrypted.provider) {
    const key = decrypted.keys[decrypted.provider];
    if (key) {
      return { provider: decrypted.provider, apiKey: key, keySource: "org" };
    }
  }

  // 2. First other org-stored key.
  for (const provider of PROVIDERS) {
    if (provider !== decrypted.provider && decrypted.keys[provider]) {
      return { provider, apiKey: decrypted.keys[provider]!, keySource: "org" };
    }
  }

  // 3. Platform fallback.
  const platform: Record<AiProvider, () => string | undefined> = {
    openai: () => process.env.OPENAI_API_KEY ?? undefined,
    xai: () => process.env.XAI_API_KEY ?? process.env.GROK_API_KEY ?? undefined,
    gemini: () => process.env.GEMINI_API_KEY ?? undefined,
  };
  for (const provider of PROVIDERS) {
    const key = platform[provider]();
    if (key) {
      return { provider, apiKey: key, keySource: "platform" };
    }
  }

  return null;
}

/**
 * Convert a ResolvedAiKey into per-call opts + a human label. Callers pass
 * the opts to callGemini / callOpenAI / callXai. `model` is provider-specific
 * and set here so a single resolved key drives all call sites consistently.
 */
export function aiKeyToCallOpts(resolved: ResolvedAiKey | null): {
  opts: { apiKey?: string; keySource: AiKeySource; model?: string };
  source: AiKeySource;
} {
  if (!resolved) {
    return { opts: { keySource: "platform" }, source: "platform" };
  }
  return {
    opts: {
      apiKey: resolved.apiKey,
      keySource: resolved.keySource,
      model: defaultModelForProvider(resolved.provider),
    },
    source: resolved.keySource,
  };
}

/** Default model per provider (mirrors each lib's PRIMARY_MODEL). */
export function defaultModelForProvider(provider: AiProvider): string {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_MODEL || "gpt-4o-mini";
    case "xai":
      return process.env.XAI_MODEL || "grok-3";
    case "gemini":
    default:
      return process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash-lite";
  }
}

// -----------------------------------------------------------------------------
// Platform status (for the billing/keys UI)
// -----------------------------------------------------------------------------

/** Per-provider key presence (org + platform) for the settings UI. */
export async function getAiKeyStatus(
  organizationId: string,
): Promise<Record<AiProvider, { org: boolean; platform: boolean }>> {
  const fields = await getOrgAiKeyFields(organizationId);
  const hasOrg = (p: AiProvider) =>
    p === "openai" ? !!fields?.openai : p === "xai" ? !!fields?.xai : !!fields?.gemini;
  return {
    openai: { org: hasOrg("openai"), platform: !!process.env.OPENAI_API_KEY },
    xai: { org: hasOrg("xai"), platform: !!(process.env.XAI_API_KEY || process.env.GROK_API_KEY) },
    gemini: { org: hasOrg("gemini"), platform: !!process.env.GEMINI_API_KEY },
  };
}
