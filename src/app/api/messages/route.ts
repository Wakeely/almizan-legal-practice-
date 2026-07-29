// =============================================================================
// /api/messages — top-level client message create (used by ClientPortal)
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, verifyMatterBelongsToOrg } from "@/lib/org";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { audit } from "@/lib/audit";

const messageCreateSchema = z.object({
  matterId: z.string().min(1),
  sender: z.enum(["Lawyer", "Client"]).default("Lawyer"),
  text: z.string().min(1).max(4000),
});

export async function POST(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const body = await req.json().catch(() => null);
  const parsed = parseBody(messageCreateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const owns = await verifyMatterBelongsToOrg(data.matterId, r.session);
  if (!owns) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const message = await db.clientMessage.create({
    data: {
      sender: data.sender,
      text: data.text,
      matterId: data.matterId,
      organizationId: r.session.organizationId,
    },
  });

  await audit({ action: "client-message.create", entity: "clientMessage", entityId: message.id, matterId: data.matterId, details: { sender: message.sender, textLength: message.text.length } }, req);

  return NextResponse.json(message, { status: 201 });
}
