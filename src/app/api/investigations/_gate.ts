// =============================================================================
// Al Mizan — Investigation API gate (shared by all /api/investigations routes)
// -----------------------------------------------------------------------------
// Centralises the 3-layer authorisation every investigation route must pass:
//   1. requireUser()  — authenticated + org-scoped (from src/lib/org.ts)
//   2. requireRole()  — only Managing Partner / Senior Associate / In-House
//                       Counsel (Client Representative excluded by spec)
//   3. add-on gate    — Organization.investigationAgentEnabled must be true
//
// Returns either { ok: true, session } or { ok: false, response }. The route
// handler returns `gate.response` directly on failure — same pattern as the
// existing requireUser()/requireRole() helpers.
// =============================================================================

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/org";
import { db } from "@/lib/db";
import {
  INVESTIGATION_ALLOWED_ROLES,
} from "@/lib/agents/types";
import type { SessionUser } from "@/lib/session";

export type InvestigationGateResult =
  | { ok: true; session: SessionUser }
  | { ok: false; response: NextResponse };

/**
 * Run all 3 gates. Call this at the TOP of every investigation route handler,
 * before any business logic.
 *
 *   const gate = await requireInvestigationAccess();
 *   if (gate.ok === false) return gate.response;
 *   // ... use gate.session.organizationId / .id / .role
 */
export async function requireInvestigationAccess(): Promise<InvestigationGateResult> {
  // Layer 1 + 2: auth + role.
  const roleGate = await requireRole([...INVESTIGATION_ALLOWED_ROLES]);
  if (roleGate.ok === false) return { ok: false, response: roleGate.response };
  const session = roleGate.session;

  // Layer 3: add-on entitlement.
  const org = await db.organization.findUnique({
    where: { id: session.organizationId },
    select: { investigationAgentEnabled: true },
  });

  if (!org || !org.investigationAgentEnabled) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "investigation_addon_disabled",
          message:
            "The Case Investigation Agent is a paid add-on. Upgrade to unlock this feature.",
          upgradeRequired: true,
        },
        { status: 402 }, // Payment Required — semantically correct for a paywall
      ),
    };
  }

  return { ok: true, session };
}
