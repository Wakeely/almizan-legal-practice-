// =============================================================================
// POST /api/ai/ledes-classify — auto-classify a time entry description into
// UTBMS Task Code (L110–L420) + Activity Code (A101–A106)
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/org";
import { aiRateLimit, getClientIp } from "@/lib/rate-limit";
import { callGemini } from "@/lib/gemini";
import { audit } from "@/lib/audit";
import { assertAiQuota } from "@/lib/student-access";

const UTBMS_TASK_CODES = [
  "L100 (Case Assessment, Development, Review)",
  "L110 (Initial Case Assessment)",
  "L200 (Pleadings)",
  "L210 (Initial Pleadings)",
  "L220 (Motions to Dismiss)",
  "L230 (Amendments to Pleadings)",
  "L240 (Pleading Conferences)",
  "L300 (Written Discovery)",
  "L310 (Document Production)",
  "L320 (Interrogatories)",
  "L330 (Document Review)",
  "L400 (Depositions)",
  "L410 (Deposition Preparation)",
  "L420 (Conducting Depositions)",
];

const UTBMS_ACTIVITY_CODES = [
  "A101 (Case Administration)",
  "A102 (Legal Research)",
  "A103 (Drafting Documents)",
  "A104 (Review Documents)",
  "A105 (Communications)",
  "A106 (Travel)",
];

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
  const { description } = body ?? {};
  if (!description || typeof description !== "string") {
    return NextResponse.json({ error: "description required" }, { status: 400 });
  }

  const prompt = `You are an e-billing code classifier. Given the time entry description below, classify it into the most appropriate UTBMS Task Code (L-codes) and Activity Code (A-codes).

Description: "${description.slice(0, 500)}"

Available Task Codes:
${UTBMS_TASK_CODES.join("\n")}

Available Activity Codes:
${UTBMS_ACTIVITY_CODES.join("\n")}

Return a JSON object:
{
  "taskCode": "L110",
  "activityCode": "A103",
  "confidence": 0.85,
  "explanation": "<one-sentence reason>"
}

Only return the JSON object.`;

  const result = await callGemini(prompt, "You are an enterprise legal e-billing code classifier trained on UTBMS standards.");

  let classification: any = {
    taskCode: "",
    activityCode: "",
    confidence: 0,
    explanation: result.text,
  };

  if (!result._stub) {
    try {
      classification = JSON.parse(result.text);
    } catch {
      // Keep defaults
    }
  }

  await audit({ action: "ai.ledes-classify", details: { description: description.slice(0, 100), taskCode: classification.taskCode, _stub: result._stub } }, req);

  return NextResponse.json({
    ...classification,
    _stub: result._stub,
    _disclaimer: "AI-assisted classification. Non-authoritative — verify before submission to e-billing systems.",
  });
}
