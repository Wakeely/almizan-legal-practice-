// =============================================================================
// Agent 1 — Intake Agent
// -----------------------------------------------------------------------------
// Extracts parties, claims, facts, dates, amounts from the user-supplied
// intake text. Every extracted fact carries a SourceAnchor pointing back at
// the intake input (character offsets where possible) so the citation-verify
// + fact-consistency agents can re-check it later.
//
// EXTRACTION IS LLM-BASED. The LLM is instructed to:
//   - Answer ONLY from the provided intake text (no outside knowledge).
//   - Tag each extracted item with a source anchor (char offsets or label).
//   - Refuse explicitly when the intake is too sparse (return empty arrays +
//     a note in `summary`).
//
// On LLM failure (_stub) or JSON parse failure, returns a minimal valid
// IntakeResult with empty arrays + a note. The pipeline does NOT crash — it
// surfaces "intake extraction failed" to the user.
// =============================================================================

import { callLlmForJson } from "@/lib/agents/services/llm-service";
import type { IntakeResult } from "@/lib/agents/types";

// The shape we ask the LLM to return. Mirrors IntakeResult but with looser
// typing (JSON has no Date / union enforcement) — we validate + coerce below.
interface LlmIntakeResponse {
  parties?: Array<{ name?: string; role?: string; contact?: string }>;
  claims?: Array<{
    text?: string;
    type?: string;
    sourceLabel?: string;
    charStart?: number;
    charEnd?: number;
  }>;
  facts?: Array<{
    text?: string;
    category?: string;
    sourceLabel?: string;
    charStart?: number;
    charEnd?: number;
    confidence?: number;
  }>;
  dates?: Array<{
    date?: string;
    label?: string;
    sourceLabel?: string;
    charStart?: number;
    charEnd?: number;
  }>;
  amounts?: Array<{
    amount?: number;
    currency?: string;
    label?: string;
    sourceLabel?: string;
    charStart?: number;
    charEnd?: number;
  }>;
  summary?: string;
}

const SYSTEM_PROMPT = `You are the Intake Agent in a legal investigation pipeline for Jordanian / MENA legal practice.

Your job: read the intake text the lawyer supplied and extract a STRUCTURED list of:
  - parties (names + roles)
  - claims (each tagged factual | legal | procedural | damage)
  - facts (each tagged date | amount | identity | event | document_reference)
  - dates (ISO 8601 when parseable, else raw text)
  - amounts (number + ISO 4217 currency code, e.g. JOD, USD)

HARD RULES:
1. Extract ONLY from the intake text below. Do NOT bring in outside knowledge.
2. For EVERY extracted item, provide a sourceLabel (short human-readable pointer, e.g. "paragraph 2") AND, when possible, charStart + charEnd (character offsets into the intake text, 0-indexed, end exclusive).
3. If the intake is too sparse to extract anything meaningful, return empty arrays and set summary to explain why.
4. Do NOT invent parties, amounts, or dates that are not in the text.
5. Return ONLY a JSON object with this exact shape — no markdown, no prose:
{
  "parties": [{"name": "...", "role": "...", "contact": "..."}],
  "claims": [{"text": "...", "type": "factual|legal|procedural|damage", "sourceLabel": "...", "charStart": 0, "charEnd": 50}],
  "facts": [{"text": "...", "category": "date|amount|identity|event|document_reference", "sourceLabel": "...", "charStart": 0, "charEnd": 50, "confidence": 0.9}],
  "dates": [{"date": "2024-03-15", "label": "Contract signed", "sourceLabel": "...", "charStart": 0, "charEnd": 50}],
  "amounts": [{"amount": 50000, "currency": "JOD", "label": "Claim value", "sourceLabel": "...", "charStart": 0, "charEnd": 50}],
  "summary": "One-paragraph summary of the intake."
}`;

export async function runIntakeAgent(
  intakeInput: string,
  lang: "ar" | "en",
): Promise<IntakeResult> {
  // Truncate very long intakes to stay within Gemini's input budget.
  const truncated = intakeInput.slice(0, 12000);

  const result = await callLlmForJson<LlmIntakeResponse>(
    SYSTEM_PROMPT,
    `Language for summary: ${lang === "ar" ? "Arabic" : "English"}.\n\nIntake text:\n${truncated}`,
    "intake",
  );

  // Degraded path: LLM stub or parse failure. Return a minimal valid result.
  if (result._stub || result.data === null) {
    return {
      parties: [],
      claims: [],
      facts: [],
      dates: [],
      amounts: [],
      summary:
        lang === "ar"
          ? "تعذّر استخراج بيانات الاستيعاب (وضع عدم الاتصال أو فشل التحليل). يُرجى المحاولة مرة أخرى."
          : "Intake extraction unavailable (stub mode or parse failure). Please retry.",
    };
  }

  const d = result.data;

  // Coerce + validate each field. Drop malformed entries rather than crash.
  return {
    parties: (d.parties ?? [])
      .filter((p) => p && p.name)
      .map((p) => ({
        name: String(p.name),
        role: String(p.role ?? "unknown"),
        contact: p.contact ? String(p.contact) : undefined,
      })),
    claims: (d.claims ?? [])
      .filter((c) => c && c.text)
      .map((c) => ({
        text: String(c.text),
        type: coerceClaimType(c.type),
        sourceAnchor: {
          kind: "text_range" as const,
          label: String(c.sourceLabel ?? "intake"),
          charStart: typeof c.charStart === "number" ? c.charStart : undefined,
          charEnd: typeof c.charEnd === "number" ? c.charEnd : undefined,
        },
      })),
    facts: (d.facts ?? [])
      .filter((f) => f && f.text)
      .map((f) => ({
        text: String(f.text),
        category: coerceFactCategory(f.category),
        sourceAnchor: {
          kind: "text_range" as const,
          label: String(f.sourceLabel ?? "intake"),
          charStart: typeof f.charStart === "number" ? f.charStart : undefined,
          charEnd: typeof f.charEnd === "number" ? f.charEnd : undefined,
        },
        confidence:
          typeof f.confidence === "number" && f.confidence >= 0 && f.confidence <= 1
            ? f.confidence
            : undefined,
      })),
    dates: (d.dates ?? [])
      .filter((dt) => dt && dt.date)
      .map((dt) => ({
        date: String(dt.date),
        label: String(dt.label ?? "date"),
        sourceAnchor: {
          kind: "text_range" as const,
          label: String(dt.sourceLabel ?? "intake"),
          charStart: typeof dt.charStart === "number" ? dt.charStart : undefined,
          charEnd: typeof dt.charEnd === "number" ? dt.charEnd : undefined,
        },
      })),
    amounts: (d.amounts ?? [])
      .filter((a) => a && typeof a.amount === "number")
      .map((a) => ({
        amount: Number(a.amount),
        currency: String(a.currency ?? "JOD").toUpperCase(),
        label: String(a.label ?? "amount"),
        sourceAnchor: {
          kind: "text_range" as const,
          label: String(a.sourceLabel ?? "intake"),
          charStart: typeof a.charStart === "number" ? a.charStart : undefined,
          charEnd: typeof a.charEnd === "number" ? a.charEnd : undefined,
        },
      })),
    summary: d.summary
      ? String(d.summary)
      : lang === "ar"
        ? "تم استخراج البيانات بنجاح."
        : "Intake extracted successfully.",
  };
}

function coerceClaimType(
  t: string | undefined,
): "factual" | "legal" | "procedural" | "damage" {
  if (t === "legal" || t === "procedural" || t === "damage") return t;
  return "factual";
}

function coerceFactCategory(
  c: string | undefined,
): "date" | "amount" | "identity" | "event" | "document_reference" {
  if (
    c === "amount" ||
    c === "identity" ||
    c === "event" ||
    c === "document_reference"
  ) {
    return c;
  }
  return "date";
}
