// =============================================================================
// POST /api/admin/enable-investigation-addon — enable the add-on for ONE org
// -----------------------------------------------------------------------------
// Flips Organization.investigationAgentEnabled from false → true for ONE
// organization identified by orgId, slug, or a user's email in the body.
//
// WHY THIS EXISTS:
//   The owner is non-technical and can't run SQL. This endpoint lets them
//   enable the Investigation Agent add-on for their own test org from the
//   browser, without affecting any other organization.
//
// SECURITY (3 layers, token-based since login may be broken):
//   1. INVESTIGATION_SETUP_ENABLED=1 env var — kill-switch.
//   2. PASSWORD_RESET_TOKEN env var — bearer token, must be supplied in body.
//      Same token as the other admin endpoints. Shared so the owner only
//      manages one secret.
//   3. audit() log entry — records which org was enabled + by whom (IP).
//
// WHAT IT DOES:
//   - Takes { token, orgId? | slug? | userEmail? } in the body
//   - Resolves the target org (by orgId, or slug, or the org of the user with
//     the given email)
//   - Sets Organization.investigationAgentEnabled = true for THAT org only
//   - Returns the updated org row (id, name, slug, investigationAgentEnabled)
//   - Idempotent — calling it twice is safe (just stays true)
//
// WHAT IT DOES NOT DO:
//   - Does NOT enable the add-on for any other organization.
//   - Does NOT change any other field on Organization.
//   - Does NOT bypass the role gate or the paywall — those still apply to
//     everyone else.
//
// AFTER TESTING: to disable the add-on, set INVESTIGATION_SETUP_ENABLED=0 in
// Vercel + redeploy (locks this endpoint). The toggle persists — to actually
// turn it off, run this SQL in your DB console:
//   UPDATE "Organization" SET "investigationAgentEnabled" = FALSE WHERE id = '<your-org-id>';
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";

const enableSchema = z.object({
  token: z.string().min(8, "Token is required"),
  orgId: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  userEmail: z.string().email().optional(),
}).refine(
  (d) => d.orgId || d.slug || d.userEmail,
  { message: "Provide one of: orgId, slug, or userEmail" },
);

export async function POST(req: Request) {
  // ── Layer 1: kill-switch ───────────────────────────────────────────────
  if (process.env.INVESTIGATION_SETUP_ENABLED !== "1") {
    return NextResponse.json(
      {
        error: "This endpoint is disabled. Set INVESTIGATION_SETUP_ENABLED=1 + PASSWORD_RESET_TOKEN=<your-secret> in Vercel env vars + redeploy.",
        disabled: true,
      },
      { status: 403 },
    );
  }

  // ── Layer 2: token check ───────────────────────────────────────────────
  // Accept EITHER PASSWORD_RESET_TOKEN OR ADMIN_BOOTSTRAP_TOKEN so the owner
  // can use whichever token they have on hand. Both are kill-switched by
  // INVESTIGATION_SETUP_ENABLED above.
  const resetToken = process.env.PASSWORD_RESET_TOKEN;
  const bootstrapToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
  const validTokens = [resetToken, bootstrapToken].filter(
    (t): t is string => !!t && t.length >= 8,
  );
  if (validTokens.length === 0) {
    return NextResponse.json(
      { error: "Server misconfigured: neither PASSWORD_RESET_TOKEN nor ADMIN_BOOTSTRAP_TOKEN is set. Set one in Vercel env vars + redeploy." },
      { status: 500 },
    );
  }

  // ── Rate limit ─────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  const limit = await authRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please retry shortly." },
      { status: 429 },
    );
  }

  // ── Parse body ─────────────────────────────────────────────────────────
  const body = await req.json().catch((): null => null);
  const parsed = enableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  const data = parsed.data;

  if (!validTokens.includes(data.token)) {
    return NextResponse.json(
      { error: "Invalid token." },
      { status: 401 },
    );
  }

  // ── Resolve the target org ─────────────────────────────────────────────
  let orgId: string | undefined;
  let resolvedBy: string;

  if (data.orgId) {
    orgId = data.orgId;
    resolvedBy = "orgId";
  } else if (data.slug) {
    const org = await db.organization.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });
    if (!org) {
      return NextResponse.json(
        { error: `No organization found with slug "${data.slug}".` },
        { status: 404 },
      );
    }
    orgId = org.id;
    resolvedBy = "slug";
  } else if (data.userEmail) {
    const user = await db.user.findUnique({
      where: { email: data.userEmail.toLowerCase() },
      select: { organizationId: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: `No user found with email "${data.userEmail}".` },
        { status: 404 },
      );
    }
    orgId = user.organizationId;
    resolvedBy = "userEmail";
  } else {
    return NextResponse.json(
      { error: "Provide one of: orgId, slug, or userEmail." },
      { status: 400 },
    );
  }

  // ── Flip the toggle for the target org ONLY ────────────────────────────
  try {
    const updated = await db.organization.update({
      where: { id: orgId },
      data: { investigationAgentEnabled: true },
      select: {
        id: true,
        name: true,
        slug: true,
        investigationAgentEnabled: true,
      },
    });

    await audit(
      {
        action: "admin.investigation_addon_enabled",
        entity: "organization",
        entityId: orgId,
        details: {
          orgName: updated.name,
          orgSlug: updated.slug,
          resolvedBy,
          authMethod: "token",
        },
      },
      req,
    );

    return NextResponse.json({
      ok: true,
      message: `Investigation Agent add-on is now ENABLED for "${updated.name}" (${updated.slug}). No other organization is affected.`,
      organization: updated,
    });
  } catch (err: any) {
    // P2025 = record not found
    if (err?.code === "P2025") {
      return NextResponse.json(
        { error: `Organization with id "${orgId}" not found.` },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: `Failed to enable add-on: ${err?.message ?? String(err)}` },
      { status: 500 },
    );
  }
}

// GET — returns whether the endpoint is enabled (no auth, just status).
export async function GET() {
  return NextResponse.json({
    enabled: process.env.INVESTIGATION_SETUP_ENABLED === "1",
    tokenConfigured: !!process.env.PASSWORD_RESET_TOKEN && process.env.PASSWORD_RESET_TOKEN.length >= 8,
    message: "POST with { token, orgId | slug | userEmail } to enable the add-on for one org.",
  });
}
