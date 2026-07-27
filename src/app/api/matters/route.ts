// =============================================================================
// GET /api/matters — list all matters for the authenticated user's organization
// POST /api/matters — create a new matter scoped to the authenticated user's org
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";
import { parseBody, matterCreateSchema } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

export async function GET() {
  const r = await requireUser();
  if (!r.ok) return r.response;

  const matters = await db.matter.findMany({
    where: orgWhere(r.session),
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      organizationId: true,
      title: true,
      description: true,
      clientName: true,
      clientEmail: true,
      jurisdiction: true,
      opposingParty: true,
      opposingCounsel: true,
      budget: true,
      expenses: true,
      riskLevel: true,
      winProbability: true,
      judge: true,
      court: true,
      statuteOfLimitations: true,
      statuteDeadline: true,
      status: true,
      aiStrategy: true,
    },
  });

  return NextResponse.json(matters);
}

export async function POST(req: Request) {
  const r = await requireUser();
  if (!r.ok) return r.response;

  const body = await req.json().catch(() => null);
  const parsed = parseBody(matterCreateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const matter = await db.matter.create({
    data: {
      ...data,
      description: data.description ?? null,
      opposingParty: data.opposingParty || null,
      opposingCounsel: data.opposingCounsel || null,
      judge: data.judge || null,
      court: data.court || null,
      statuteOfLimitations: data.statuteOfLimitations || null,
      statuteDeadline: data.statuteDeadline || null,
      organizationId: r.session.organizationId,
    },
  });

  await audit({ action: "matter.create", entity: "matter", entityId: matter.id, details: { title: matter.title } }, req);

  return NextResponse.json(matter, { status: 201 });
}
