// =============================================================================
// Al Mizan — Case Investigation Agent — Court Routing reference + service
// -----------------------------------------------------------------------------
// COURT ROUTING IS A LOOKUP, NOT LLM INVENTION.
//
// This module holds the reference table of Jordanian courts + the rules that
// map a case's (jurisdiction, claim type, amount) to a specific forum. The
// Court Routing Agent (stage 3) calls routeCourt() here — it never asks the
// LLM to invent a court.
//
// WHY A CODE TABLE (not a DB table)?
//   - The set of courts is small, slow-changing, and authoritative. A code
//     table is easier to audit than a DB seed.
//   - When Jordan adds a new court, we add a row here + ship a new version.
//     That's the right cadence for jurisdictional data.
//   - The product spec says "table/lookup based, not free invention" — this
//     satisfies that without over-engineering a DB-backed rules engine.
//
// EXPANDING THE TABLE: add rows to COURT_REFERENCE_TABLE below. Each row has
//   - courtCode      — stable identifier (kebab-case)
//   - courtNameAr    — Arabic display name
//   - courtNameEn    — English display name
//   - jurisdictions  — list of jurisdiction strings that route here (matched
//                       case-insensitively against Matter.jurisdiction)
//   - claimTypes     — list of claim types that route here (matched against
//                       the intake's claim types: 'civil' | 'commercial' |
//                       'labour' | 'family' | 'criminal' | 'administrative')
//   - maxAmountJOD   — optional upper bound on claim amount (null = no cap)
//   - rule           — human-readable rule description for the audit trail
//
// When multiple rows match, the FIRST match wins (table order matters).
// When NO row matches, routeCourt() returns { noMatch: true } and the pipeline
// surfaces "no court could be resolved" — it does NOT guess.
// =============================================================================

import type { CourtRoutingResult } from "@/lib/agents/types";

// -----------------------------------------------------------------------------
// Reference table — Jordanian courts (subset; expand as corpus grows)
// -----------------------------------------------------------------------------

export type CourtClaimType =
  | "civil"
  | "commercial"
  | "labour"
  | "family"
  | "criminal"
  | "administrative";

interface CourtReferenceRow {
  courtCode: string;
  courtNameAr: string;
  courtNameEn: string;
  jurisdictions: string[]; // matched case-insensitively, partial match OK
  claimTypes: CourtClaimType[];
  /** Optional upper bound on claim amount in JOD. null = no cap. */
  maxAmountJOD?: number | null;
  rule: string;
}

const COURT_REFERENCE_TABLE: CourtReferenceRow[] = [
  {
    courtCode: "court_of_first_instance_amman",
    courtNameAr: "محكمة البداية - عمان",
    courtNameEn: "Court of First Instance — Amman",
    jurisdictions: ["amman", "عمان", "jordan", "الأردن"],
    claimTypes: ["civil", "commercial"],
    maxAmountJOD: null,
    rule:
      "General civil/commercial claims in Amman governorate fall under the Court of First Instance — Amman.",
  },
  {
    courtCode: "court_of_first_instance_zarqa",
    courtNameAr: "محكمة البداية - الزرقاء",
    courtNameEn: "Court of First Instance — Zarqa",
    jurisdictions: ["zarqa", "الزرقاء"],
    claimTypes: ["civil", "commercial"],
    maxAmountJOD: null,
    rule:
      "General civil/commercial claims in Zarqa governorate fall under the Court of First Instance — Zarqa.",
  },
  {
    courtCode: "court_of_first_instance_irbid",
    courtNameAr: "محكمة البداية - إربد",
    courtNameEn: "Court of First Instance — Irbid",
    jurisdictions: ["irbid", "إربد"],
    claimTypes: ["civil", "commercial"],
    maxAmountJOD: null,
    rule:
      "General civil/commercial claims in Irbid governorate fall under the Court of First Instance — Irbid.",
  },
  {
    courtCode: "magistrates_court_amman",
    courtNameAr: "محكمة الصلح - عمان",
    courtNameEn: "Magistrates Court — Amman",
    jurisdictions: ["amman", "عمان", "jordan", "الأردن"],
    claimTypes: ["civil", "commercial"],
    maxAmountJOD: 7000,
    rule:
      "Civil/commercial claims under 7,000 JOD in Amman fall under the Magistrates Court — Amman.",
  },
  {
    courtCode: "labour_court_amman",
    courtNameAr: "محكمة العمل - عمان",
    courtNameEn: "Labour Court — Amman",
    jurisdictions: ["amman", "عمان", "jordan", "الأردن"],
    claimTypes: ["labour"],
    maxAmountJOD: null,
    rule:
      "Employment/labour disputes in Amman fall under the specialised Labour Court.",
  },
  {
    courtCode: "labour_court_zarqa",
    courtNameAr: "محكمة العمل - الزرقاء",
    courtNameEn: "Labour Court — Zarqa",
    jurisdictions: ["zarqa", "الزرقاء"],
    claimTypes: ["labour"],
    maxAmountJOD: null,
    rule:
      "Employment/labour disputes in Zarqa fall under the specialised Labour Court.",
  },
  {
    courtCode: "sharia_court_amman",
    courtNameAr: "محكمة الشرع - عمان",
    courtNameEn: "Sharia Court — Amman",
    jurisdictions: ["amman", "عمان", "jordan", "الأردن"],
    claimTypes: ["family"],
    maxAmountJOD: null,
    rule:
      "Family/personal-status disputes for Muslims in Amman fall under the Sharia Court.",
  },
  {
    courtCode: "court_of_first_instance",
    courtNameAr: "محكمة البداية",
    courtNameEn: "Court of First Instance",
    jurisdictions: ["jordan", "الأردن"],
    claimTypes: ["civil", "commercial", "family", "administrative"],
    maxAmountJOD: null,
    rule:
      "Default fallback for Jordanian claims with no governorate-specific match: Court of First Instance.",
  },
];

// -----------------------------------------------------------------------------
// Public service
// -----------------------------------------------------------------------------

export interface CourtRoutingInput {
  jurisdiction: string;
  claimType: CourtClaimType;
  amountJOD?: number;
}

/**
 * Resolve a court for the given (jurisdiction, claimType, amount).
 *
 * Returns { noMatch: true } when no reference row matches. The caller MUST
 * surface this honestly — it is forbidden to invent a court.
 */
export function routeCourt(input: CourtRoutingInput): CourtRoutingResult {
  const { jurisdiction, claimType, amountJOD } = input;
  const jLower = (jurisdiction ?? "").toLowerCase().trim();

  for (const row of COURT_REFERENCE_TABLE) {
    // Jurisdiction match: case-insensitive partial match against any entry.
    const jMatch = row.jurisdictions.some(
      (j) => jLower.includes(j.toLowerCase()) || j.toLowerCase().includes(jLower),
    );
    if (!jMatch) continue;

    // Claim type match: exact.
    if (!row.claimTypes.includes(claimType)) continue;

    // Amount cap: if the row has a maxAmountJOD and the claim exceeds it,
    // skip this row (a higher-tier court row later in the table will catch it).
    if (
      row.maxAmountJOD != null &&
      amountJOD != null &&
      amountJOD > row.maxAmountJOD
    ) {
      continue;
    }

    return {
      courtCode: row.courtCode,
      courtNameAr: row.courtNameAr,
      courtNameEn: row.courtNameEn,
      routingReason: {
        rule: row.rule,
        matchedFacts: [
          `jurisdiction=${jurisdiction}`,
          `claimType=${claimType}`,
          ...(amountJOD != null ? [`amount=${amountJOD} JOD`] : []),
        ],
      },
      noMatch: false,
    };
  }

  return {
    courtCode: null,
    courtNameAr: null,
    courtNameEn: null,
    routingReason: null,
    noMatch: true,
  };
}

/**
 * Infer a CourtClaimType from the intake claims. Used by the court-routing
 * agent when the intake didn't explicitly categorise the claim.
 *
 * This is a deterministic mapping based on keywords in the claim text — NOT
 * an LLM call. If no keyword matches, defaults to 'civil'.
 */
export function inferClaimType(claimsText: string): CourtClaimType {
  const t = (claimsText ?? "").toLowerCase();
  if (/(employ|wage|salary|labour|labor|dismissal|workplace)/.test(t)) {
    return "labour";
  }
  if (/(family|divorce|custody|inheritance|marriage|مواريث|طلاق|حضانة)/.test(t)) {
    return "family";
  }
  if (/(commercial|contract|sale of goods|company|تجاري|شركة)/.test(t)) {
    return "commercial";
  }
  if (/(administrative|government|regulator|review of decision|إداري)/.test(t)) {
    return "administrative";
  }
  if (/(criminal|fraud|theft|assault|جنائي|احتيال)/.test(t)) {
    return "criminal";
  }
  return "civil";
}
