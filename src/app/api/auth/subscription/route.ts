// =============================================================================
// POST /api/auth/subscription — request a subscription change
// -----------------------------------------------------------------------------
// PRD v0.8 §2 (LOCKDOWN): this route no longer lets a user grant themselves a
// paid tier. Self-serve tier *upgrades* are disabled until a real payment
// gateway exists (still Open Question 1 from the Phase 2 PRD).
//
// What this route still does:
//   • Lets a user *request* an upgrade (creates an audit entry so the platform
//     admin can see "user X wants to upgrade to Y" and action it manually via
//     the Billing tab, which is already gated behind requirePlatformAdmin()).
//   • Lets a user change their billingCycle preference (cosmetic — doesn't
//     touch subscriptionTier or planStatus).
//
// What this route NO LONGER does:
//   • Set subscriptionTier to anything. That write is now exclusively done by
//     the platform admin Billing tab (PATCH /api/platform-admin/users/[id]/subscription)
//     or by a future real payment-gateway callback. The open self-serve write
//     was a working, callable, free self-upgrade hole — closed.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { parseBody, subscriptionSchema } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(subscriptionSchema, body);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { tier, billingCycle } = parsed.data;

  // Load current state to compare
  const user = await db.user.findUnique({
    where: { id: r.session.id },
    select: {
      subscriptionTier: true,
      planStatus: true,
      billingCycle: true,
      maxSeats: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // ── Block self-serve tier upgrades ───────────────────────────────────────
  // The user can no longer set their own subscriptionTier. If they're asking
  // for a tier different from their current one, record the REQUEST (audit
  // entry) but don't perform the write. Tell them to contact the platform
  // admin or wait for the platform admin to apply it from the Billing tab.
  if (tier !== user.subscriptionTier) {
    await audit(
      {
        action: "auth.subscription.upgrade_requested",
        entity: "user",
        entityId: r.session.id,
        details: {
          currentTier: user.subscriptionTier,
          requestedTier: tier,
          billingCycle,
        },
      },
      req,
    );

    return NextResponse.json(
      {
        error:
          "Self-serve plan upgrades are currently disabled. Your upgrade request has been recorded and will be reviewed. To activate immediately, contact the platform administrator.",
        upgradeRequested: true,
        requestedTier: tier,
      },
      { status: 402 }, // 402 Payment Required — signals "payment/upgrade needed"
    );
  }

  // ── Billing cycle preference only (same tier) ────────────────────────────
  // If the tier is unchanged, we allow updating the billingCycle preference —
  // this is cosmetic and doesn't grant any new access. The actual
  // renewalDate / maxSeats are only written by the platform admin or a future
  // payment gateway.
  if (billingCycle !== user.billingCycle) {
    await db.user.update({
      where: { id: r.session.id },
      data: { billingCycle },
    });

    await audit(
      {
        action: "auth.subscription.billing_cycle_changed",
        entity: "user",
        entityId: r.session.id,
        details: { from: user.billingCycle, to: billingCycle },
      },
      req,
    );
  }

  return NextResponse.json({ ok: true });
}
