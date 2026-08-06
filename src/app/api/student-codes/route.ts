// =============================================================================
// /api/student-codes — manage promo/student codes (admin only)
// -----------------------------------------------------------------------------
// GET  → list codes for the platform (Managing Partner role)
// POST → generate 1..N codes with limits (Managing Partner role)
//
// SECURITY: restricted to the most privileged role (Managing Partner), the same
// gate used by audit-log, AI diagnostics and RAG admin routes.
// =============================================================================

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/org";
import { parseBody, generateStudentCodeSchema } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const ADMIN_ROLES = ["MANAGING_PARTNER", "Managing Partner"];

function serializeCode(c: {
  id: string;
  code: string;
  maxMatters: number;
  aiQuota: number;
  aiQuotaPeriod: string;
  isActive: boolean;
  expiresAt: Date | null;
  usedCount: number;
  createdAt: Date;
}) {
  return {
    id: c.id,
    code: c.code,
    maxMatters: c.maxMatters,
    aiQuota: c.aiQuota,
    aiQuotaPeriod: c.aiQuotaPeriod,
    isActive: c.isActive,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    usedCount: c.usedCount,
    createdAt: c.createdAt.toISOString(),
  };
}

function generateCode(): string {
  const hex = randomBytes(4).toString("hex").toUpperCase();
  return `STUDENT-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

export async function GET(req: Request) {
  const r = await requireRole(ADMIN_ROLES);
  if (r.ok === false) return r.response;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 200);
  const cursor = searchParams.get("cursor") || undefined;

  const codes = await db.studentCode.findMany({
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: "desc" },
  });

  const hasMore = codes.length > limit;
  const trimmed = hasMore ? codes.slice(0, limit) : codes;
  const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id : undefined;

  return NextResponse.json({
    data: trimmed.map(serializeCode),
    pagination: { nextCursor, hasMore, limit },
  });
}

export async function POST(req: Request) {
  const r = await requireRole(ADMIN_ROLES);
  if (r.ok === false) return r.response;

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(generateStudentCodeSchema, body);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { maxMatters, aiQuota, aiQuotaPeriod, expiresAt, count } = parsed.data;

  const expires = expiresAt ? new Date(expiresAt) : null;
  if (expires && Number.isNaN(expires.getTime())) {
    return NextResponse.json({ error: "expiresAt: invalid date" }, { status: 400 });
  }
  if (expires && expires.getTime() < Date.now()) {
    return NextResponse.json({ error: "expiresAt: date must be in the future" }, { status: 400 });
  }

  const created: Awaited<ReturnType<typeof db.studentCode.create>>[] = [];
  for (let i = 0; i < count; i++) {
    // Retry a handful of times in the unlikely event of a code collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const existing = await db.studentCode.findUnique({ where: { code } });
      if (existing) continue;
      const row = await db.studentCode.create({
        data: {
          code,
          maxMatters,
          aiQuota,
          aiQuotaPeriod,
          expiresAt: expires,
          generatedBy: r.session.id,
        },
      });
      created.push(row);
      break;
    }
  }

  if (created.length === 0) {
    return NextResponse.json({ error: "Failed to generate codes — please retry" }, { status: 500 });
  }

  await audit(
    {
      action: "student_code.generate",
      entity: "student_code",
      entityId: created.map((c) => c.id).join(","),
      details: { count: created.length, maxMatters, aiQuota, aiQuotaPeriod },
    },
    req,
  );

  return NextResponse.json({ data: created.map(serializeCode) }, { status: 201 });
}