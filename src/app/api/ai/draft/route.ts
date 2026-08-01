// =============================================================================
// POST /api/ai/draft — Gemini-powered legal document drafting copilot
// Generates: Demand Notice, Settlement Accord, Arbitration Petition, Statement of Defense
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";
import { aiRateLimit, getClientIp } from "@/lib/rate-limit";
import { callGemini } from "@/lib/gemini";
import { audit } from "@/lib/audit";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";

/**
 * Strip HTML tags from text — simple regex-based sanitizer.
 * Replaces isomorphic-dompurify (which depends on jsdom and breaks on
 * Vercel serverless). For legal draft text we only need to strip tags,
 * not sanitize untrusted HTML, so this is sufficient and dependency-free.
 */
function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, "") // strip all HTML tags
    .replace(/&nbsp;/g, " ") // decode common entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

const draftSchema = z.object({
  matterId: z.string().optional(),
  // The reference UI sends `type` (template name) — accept either `template` or `type`
  template: z.enum([
    "demand-notice",
    "settlement-accord",
    "arbitration-petition",
    "statement-of-defense",
    "free-text",
  ]).optional(),
  type: z.string().min(2).max(100).optional(),
  // The reference UI sends `details` (user directive) — accept either `directive` or `details`
  // Allow empty/short strings — we fall back to a default directive below so
  // the draft still generates even if the user didn't type anything.
  directive: z.string().max(4000).optional(),
  details: z.string().max(4000).optional(),
  lang: z.enum(["ar", "en"]).optional(),
}).refine((d) => d.template || d.type, {
  message: "Either template or type is required",
});

const TEMPLATE_PROMPTS: Record<string, string> = {
  "demand-notice": "Draft a formal Demand Notice (notice of dispute) under applicable GCC/MENA civil procedure rules. The notice must include: (1) sender/recipient headers, (2) subject line, (3) factual background, (4) legal basis with statute references, (5) specific demand with cure period, (6) reservation of rights, (7) signature block.",
  "settlement-accord": "Draft a Settlement Accord (memorandum of understanding) between disputing parties. Include: (1) parties recital, (2) recitals of facts, (3) mutual releases, (4) consideration, (5) confidentiality, (6) governing law, (7) execution block.",
  "arbitration-petition": "Draft an Arbitration Petition (Request for Arbitration) under the applicable arbitration rules (SCCA / ICC / LCIA / ADGM / DIFC-LCIA). Include: (1) claimant identification, (2) arbitration agreement reference, (3) statement of claim, (4) relief sought, (5) arbitral tribunal constitution request, (6) verification.",
  "statement-of-defense": "Draft a Statement of Defense in response to a civil/commercial claim. Include: (1) caption with court/matter, (2) preliminary objections, (3) admissions and denials, (4) affirmative defenses, (5) counterclaims if applicable, (6) prayer for relief, (7) verification.",
  "free-text": "Draft a custom legal document based on the user's directive.",
};

export async function POST(req: Request) {
  try {
    const r = await requireUser();
    if (r.ok === false) return r.response;

    const ip = getClientIp(req);
    const limit = await aiRateLimit(ip, r.session.organizationId);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "AI rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
      );
    }

    const body = await req.json().catch((): null => null);
    const parsed = parseBody(draftSchema, body);
    if (parsed.ok === false) return NextResponse.json({ error: parsed.error, fieldErrors: (parsed as any).fieldErrors }, { status: 400 });
    const data = parsed.data;

    // Resolve template + directive from either UI field name
    const rawTemplate = data.template ?? data.type ?? "free-text";
    // Map common UI template names to our schema enum
    const templateMap: Record<string, string> = {
      "demand-notice": "demand-notice",
      "Demand Notice": "demand-notice",
      "Formal Demand Notice": "demand-notice",
      "settlement-accord": "settlement-accord",
      "Settlement Accord": "settlement-accord",
      "arbitration-petition": "arbitration-petition",
      "SCCA Arbitration Petition": "arbitration-petition",
      "Arbitration Petition": "arbitration-petition",
      "statement-of-defense": "statement-of-defense",
      "Statement of Defense": "statement-of-defense",
      "Statement of Defense Pleading": "statement-of-defense",
      "free-text": "free-text",
      "Free Text": "free-text",
    };
    const template = templateMap[rawTemplate] ?? "free-text";
    // Use the user's directive if provided; otherwise use a sensible default
    // so the draft still generates (the template prompt alone is enough for
    // the AI to produce a useful starting point).
    const directive = (data.directive ?? data.details ?? "").trim() ||
      `Generate a standard ${template.replace(/-/g, " ")} document based on the matter context above. Include all standard sections for this document type under applicable Jordanian / GCC / MENA law.`;

    // Fetch matter context (org-scoped)
    let matter = null;
    if (data.matterId) {
      matter = await db.matter.findFirst({
        where: { id: data.matterId, ...orgWhere(r.session) },
      });
    }

    const templateInstruction = TEMPLATE_PROMPTS[template] ?? TEMPLATE_PROMPTS["free-text"];
    const langInstruction = data.lang === "ar"
      ? "Write the entire document in formal Arabic legal terminology (فصحى)."
      : "Write the entire document in formal English legal terminology.";

    const prompt = `You are an enterprise legal drafting assistant for GCC/MENA jurisdictions.

TEMPLATE: ${template}
${templateInstruction}

USER DIRECTIVE:
${directive}

${matter ? `MATTER CONTEXT:
- Title: ${matter.title}
- Client: ${matter.clientName}
- Jurisdiction: ${matter.jurisdiction}
- Opposing party: ${matter.opposingParty ?? "Unknown"}
- Opposing counsel: ${matter.opposingCounsel ?? "Unknown"}
- Court: ${matter.court ?? "Unknown"}
- Judge: ${matter.judge ?? "Unknown"}` : ""}

${langInstruction}

Output ONLY the drafted document text. No commentary, no preamble, no closing notes.`;

    const result = await callGemini(prompt, "You are an enterprise legal drafting assistant specializing in GCC/MENA jurisdictions (Jordan, UAE/DIFC/ADGM, Saudi, Kuwait). Output clean, professional, court-ready legal documents.");

    await audit({
      action: "ai.draft",
      matterId: data.matterId,
      details: { template, type: rawTemplate, directiveLength: directive.length, _stub: result._stub },
    }, req).catch(() => {}); // audit failure should never break the draft

    const sanitized = stripHtml(result.text);

    // Return shape expected by reference AiModule: { draft, _stub, _disclaimer }
    return NextResponse.json({
      draft: sanitized,
      text: sanitized,
      _stub: result._stub,
      _disclaimer: "AI-assisted draft. Non-authoritative — review and modify with a qualified attorney before filing.",
    });
  } catch (err: any) {
    // Catch-all: never let the route return an HTML error page (which causes
    // "Unexpected token '<'" on the client). Always return JSON.
    console.error("[ai/draft] unhandled error:", err);
    return NextResponse.json(
      {
        error:
          "Draft generation failed due to a server error. If you have OpenAI configured as a fallback, it may have been used. Please try again.",
        detail: err?.message?.substring(0, 300),
      },
      { status: 500 },
    );
  }
}
