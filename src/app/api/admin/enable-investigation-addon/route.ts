// =============================================================================
// POST /api/admin/enable-investigation-addon — enable the add-on for ONE org
// -----------------------------------------------------------------------------
// Flips Organization.investigationAgentEnabled from false → true for the
// Managing Partner's OWN organization only. Does NOT touch any other org.
//
// WHY THIS EXISTS:
//   The owner is non-technical and can't run SQL. This endpoint lets them
//   enable the Investigation Agent add-on for their own test org from the
//   browser, without affecting any other organization.
//
// SECURITY (3 layers):
//   1. requireRole(["MANAGING_PARTNER", "Managing Partner"]) — only the firm
//      owner can flip their own org's toggle.
//   2. INVESTIGATION_SETUP_ENABLED=1 env var — same kill-switch as the schema
//      setup endpoint. Lock both down together after testing.
//   3. audit() log entry — records who enabled it + for which org.
//
// WHAT IT DOES:
//   - Sets Organization.investigationAgentEnabled = true for the caller's org
//   - Returns the updated org row (just the toggle field, nothing sensitive)
//   - Idempotent — calling it twice is safe (just stays true)
//
// WHAT IT DOES NOT DO:
//   - Does NOT enable the add-on for any other organization.
//   - Does NOT change any other field on Organization.
//   - Does NOT bypass the role gate or the paywall — those still apply to
//     everyone else.
//
// AFTER TESTING: to disable the add-on for your test org, set
// INVESTIGATION_SETUP_ENABLED=0 in Vercel (locks this endpoint) and contact
// me to add a disable endpoint, OR run this SQL once in your DB console:
//   UPDATE "Organization" SET "investigationAgentEnabled" = FALSE WHERE id = '<your-org-id>';
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/org";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  // ── Layer 1: auth — Managing Partner only ──────────────────────────────
  const r = await requireRole(["MANAGING_PARTNER", "Managing Partner"]);
  if (r.ok === false) return r.response;

  // ── Layer 2: kill-switch ───────────────────────────────────────────────
  if (process.env.INVESTIGATION_SETUP_ENABLED !== "1") {
    return NextResponse.json(
      {
        error:
          "This endpoint is disabled. Set INVESTIGATION_SETUP_ENABLED=1 in Vercel environment variables + redeploy to enable.",
        disabled: true,
      },
      { status: 403 },
    );
  }

  // ── Flip the toggle for the caller's org ONLY ──────────────────────────
  // We use r.session.organizationId so this can never affect another org,
  // even if the caller tried to pass a different orgId in the body.
  const updated = await db.organization.update({
    where: { id: r.session.organizationId },
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
      entityId: r.session.organizationId,
      details: {
        orgName: updated.name,
        orgSlug: updated.slug,
        enabledBy: r.session.id,
      },
    },
    req,
  );

  return NextResponse.json({
    ok: true,
    message: `Investigation Agent add-on is now ENABLED for "${updated.name}" (${updated.slug}). No other organization is affected. You can now use the Investigation tab.`,
    organization: updated,
  });
}

// GET — check whether the caller's org has the add-on enabled.
export async function GET() {
  const r = await requireRole(["MANAGING_PARTNER", "Managing Partner"]);
  if (r.ok === false) return r.response;

  const org = await db.organization.findUnique({
    where: { id: r.session.organizationId },
    select: { id: true, name: true, slug: true, investigationAgentEnabled: true },
  });

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json({
    organization: org,
    setupEndpointEnabled: process.env.INVESTIGATION_SETUP_ENABLED === "1",
  });
}
