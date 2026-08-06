// =============================================================================
// POST /api/ai/summarize — generate AI summary + semantic tags for a document
// -----------------------------------------------------------------------------
// Server-side Gemini call only. The API key NEVER reaches the browser.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";
import { aiRateLimit, getClientIp } from "@/lib/rate-limit";
import { dispatchAiText } from "@/lib/byok-dispatch";
import { audit } from "@/lib/audit";
import { assertAiQuota } from "@/lib/student-access";
import {
  resolveMatterJurisdiction,
  buildJurisdictionAiContext,
} from "@/lib/jurisdictions";

export async function POST(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const quota = await assertAiQuota(r.session.id);
  if (quota.ok === false) return quota.response;

  const ip = getClientIp(req);
  const limit = await aiRateLimit(ip, r.session.organizationId);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "AI rate limit exceeded. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const body = await req.json().catch((): null => null);
  const { documentId } = body ?? {};
  if (!documentId) return NextResponse.json({ error: "documentId required" }, { status: 400 });

  // Fetch the document (org-scoped) + the org's jurisdiction so we can resolve
  // the matter → org fallback chain via the catalog.
  const [doc, organization] = await Promise.all([
    db.document.findFirst({
      where: { id: documentId, ...orgWhere(r.session) },
      include: { matter: true },
    }),
    db.organization.findUnique({
      where: { id: r.session.organizationId },
      select: { jurisdiction: true },
    }),
  ]);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  // Resolve the canonical jurisdiction (matter → org → OTHER).
  const jurisdictionInfo = resolveMatterJurisdiction(doc.matter, organization);
  const { systemContext: jurisdictionSystemContext } =
    buildJurisdictionAiContext(jurisdictionInfo);

  // Build a prompt — note that we don't have the actual file contents, only metadata
  const prompt = `You are a legal document analyst. Generate a concise 2-3 paragraph summary and 3-5 semantic tags for the following document, in the same language as the document name (Arabic or English).

Document name: ${doc.name}
Category: ${doc.category}
Matter title: ${doc.matter.title}
Client: ${doc.matter.clientName}
Jurisdiction: ${jurisdictionInfo.labelEn} (${jurisdictionInfo.labelAr})

Return a JSON object with this exact shape:
{
  "summary": "<paragraph summary>",
  "tags": ["tag1", "tag2", "tag3"]
}

Only return the JSON object, nothing else.`;

  const result = await dispatchAiText({
    organizationId: r.session.organizationId,
    prompt,
    systemInstruction:
      "You are an enterprise legal document analyst.\n\n" +
      jurisdictionSystemContext,
  });

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
