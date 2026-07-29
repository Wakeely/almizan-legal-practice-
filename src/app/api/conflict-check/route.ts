// =============================================================================
// /api/conflict-check — Conflict of Interest Engine
// -----------------------------------------------------------------------------
// GET: list all conflict checks for the user's org
// POST: create a new conflict check (entity search + ethical clearance certificate)
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const conflictCheckCreateSchema = z.object({
  searchQuery: z.string().min(1).max(500),
  matchedEntities: z.array(z.any()).max(100).optional().default([]),
  clearanceStatus: z.enum(["Pending", "Cleared", "Conflict"]).default("Pending"),
  ethicalWallSet: z.boolean().default(false),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

// Generate certificate number: AMZ-ETH-XXXXXX
function generateCertificateNumber(): string {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `AMZ-ETH-${random}`;
}

export async function GET(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const checks = await db.conflictCheck.findMany({
    where: orgWhere(r.session),
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    checks.map((c) => ({
      ...c,
      matchedEntities: c.matchedEntities ? JSON.parse(c.matchedEntities) : [],
    })),
  );
}

export async function POST(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(conflictCheckCreateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const certificateNumber = generateCertificateNumber();

  const check = await db.conflictCheck.create({
    data: {
      certificateNumber,
      searchQuery: data.searchQuery,
      matchedEntities: data.matchedEntities.length > 0 ? JSON.stringify(data.matchedEntities) : null,
      clearanceStatus: data.clearanceStatus,
      ethicalWallSet: data.ethicalWallSet,
      notes: data.notes || null,
      organizationId: r.session.organizationId,
    },
  });

  await audit({
    action: "conflict-check.create",
    entity: "conflictCheck",
    entityId: check.id,
    details: { certificateNumber, searchQuery: data.searchQuery.slice(0, 100), clearanceStatus: data.clearanceStatus },
  }, req);

  return NextResponse.json({
    ...check,
    matchedEntities: check.matchedEntities ? JSON.parse(check.matchedEntities) : [],
  }, { status: 201 });
}
