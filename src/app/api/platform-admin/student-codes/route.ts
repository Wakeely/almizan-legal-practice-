// =============================================================================
// GET  /api/platform-admin/student-codes — list all codes
// POST /api/platform-admin/student-codes — create a new code
// -----------------------------------------------------------------------------
// PRD v0.3 §6: student code create is a platform-only action — organizationId
// is null in the audit entry (StudentCode has no organizationId by design).
// =============================================================================

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { platformAudit } from "@/lib/audit";

function generateCode(): string {
  const hex = randomBytes(4).toString("hex").toUpperCase();
  return `STUDENT-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

function serializeCode(c: any) {
  return {
    id: c.id,
    code: c.code,
    maxMatters: c.maxMatters,
    aiQuota: c.aiQuota,
    aiQuotaPeriod: c.aiQuotaPeriod,
    isActive: c.isActive,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    usedCount: c.usedCount,
    generatedBy: c.generatedBy,
    generatedByName: c.generatedByName ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    // Note: StudentCode has no Prisma relation to User. Redemption lookup is
    // a string match on User.promoCode === code. To keep the list endpoint
    // fast, we don't aggregate redemptions here — a separate per-code detail
    // endpoint can do that if needed.
    redeemedBy: [] as Array<{
      userId: string;
      userEmail: string;
      userName: string;
      redeemedAt: string;
    }>,
  };
}

export async function GET(req: Request) {
  const r = await requirePlatformAdmin();
  if (r.ok === false) return r.response;

  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active") !== "0";
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 200);

  const codes = await db.studentCode.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    data: codes.map((c) =>
      serializeCode({ ...c, generatedByName: null }),
    ),
  });
}

const createSchema = z.object({
  code: z.string().min(8, "Code must be at least 8 characters").max(80),
  maxMatters: z.number().int().min(0).max(100).default(3),
  aiQuota: z.number().int().min(0).max(10000).default(20),
  aiQuotaPeriod: z.enum(["total", "monthly"]).default("total"),
  expiresAt: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  const r = await requirePlatformAdmin();
  if (r.ok === false) return r.response;

  const body = await req.json().catch((): null => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { code, maxMatters, aiQuota, aiQuotaPeriod, expiresAt } = parsed.data;

  const existing = await db.studentCode.findUnique({ where: { code } });
  if (existing) {
    return NextResponse.json({ error: "Code already exists." }, { status: 409 });
  }

  const expires = expiresAt ? new Date(expiresAt) : null;
  if (expires && Number.isNaN(expires.getTime())) {
    return NextResponse.json({ error: "expiresAt: invalid date." }, { status: 400 });
  }

  const created = await db.studentCode.create({
    data: {
      code,
      maxMatters,
      aiQuota,
      aiQuotaPeriod,
      expiresAt: expires,
      generatedBy: r.session.adminId,
    },
  });

  // PRD v0.3 §6: platform-only action — organizationId = null
  await platformAudit(
    {
      action: "platform_admin.student_code_create",
      entity: "student_code",
      entityId: created.id,
      organizationId: null,
      platformAdminId: r.session.adminId,
      details: { code, maxMatters, aiQuota, aiQuotaPeriod, expiresAt: expires?.toISOString() ?? null },
    },
    req,
  );

  return NextResponse.json(
    { data: serializeCode({ ...created, generatedByName: r.session.name }) },
    { status: 201 },
  );
}
