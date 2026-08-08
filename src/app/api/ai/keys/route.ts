// =============================================================================
// Al Mizan — Bring Your Own AI Key API
// -----------------------------------------------------------------------------
//   GET    /api/ai/keys   → per-provider key status (org key present? platform
//                           key present? which is active). NEVER returns keys.
//   POST   /api/ai/keys   → save/replace an org key for a single provider.
//   DELETE /api/ai/keys   → remove an org key for a single provider.
//
// Gating: only Active PAID subscribers may save/delete keys (BYOK is a paid
// feature). Reading status is allowed for any authenticated org member so the
// billing page can show whether the platform fallback is in use.
//
// Keys are AES-256-GCM encrypted at rest and never returned to the browser.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { getFullUserProfile } from "@/lib/session";
import { encryptSecret, getAiKeyStatus, getOrgAiKeyFields, aiKeyToCallOpts } from "@/lib/ai-keys";
import { resolveAiKey } from "@/lib/ai-keys";
import { audit } from "@/lib/audit";
import type { AiProvider } from "@/lib/types";

const PROVIDERS: AiProvider[] = ["openai", "xai", "gemini"];

const ACTIVE_PAID_TIERS = [
  "Solo Practice",
  "Pro Practice",
  "Enterprise & Arbitration",
];

async function requirePaid(req: Request):
  Promise<{ ok: true; organizationId: string; profile: NonNullable<Awaited<ReturnType<typeof getFullUserProfile>>> } | { ok: false; response: NextResponse }> {
  const s = await requireUser();
  if (s.ok === false) return { ok: false, response: s.response };
  const profile = await getFullUserProfile();
  if (!profile) {
    return { ok: false, response: NextResponse.json({ error: "User profile not found" }, { status: 404 }) };
  }
  const isActivePaid =
    ACTIVE_PAID_TIERS.includes(profile.subscriptionTier) && profile.planStatus === "Active";
  if (!isActivePaid) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Bring Your Own AI Key requires an active paid plan.", upgradeRequired: true },
        { status: 403 },
      ),
    };
  }
  return { ok: true, organizationId: profile.organizationId, profile };
}

const setBodySchema = z.object({
  provider: z.enum(["openai", "xai", "gemini"]),
  key: z.string().min(5).max(2000),
  /** Make this the org's preferred provider (sets aiKeyProvider). */
  setActive: z.boolean().optional(),
});

const removeBodySchema = z.object({
  provider: z.enum(["openai", "xai", "gemini"]),
});

// -----------------------------------------------------------------------------
// GET — status (any authenticated user)
// -----------------------------------------------------------------------------

export async function GET(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const status = await getAiKeyStatus(r.session.organizationId);
  const resolved = await resolveAiKey(r.session.organizationId);
  const profile = await getFullUserProfile();
  const isActivePaid =
    profile &&
    ACTIVE_PAID_TIERS.includes(profile.subscriptionTier) &&
    profile.planStatus === "Active";

  return NextResponse.json({
    providers: status,
    active: resolved ? { provider: resolved.provider, source: resolved.keySource } : null,
    canManageKeys: !!isActivePaid,
  });
}

// -----------------------------------------------------------------------------
// POST — save / replace an org key
// -----------------------------------------------------------------------------

export async function POST(req: Request) {
  const r = await requirePaid(req);
  if (r.ok === false) return r.response;

  const body = await req.json().catch((): null => null);
  const parsed = setBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { provider, key } = parsed.data;
  const secretKey = key.trim();

  // Prefer encrypting with a dedicated master secret; return 500 if none set.
  const encrypted = encryptSecret(secretKey);
  if (!encrypted) {
    return NextResponse.json(
      { error: "Server encryption key is not configured. Contact support." },
      { status: 500 },
    );
  }

  const column =
    provider === "openai"
      ? "aiKeyOpenaiEncrypted"
      : provider === "xai"
        ? "aiKeyXaiEncrypted"
        : "aiKeyGeminiEncrypted";

  await db.organization.update({
    where: { id: r.organizationId },
    data: {
      [column]: encrypted,
      aiKeyUpdatedAt: new Date(),
      ...(parsed.data.setActive ? { aiKeyProvider: provider } : {}),
    },
  });

  await audit(
    { action: "byok.key.saved", entity: "organization", entityId: r.organizationId, details: { provider } },
    req,
  );

  return NextResponse.json({
    saved: true,
    provider,
    active: parsed.data.setActive ? provider : undefined,
    status: await getAiKeyStatus(r.organizationId),
  });
}

// -----------------------------------------------------------------------------
// DELETE — remove an org key
// -----------------------------------------------------------------------------

export async function DELETE(req: Request) {
  const r = await requirePaid(req);
  if (r.ok === false) return r.response;

  const body = await req.json().catch((): null => null);
  const parsed = removeBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { provider } = parsed.data;
  const column =
    provider === "openai"
      ? "aiKeyOpenaiEncrypted"
      : provider === "xai"
        ? "aiKeyXaiEncrypted"
        : "aiKeyGeminiEncrypted";

  await db.organization.update({
    where: { id: r.organizationId },
    data: { [column]: null, aiKeyUpdatedAt: new Date() },
  });

  await audit(
    { action: "byok.key.removed", entity: "organization", entityId: r.organizationId, details: { provider } },
    req,
  );

  return NextResponse.json({ removed: true, provider, status: await getAiKeyStatus(r.organizationId) });
}

// Re-export helpers used by the UI layer.
export { aiKeyToCallOpts };