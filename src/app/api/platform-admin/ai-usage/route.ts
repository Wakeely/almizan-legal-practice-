// =============================================================================
// GET /api/platform-admin/ai-usage
// -----------------------------------------------------------------------------
// Phase 2 §2.4: AI usage + cost dashboard data. Gated by requirePlatformAdmin().
//
// Returns:
//   - Per-org totals (last 30 days): calls, tokens, cost, byok vs platform
//   - Per-provider totals (last 30 days)
//   - Top spenders (last 30 days)
//   - Active spend-spike alerts (today vs trailing 7-day average)
//   - Promo quota usage for student/promo accounts (existing data, surfaced)
//
// Query params: ?days= (default 30, max 90) &org= (filter to single org)
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { detectSpendSpike } from "@/lib/ai-usage";

export async function GET(req: Request) {
  const r = await requirePlatformAdmin();
  if (r.ok === false) return r.response;

  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(Number(searchParams.get("days") || "30"), 1), 90);
  const orgFilter = searchParams.get("org") || undefined;
  const since = new Date(Date.now() - days * 86400000);

  const where = {
    createdAt: { gte: since },
    ...(orgFilter ? { organizationId: orgFilter } : {}),
  };

  // Per-org totals
  const perOrg = await db.aiUsageLog.groupBy({
    by: ["organizationId", "keySource"],
    where,
    _count: { id: true },
    _sum: { tokensIn: true, tokensOut: true, estimatedCostUsd: true },
  });

  // Load org names for the per-org breakdown
  const orgIds = Array.from(new Set(perOrg.map((p) => p.organizationId)));
  const orgs = await db.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true, status: true },
  });
  const orgMap = new Map(orgs.map((o) => [o.id, o]));

  // Aggregate per org (combining byok + platform rows)
  const orgAggregated = new Map<
    string,
    {
      organizationId: string;
      organizationName: string;
      calls: number;
      tokensIn: number;
      tokensOut: number;
      costUsd: number;
      byokCalls: number;
      platformCalls: number;
    }
  >();
  for (const p of perOrg) {
    const org = orgMap.get(p.organizationId);
    const entry = orgAggregated.get(p.organizationId) ?? {
      organizationId: p.organizationId,
      organizationName: org?.name ?? "—",
      calls: 0,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      byokCalls: 0,
      platformCalls: 0,
    };
    entry.calls += p._count.id;
    entry.tokensIn += p._sum.tokensIn ?? 0;
    entry.tokensOut += p._sum.tokensOut ?? 0;
    entry.costUsd += p._sum.estimatedCostUsd ?? 0;
    if (p.keySource === "org") entry.byokCalls += p._count.id;
    else entry.platformCalls += p._count.id;
    orgAggregated.set(p.organizationId, entry);
  }

  const perOrgData = Array.from(orgAggregated.values()).sort(
    (a, b) => b.costUsd - a.costUsd,
  );

  // Per-provider totals
  const perProvider = await db.aiUsageLog.groupBy({
    by: ["provider"],
    where,
    _count: { id: true },
    _sum: { tokensIn: true, tokensOut: true, estimatedCostUsd: true },
  });

  // Top spenders (top 10 orgs by cost)
  const topSpenders = perOrgData.slice(0, 10);

  // Spend-spike alerts (today vs trailing 7-day average)
  const spikeAlerts = await detectSpendSpike();

  // Promo quota usage for student/promo accounts (existing data, newly surfaced)
  const promoUsers = await db.user.findMany({
    where: {
      accessKind: "promo",
      deletedAt: null,
      promoAiQuota: { gt: 0 },
    },
    select: {
      id: true,
      email: true,
      name: true,
      promoCode: true,
      promoAiQuota: true,
      promoAiUsed: true,
      promoAiQuotaPeriod: true,
      promoExpiresAt: true,
      organization: { select: { name: true } },
    },
    take: 100,
  });

  return NextResponse.json({
    period: { days, since: since.toISOString() },
    perOrg: perOrgData,
    perProvider: perProvider.map((p) => ({
      provider: p.provider,
      calls: p._count.id,
      tokensIn: p._sum.tokensIn ?? 0,
      tokensOut: p._sum.tokensOut ?? 0,
      costUsd: p._sum.estimatedCostUsd ?? 0,
    })),
    topSpenders,
    spikeAlerts,
    promoQuotaUsage: promoUsers.map((u) => ({
      userId: u.id,
      email: u.email,
      name: u.name,
      organizationName: u.organization?.name ?? "—",
      promoCode: u.promoCode,
      quota: u.promoAiQuota,
      used: u.promoAiUsed,
      period: u.promoAiQuotaPeriod,
      expiresAt: u.promoExpiresAt,
    })),
    totals: {
      calls: perOrgData.reduce((s, o) => s + o.calls, 0),
      costUsd: perOrgData.reduce((s, o) => s + o.costUsd, 0),
      byokCalls: perOrgData.reduce((s, o) => s + o.byokCalls, 0),
      platformCalls: perOrgData.reduce((s, o) => s + o.platformCalls, 0),
    },
  });
}
