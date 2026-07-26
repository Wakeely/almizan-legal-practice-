// =============================================================================
// POST /api/calendar/bulk-deadlines — bulk-insert court-rule deadlines as
// calendar events + tasks. Used by the Court Rules Calculator after Gemini
// returns the deadline list.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere, verifyMatterBelongsToOrg } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const bulkDeadlineSchema = z.object({
  matterId: z.string().min(1),
  deadlines: z.array(
    z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000),
      calculatedDate: z.string().min(1).max(40),
      category: z.enum(["Hearing", "Court Deadline", "Client Meeting", "Filing", "Arbitration"]).default("Court Deadline"),
      priority: z.enum(["Low", "Medium", "High"]).default("Medium"),
      autoAddTasks: z.boolean().default(true),
    }),
  ),
});

export async function POST(req: Request) {
  const r = await requireUser();
  if (!r.ok) return r.response;

  const body = await req.json().catch(() => null);
  const parsed = parseBody(bulkDeadlineSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const owns = await verifyMatterBelongsToOrg(data.matterId, r.session);
  if (!owns) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  // Insert calendar events
  const createdEvents = await Promise.all(
    data.deadlines.map((d) =>
      db.calendarEvent.create({
        data: {
          title: d.title,
          description: d.description,
          startDate: d.calculatedDate,
          category: d.category,
          matterId: data.matterId,
          organizationId: r.session.organizationId,
        },
      }),
    ),
  );

  // Optionally insert tasks too
  const createdTasks = data.deadlines.some((d) => d.autoAddTasks)
    ? await Promise.all(
        data.deadlines
          .filter((d) => d.autoAddTasks)
          .map((d) =>
            db.task.create({
              data: {
                title: d.title,
                description: d.description,
                assignedTo: r.session.name,
                dueDate: d.calculatedDate,
                priority: d.priority,
                status: "To Do",
                visibleToClient: false,
                dependsOnTaskIds: "[]",
                matterId: data.matterId,
                organizationId: r.session.organizationId,
              },
            }),
          ),
      )
    : [];

  await audit({
    action: "calendar.bulk-deadlines",
    matterId: data.matterId,
    details: { eventCount: createdEvents.length, taskCount: createdTasks.length },
  }, req);

  return NextResponse.json({
    ok: true,
    eventsCreated: createdEvents.length,
    tasksCreated: createdTasks.length,
  }, { status: 201 });
}
