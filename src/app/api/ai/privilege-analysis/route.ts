// =============================================================================
// POST /api/ai/privilege-analysis — AI privilege log analysis
// Reviews a privilege log entry and suggests the correct privilege claim + justification
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, orgWhere } from "@/lib/org";
import { aiRateLimit, getClientIp } from "@/lib/rate-limit";
import { dispatchAiText } from "@/lib/byok-dispatch";
import { audit } from "@/lib/audit";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { assertAiQuota } from "@/lib/student-access";

const privilegeAnalysisSchema = z.object({
  matterId: z.string().optional(),
  docControlNum: z.string().min(1).max(60),
  docDate: z.string().min(1).max(40),
  author: z.string().min(1).max(200),
  recipients: z.string().min(1).max(500),
  docType: z.string().min(1).max(100),
  subject: z.string().min(1).max(500),
  lang: z.enum(["ar", "en"]).optional(),
});

export async function POST(req: Request) {
  const r = await requireUser();
  if (r.ok === false) return r.response;

  const quota = await assertAiQuota(r.session.id);
  if (quota.ok === false) return quota.response;

  const ip = getClientIp(req);
  const limit = await aiRateLimit(ip, r.session.organizationId);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "AI rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const body = await req.json().catch((): null => null);
  const parsed = parseBody(privilegeAnalysisSchema, body);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const langInstruction = data.lang === "ar"
    ? "Write the analysis in formal Arabic legal terminology."
    : "Write the analysis in formal English legal terminology.";

  const prompt = `You are a legal privilege analyst. Analyze the following document for the most appropriate privilege claim under GCC/MENA legal ethics rules.

DOCUMENT:
- Control Number: ${data.docControlNum}
- Date: ${data.docDate}
- Author: ${data.author}
- Recipients: ${data.recipients}
- Type: ${data.docType}
- Subject: ${data.subject}

${langInstruction}

Return a JSON object with:
{
  "recommendedPrivilege": "Attorney-Client Privilege" | "Work-Product Doctrine" | "Common Interest Privilege" | "Bank Confidentiality" | "Sharia Professional Secrecy",
  "justification": "<2-3 sentence justification>",
  "reviewStatus": "Flagged" | "Verified" | "Withheld",
  "confidenceScore": <0-100>
}

Available privilege types:
- Attorney-Client Privilege: confidential communications between attorney and client for legal advice
- Work-Product Doctrine: materials prepared in anticipation of litigation
- Common Interest Privilege: shared communications between parties with common legal interest
- Bank Confidentiality: financial institution secrecy under banking law
- Sharia Professional Secrecy: professional secrecy under Islamic legal principles

Only return the JSON object.`;

  const result = await dispatchAiText({
    organizationId: r.session.organizationId,
    prompt,
    systemInstruction: "You are an enterprise legal privilege analyst specializing in GCC/MENA jurisdictions.",
  });

  let analysis: any = {
    recommendedPrivilege: "Attorney-Client Privilege",
    justification: "AI analysis unavailable. Review manually.",
    reviewStatus: "Flagged",
    confidenceScore: 0,
  };

  if (!result._stub) {
    try {
      analysis = { ...analysis, ...JSON.parse(result.text) };
    } catch {
      // Keep defaults
    }
  }

  await audit({
    action: "ai.privilege-analysis",
    matterId: data.matterId,
    details: { docControlNum: data.docControlNum, recommended: analysis.recommendedPrivilege, _stub: result._stub },
  }, req);

  return NextResponse.json({
    ...analysis,
    _stub: result._stub,
    _disclaimer: "AI-assisted privilege analysis. Non-authoritative — verify with a qualified attorney before final claim.",
  });
}
