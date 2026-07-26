// =============================================================================
// POST /api/auth/subscription — update user's subscription tier + billing cycle
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/org";
import { parseBody, subscriptionSchema } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

function publicUser(user: any, org: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    firmName: org.name,
    organizationId: org.id,
    role: user.role,
    barAssociationId: user.barAssociationId ?? org.barAssociationId ?? "",
    jurisdiction: user.jurisdiction ?? org.jurisdiction,
    accountType: user.accountType,
    subscriptionTier: user.subscriptionTier,
    planStatus: user.planStatus,
    trialDaysLeft: user.trialDaysLeft,
    seats: user.seats,
    maxSeats: user.maxSeats,
    billingCycle: user.billingCycle,
    renewalDate: user.renewalDate ?? "",
    biometricEnabled: user.biometricEnabled,
  };
}

export async function POST(req: Request) {
  const r = await requireUser();
  if (!r.ok) return r.response;

  const body = await req.json().catch(() => null);
  const parsed = parseBody(subscriptionSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { tier, billingCycle } = parsed.data;

  const updated = await db.user.update({
    where: { id: r.session.id },
    data: {
      subscriptionTier: tier,
      billingCycle,
      planStatus: tier === "Free Trial" ? "Trial" : "Active",
      trialDaysLeft: tier === "Free Trial" ? 14 : 0,
      maxSeats: tier === "Solo Practice" ? 1 : tier === "Pro Practice" ? 10 : 50,
      renewalDate: new Date(Date.now() + (billingCycle === "Annual" ? 365 : 30) * 24 * 3600 * 1000).toISOString().slice(0, 10),
    },
    include: { organization: true },
  });

  await audit({ action: "auth.subscription.updated", entity: "user", entityId: updated.id, details: { tier, billingCycle } }, req);

  return NextResponse.json({ user: publicUser(updated, updated.organization) });
}
