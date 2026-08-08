// =============================================================================
// GET  /api/matters/[id]/assignments — list assigned attorneys for this matter
// POST /api/matters/[id]/assignments — add an attorney to this matter
// -----------------------------------------------------------------------------
// PRD v0.7 Fix 2e: assignment management. Any assigned attorney or the
// Managing Partner can view + add assignees. The Managing Partner always has
// owner-override (can manage any matter in their firm).
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, verifyMatterBelongsToOrg } from "@/lib/org";
import { audit } from "@/lib/audit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (r.ok === false) return r.response;
  const { id: matterId } = await params;

  const owns = await verifyMatterBelongsToOrg(matterId, r.session);
  if (!owns) return NextResponse.json({ error: "Matter not found." }, { status: 404 });

  const assignments = await db.matterAssignment.findMany({
    where: { matterId },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    data: assignments.map((a) => ({
      id: a.id,
      userId: a.userId,
      role: a.role,
      createdAt: a.createdAt.toISOString(),
      user: a.user,
    })),
  });
}

const addSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["lead", "attorney"]).default("attorney"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (r.ok === false) return r.response;
  const { id: matterId } = await params;

  const owns = await verifyMatterBelongsToOrg(matterId, r.session);
  if (!owns) return NextResponse.json({ error: "Matter not found." }, { status: 404 });

  // Permission: Managing Partner (owner-override) or already-assigned attorney
  if (r.session.role !== "Managing Partner") {
    const selfAssignment = await db.matterAssignment.findUnique({
      where: { matterId_userId: { matterId, userId: r.session.id } },
      select: { id: true },
    });
    if (!selfAssignment) {
      return NextResponse.json(
        { error: "Only assigned attorneys or the Managing Partner can manage assignments." },
        { status: 403 },
      );
    }
  }

  const body = await req.json().catch((): null => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { userId, role } = parsed.data;

  // Verify the target user is in the same org
  const targetUser = await db.user.findFirst({
    where: { id: userId, organizationId: r.session.organizationId, deletedAt: null },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found in your organization." }, { status: 404 });
  }
  // Clients can't be assigned as attorneys
  if (targetUser.role === "Client Representative") {
    return NextResponse.json({ error: "Client Representatives cannot be assigned as attorneys." }, { status: 400 });
  }

  try {
    const assignment = await db.matterAssignment.create({
      data: { matterId, userId, role },
    });
    await audit(
      {
        action: "matter.assignment_add",
        entity: "matter_assignment",
        entityId: assignment.id,
        matterId,
        details: { userId, userName: targetUser.name, role },
      },
      req,
    );
    return NextResponse.json(
      { ok: true, assignment: { id: assignment.id, userId, role } },
      { status: 201 },
    );
  } catch (err: any) {
    // P2002 = unique constraint violation (already assigned)
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "This attorney is already assigned to the matter." }, { status: 409 });
    }
    throw err;
  }
}
