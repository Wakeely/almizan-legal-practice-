// =============================================================================
// POST /api/ai/summarize — generate AI summary + semantic tags for a document
// -----------------------------------------------------------------------------
// Server-side Gemini call only. The API key NEVER reaches the browser.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";
import { aiRateLimit, getClientIp } from "@/lib/rate-limit";
import { callGemini } from "@/lib/gemini";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const ip = getClientIp(req);
  const limit = await aiRateLimit(ip, r.session.organizationId);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "AI rate limit exceeded. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const body = await req.json().catch(() => null);
  const { documentId } = body ?? {};
  if (!documentId) return NextResponse.json({ error: "documentId required" }, { status: 400 });

  // Fetch the document (org-scoped)
  const doc = await db.document.findFirst({
    where: { id: documentId, ...orgWhere(r.session) },
    include: { matter: true },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  // Build a prompt — note that we don't have the actual file contents, only metadata
  const prompt = `You are a legal document analyst. Generate a concise 2-3 paragraph summary and 3-5 semantic tags for the following document, in the same language as the document name (Arabic or English).

Document name: ${doc.name}
Category: ${doc.category}
Matter title: ${doc.matter.title}
Client: ${doc.matter.clientName}
Jurisdiction: ${doc.matter.jurisdiction}

Return a JSON object with this exact shape:
{
  "summary": "<paragraph summary>",
  "tags": ["tag1", "tag2", "tag3"]
}

Only return the JSON object, nothing else.`;

  const result = await callGemini(prompt, "You are an enterprise legal document analyst specializing in GCC/MENA jurisdictions.");

  let summary = result.text;
  let tags: string[] = [];

  // Try to parse JSON if not a stub
  if (!result._stub) {
    try {
      const parsed = JSON.parse(result.text);
      summary = parsed.summary ?? result.text;
      tags = Array.isArray(parsed.tags) ? parsed.tags : [];
    } catch {
      // If JSON parse fails, keep raw text as summary
    }
  }

  // Persist to the document
  await db.document.update({
    where: { id: doc.id },
    data: {
      aiSummary: summary,
      aiTags: JSON.stringify(tags),
    },
  });

  await audit({ action: "ai.summarize", entity: "document", entityId: doc.id, matterId: doc.matterId, details: { _stub: result._stub, tagsCount: tags.length } }, req);

  return NextResponse.json({
    summary,
    tags,
    _stub: result._stub,
    _disclaimer: "AI-generated summary. Non-authoritative — verify against the source document.",
  });
}
