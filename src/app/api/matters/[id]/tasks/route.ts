// =============================================================================
// GET /api/matters/[id]/tasks — list tasks for a matter (org-scoped)
// POST /api/matters/[id]/tasks — create a task under this matter (org-scoped)
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere, verifyMatterBelongsToOrg } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const taskCreateSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  assignedTo: z.string().min(1).max(200),
  dueDate: z.string().min(1).max(40),
  priority: z.enum(["Low", "Medium", "High"]).default("Medium"),
  visibleToClient: z.boolean().default(false),
  status: z.enum(["To Do", "In Progress", "Under Review", "Completed"]).default("To Do"),
  dependsOnTaskIds: z.array(z.string()).optional().default([]),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (r.ok === false) return r.response;
  const { id } = await params;

  const owns = await verifyMatterBelongsToOrg(id, r.session);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tasks = await db.task.findMany({
    where: { matterId: id, ...orgWhere(r.session) },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    tasks.map((t) => ({
      ...t,
      dependsOnTaskIds: t.dependsOnTaskIds ? JSON.parse(t.dependsOnTaskIds) : [],
    })),
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (r.ok === false) return r.response;
  const { id } = await params;

  const owns = await verifyMatterBelongsToOrg(id, r.session);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = parseBody(taskCreateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const task = await db.task.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      assignedTo: data.assignedTo,
      dueDate: data.dueDate,
      priority: data.priority,
      visibleToClient: data.visibleToClient,
      status: data.status,
      dependsOnTaskIds: JSON.stringify(data.dependsOnTaskIds ?? []),
      matterId: id,
      organizationId: r.session.organizationId,
    },
  });

  await audit({ action: "task.create", entity: "task", entityId: task.id, matterId: id, details: { title: task.title } }, req);

  return NextResponse.json({
    ...task,
    dependsOnTaskIds: JSON.parse(task.dependsOnTaskIds ?? "[]"),
  }, { status: 201 });
}
