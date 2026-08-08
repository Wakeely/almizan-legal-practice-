// =============================================================================
// PATCH /api/platform-admin/users/[id]/subscription
// -----------------------------------------------------------------------------
// Phase 2 §2.2: manually override a user's subscription fields. Payments are
// simulated platform-wide (per the README), so this IS the billing system
// for now — how you mark someone as paid after an off-platform bank transfer,
// extend a trial, adjust seats, etc.
//
// PRD §2.2: require a reason, write a platform_admin.subscription_override
// audit entry with before/after values. The UI must flag clearly that this
// doesn't touch real money — it's account-state, not a ledger.
//
// Editable fields (all on the User model — billing lives on User, not Org,
// per PRD v0.3 §5):
//   subscriptionTier, planStatus, trialDaysLeft, seats, maxSeats,
//   billingCycle, renewalDate
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { platformAudit } from "@/lib/audit";
import { getTierLimits } from "@/lib/subscription-limits";

const overrideSchema = z.object({
  reason: z.string().min(5, "A reason is required (min 5 characters).").max(500),
  subscriptionTier: z.string().optional(),
  planStatus: z.enum(["Trial", "Active", "Past Due", "Canceled"]).optional(),
  trialDaysLeft: z.number().int().min(0).max(365).optional(),
  seats: z.number().int().min(0).max(1000).optional(),
  maxSeats: z.number().int().min(1).max(1000).optional(),
  billingCycle: z.enum(["Monthly", "Annual"]).optional(),
  renewalDate: z.string().nullable().optional(), // ISO date or null
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requirePlatformAdmin();
  if (r.ok === false) return r.response;
  const { id } = await params;

  const body = await req.json().catch((): null => null);
  const parsed = overrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  const { reason, ...changes } = parsed.data;

  // Filter to only the fields actually being changed
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(changes)) {
    if (v !== undefined) updates[k] = v;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  // Load the user + capture before-values for the audit entry
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      organizationId: true,
      subscriptionTier: true,
      planStatus: true,
      trialDaysLeft: true,
      seats: true,
      maxSeats: true,
      billingCycle: true,
      renewalDate: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Capture before-values for the fields being changed
  const before: Record<string, unknown> = {};
  for (const k of Object.keys(updates)) {
    before[k] = (user as any)[k];
  }

  // PRD v0.8 §4.3: when subscriptionTier changes, derive maxSeats from the
  // tier table (single source of truth) and write it to BOTH the user row
  // (legacy) AND the organization (authoritative per PRD v0.6 §5.4). This
  // fixes the ternary bug where Free Trial fell through to the 50-seat default.
  if (updates.subscriptionTier) {
    const limits = getTierLimits(updates.subscriptionTier as string);
    updates.maxSeats = limits.maxSeats;
    // Also write to the org's authoritative maxSeats
    await db.organization.update({
      where: { id: user.organizationId },
      data: { maxSeats: limits.maxSeats },
    }).catch(() => {
      // Non-fatal if the org update fails — the user-row maxSeats is the
      // fallback the existing code reads.
    });
  }

  // Apply the update
  await db.user.update({
    where: { id },
    data: updates as any,
  });

  // Audit entry — org-scoped admin action (PRD v0.3 §6): the affected org is
  // the user's org. before/after values recorded for the trail.
  await platformAudit(
    {
      action: "platform_admin.subscription_override",
      entity: "user",
      entityId: id,
      organizationId: user.organizationId,
      platformAdminId: r.session.adminId,
      details: {
        email: user.email,
        name: user.name,
        reason,
        before,
        after: updates,
      },
    },
    req,
  );

  return NextResponse.json({ ok: true });
}
