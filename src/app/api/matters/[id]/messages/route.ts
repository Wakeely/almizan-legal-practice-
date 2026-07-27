// =============================================================================
// /api/matters/[id]/messages — real route (replaces Turn 2 stub)
// GET: list messages for a matter (org-scoped)
// POST: create a new message (org-scoped, used by ClientPortal + Header)
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere, verifyMatterBelongsToOrg } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const messageCreateSchema = z.object({
  sender: z.enum(["Lawyer", "Client"]).default("Lawyer"),
  text: z.string().min(1).max(4000),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  const owns = await verifyMatterBelongsToOrg(id, r.session);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await db.clientMessage.findMany({
    where: { matterId: id, ...orgWhere(r.session) },
    orderBy: { timestamp: "asc" },
  });

  return NextResponse.json(messages);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireUser();
  if (!r.ok) return r.response;
  const { id } = await params;

  const owns = await verifyMatterBelongsToOrg(id, r.session);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = parseBody(messageCreateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const message = await db.clientMessage.create({
    data: {
      sender: data.sender,
      text: data.text,
      matterId: id,
      organizationId: r.session.organizationId,
    },
  });

  await audit({ action: "client-message.create", entity: "clientMessage", entityId: message.id, matterId: id, details: { sender: message.sender } }, req);

  return NextResponse.json(message, { status: 201 });
}
