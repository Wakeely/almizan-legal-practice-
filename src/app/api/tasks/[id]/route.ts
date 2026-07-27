// =============================================================================
// PATCH /api/tasks/[id] — update a task (status, priority, etc.) — org-scoped
// DELETE /api/tasks/[id] — delete a task — org-scoped
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const taskUpdateSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional().or(z.literal("")),
  assignedTo: z.string().min(1).max(200).optional(),
  dueDate: z.string().min(1).max(40).optional(),
  priority: z.enum(["Low", "Medium", "High"]).optional(),
  visibleToClient: z.boolean().optional(),
  status: z.enum(["To Do", "In Progress", "Under Review", "Completed"]).optional(),
  dependsOnTaskIds: z.array(z.string()).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  // Verify ownership (task → org via organizationId)
  const existing = await db.task.findFirst({
    where: { id, ...orgWhere(r.session) },
    select: { id: true, matterId: true, status: true, dependsOnTaskIds: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = parseBody(taskUpdateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const updates = parsed.data;

  // Serialize array field for SQLite
  const cleanUpdates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined) continue;
    cleanUpdates[k] = k === "dependsOnTaskIds" ? JSON.stringify(v) : v;
  }

  // Dependency lock check: cannot advance to In Progress / Completed if
  // prerequisites are not yet Completed. UI also blocks this client-side;
  // server check is the authoritative enforcement.
  const newStatus = updates.status;
  if (newStatus && (newStatus === "In Progress" || newStatus === "Completed")) {
    const depsRaw = (existing.dependsOnTaskIds as string | null) ?? "[]";
    const deps: string[] = JSON.parse(depsRaw);
    if (deps.length > 0) {
      const prereqs = await db.task.findMany({
        where: { id: { in: deps }, ...orgWhere(r.session) },
        select: { id: true, status: true },
      });
      const incomplete = prereqs.filter((p) => p.status !== "Completed");
      if (incomplete.length > 0) {
        return NextResponse.json(
          { error: "Task is locked: prerequisites not yet completed", lockedBy: incomplete.map((p) => p.id) },
          { status: 409 },
        );
      }
    }
  }

  const updated = await db.task.update({
    where: { id },
    data: cleanUpdates,
  });

  await audit({
    action: "task.update",
    entity: "task",
    entityId: id,
    matterId: existing.matterId,
    details: { changes: cleanUpdates, from: existing.status, to: newStatus },
  }, req);

  return NextResponse.json({
    ...updated,
    dependsOnTaskIds: JSON.parse(updated.dependsOnTaskIds ?? "[]"),
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  const existing = await db.task.findFirst({
    where: { id, ...orgWhere(r.session) },
    select: { id: true, matterId: true, title: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.task.delete({ where: { id } });

  await audit({
    action: "task.delete",
    entity: "task",
    entityId: id,
    matterId: existing.matterId,
    details: { title: existing.title },
  }, req);

  return NextResponse.json({ ok: true });
}
