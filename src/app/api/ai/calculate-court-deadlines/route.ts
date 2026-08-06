// =============================================================================
// POST /api/ai/calculate-court-deadlines — Gemini-powered court rules calculator
// -----------------------------------------------------------------------------
// Input: triggering event + jurisdiction + trigger date
// Output: 4-6 deadlines with rule references, priority, calculated dates
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/org";
import { aiRateLimit, getClientIp } from "@/lib/rate-limit";
import { dispatchAiText } from "@/lib/byok-dispatch";
import { audit } from "@/lib/audit";
import { z } from "zod";
import { parseBody } from "@/lib/validation/auth";
import { assertAiQuota } from "@/lib/student-access";
import {
  JURISDICTIONS,
  normalizeJurisdiction,
  proceduralRulesetFor,
  buildJurisdictionAiContext,
} from "@/lib/jurisdictions";

const courtDeadlineSchema = z.object({
  triggeringEvent: z.string().min(2).max(500),
  // The reference UI sends `jurisdictionRuleset`; we accept either spelling
  jurisdiction: z.string().min(2).max(200).optional(),
  jurisdictionRuleset: z.string().min(2).max(200).optional(),
  triggerDate: z.string().min(1).max(40),
  matterId: z.string().optional(),
  lang: z.enum(["ar", "en"]).optional(),
}).refine((d) => d.jurisdiction || d.jurisdictionRuleset, {
  message: "Either jurisdiction or jurisdictionRuleset is required",
});

const JURISDICTION_RULESETS: Record<string, string> = {
  "Jordan Courts": "Jordan Civil Procedure Law No. 24 of 1988 (as amended)",
  "Jordan Courts & Arbitration": "Jordan Civil Procedure Law + Jordan Arbitration Law No. 31 of 2001",
  "Saudi Commercial Courts (SCCA)": "Saudi Law of Civil Procedure (Royal Decree M/34) + SCCA Arbitration Rules",
  "UAE Federal & DIFC Courts": "UAE Civil Procedure Code (Federal Law No. 11 of 1992) + DIFC Courts Rules (RDC)",
  "UAE Federal Courts": "UAE Civil Procedure Code (Federal Law No. 11 of 1992)",
  "DIFC Courts": "DIFC Courts Rules of Procedure (RDC)",
  "ADGM Courts": "ADGM Court, Civil Evidence, Judgments, Enforcement and Civil Procedure Rules 2019",
  "International Tribunals (ICC/LCIA)": "ICC Rules of Arbitration + LCIA Arbitration Rules",
};

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
  const parsed = parseBody(courtDeadlineSchema, body);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;
  // The reference UI sends `jurisdictionRuleset` — accept either field name.
  // The new UI sends the canonical code in `jurisdiction` plus the long-form
  // ruleset name in `jurisdictionRuleset`. We normalize to a canonical code so
  // the catalog drives the legal context + system prompt.
  const rawJurisdiction = data.jurisdiction ?? data.jurisdictionRuleset ?? "";
  const jurisdictionCode = normalizeJurisdiction(rawJurisdiction);
  const lang = data.lang ?? "en";
  // Resolve the procedural ruleset name to display / use in the prompt.
  // proceduralRulesetFor returns the catalog value when normalized, or falls
  // back to the verbatim legacy string (so existing UI labels keep working).
  const ruleset =
    proceduralRulesetFor(rawJurisdiction, lang) ||
    JURISDICTION_RULESETS[rawJurisdiction] ||
    `applicable procedural rules for ${rawJurisdiction}`;
  const jurisdictionInfo = JURISDICTIONS[jurisdictionCode];
  const { systemContext: jurisdictionSystemContext } =
    buildJurisdictionAiContext(jurisdictionInfo);

  const langInstruction = lang === "ar"
    ? "Write all titles and descriptions in Arabic."
    : "Write all titles and descriptions in English.";

  const prompt = `You are a court rules expert. Calculate 4-6 procedural deadlines based on the triggering event below.

Triggering event: ${data.triggeringEvent}
Jurisdiction: ${jurisdictionInfo.labelEn} (${jurisdictionInfo.labelAr})
Applicable ruleset: ${ruleset}
Court system: ${lang === "ar" ? jurisdictionInfo.courtSystemAr : jurisdictionInfo.courtSystemEn}
Trigger date: ${data.triggerDate}

${langInstruction}

Return a JSON array of 4-6 deadlines. Each deadline object must have:
{
  "title": "<short title>",
  "category": "Court Deadline" | "Filing" | "Hearing" | "Arbitration",
  "daysFromTrigger": <integer>,
  "calculatedDate": "<YYYY-MM-DD>",
  "ruleReference": "<article/section number>",
  "description": "<1-sentence explanation>",
  "priority": "High" | "Medium" | "Low"
}

Only return the JSON array, nothing else. All dates must be calculated from the trigger date (${data.triggerDate}) using the ruleset.`;

  const result = await dispatchAiText({
    organizationId: r.session.organizationId,
    prompt,
    systemInstruction:
      "You are an enterprise court rules analyst.\n\n" +
      jurisdictionSystemContext,
  });

  let deadlines: any[] = [];

  if (!result._stub) {
    try {
      const parsedJson = JSON.parse(result.text);
      deadlines = Array.isArray(parsedJson) ? parsedJson : (Array.isArray(parsedJson.deadlines) ? parsedJson.deadlines : []);
    } catch {
      // Keep empty
    }
  } else {
    // Provide a stub example so the UI still renders the deadlines list
    const baseDate = new Date(data.triggerDate);
    const stubDays = [7, 14, 30, 45, 60];
    deadlines = stubDays.map((d, i) => {
      const calc = new Date(baseDate.getTime() + d * 24 * 3600 * 1000);
      return {
        title: `[STUB] Deadline ${i + 1} (+${d} days)`,
        category: i === 0 ? "Filing" : i === stubDays.length - 1 ? "Hearing" : "Court Deadline",
        daysFromTrigger: d,
        calculatedDate: calc.toISOString().slice(0, 10),
        ruleReference: "Set GEMINI_API_KEY to compute real references",
        description: `Sample deadline ${d} days after the triggering event. This is a placeholder because GEMINI_API_KEY is not configured on the server.`,
        priority: d <= 14 ? "High" : d <= 30 ? "Medium" : "Low",
      };
    });
  }

  await audit({
    action: "ai.calculate-court-deadlines",
    matterId: data.matterId,
    details: {
      jurisdiction: jurisdictionInfo.labelEn,
      jurisdictionCode,
      rawJurisdiction,
      triggeringEvent: data.triggeringEvent.slice(0, 100),
      deadlineCount: deadlines.length,
      _stub: result._stub,
    },
  }, req);

  // Response shape expected by the reference CourtRulesCalendaringModule:
  //   { calculatedDeadlines, proceduralAdvice, applicableCodeRef }
  return NextResponse.json({
    calculatedDeadlines: deadlines,
    proceduralAdvice: result._stub
      ? "Set GEMINI_API_KEY on the server to get real procedural advice."
      : "AI-calculated procedural advice based on the triggering event and applicable ruleset. Verify against the actual ruleset text before relying on these dates.",
    applicableCodeRef: ruleset,
    _stub: result._stub,
    _disclaimer: "AI-calculated deadlines. Non-authoritative — verify against the actual ruleset text.",
  });
}
