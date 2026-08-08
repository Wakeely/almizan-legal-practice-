// =============================================================================
// Al Mizan — Case Investigation Agent — pipeline type contract
// -----------------------------------------------------------------------------
// This file is the SINGLE SOURCE OF TRUTH for the shapes that flow between
// the seven pipeline agents (intake → research → court_routing → drafting →
// citation_verify → fact_consistency → assembler) and the API/UI layer.
//
// DESIGN INTENT (from product spec — do not deviate):
//   - Citations are corpus-verified only. If LegalCorpus has no match, the
//     pipeline says so explicitly. Web/search results, if ever added, are
//     awareness-only and NEVER cited as law.
//   - Facts carry a SourceAnchor pointing back at the intake input, so the
//     citation-verify and fact-consistency agents can re-check them.
//   - Drafting is template population only — never free-form legal invention.
//   - Court routing comes from a reference table, not LLM invention.
//   - The Assembler is BLOCKED unless citation-verify passes (always) AND
//     fact-consistency passes (blocking for tier 1/2; advisory for tier 3).
//
// PHASE 1 SCOPE: only the types below. Agent implementations, orchestrator,
// and API routes come in Phase 2.
//
// RELATION TO PRISMA SCHEMA:
//   The Prisma models in prisma/schema.prisma (CaseInvestigation,
//   InvestigationIntake, etc.) persist these shapes as JSON-encoded String?
//   columns. The mapping is:
//     IntakeResult           → InvestigationIntake.{partiesJson, claimsJson, ...}
//     ResearchResult         → InvestigationResearch.{queriesJson, corpusHitsJson, ...}
//     CourtRoutingResult     → InvestigationCourtRouting.{courtCode, routingReasonJson, ...}
//     DraftResult            → InvestigationDraft.{templateId, sectionsJson, renderedText}
//     CitationVerification   → one InvestigationCitationVerification row each
//     FactCheckResult        → one InvestigationFactConsistency row each
//     InvestigationPackage   → InvestigationAssembly.packageJson
//     AgentRunTrace          → InvestigationAgentRun.traceJson
// =============================================================================

import type { RetrievedChunk } from "@/lib/rag/types";

// -----------------------------------------------------------------------------
// Pipeline-level enums (stored as String + Zod in the schema/API; we expose
// them as string-literal unions here so agent code is fully typed).
// -----------------------------------------------------------------------------

/** Top-level status of a CaseInvestigation row. */
export type PipelineStatus =
  | "queued"
  | "running"
  | "awaiting_attorney_review"
  | "completed"
  | "failed";

/** Identifier of a pipeline stage / agent. */
export type AgentName =
  | "intake"
  | "research"
  | "court_routing"
  | "drafting"
  | "citation_verify"
  | "fact_consistency"
  | "assembler";

/** Per-agent execution status (one row in InvestigationAgentRun). */
export type AgentRunStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "skipped";

/**
 * Verification strictness tier. Stored as string "1" | "2" | "3" on
 * CaseInvestigation.verificationTier.
 *
 *   tier 1 — strictest. Fact consistency is blocking AND every claim must
 *            have a source anchor. Use for high-stakes litigation.
 *   tier 2 — default.  Fact consistency is blocking. Advisory legal
 *            characterizations allowed.
 *   tier 3 — advisory. Fact-consistency failures surface to the attorney
 *            reviewer but do NOT block assembly. Use for early-case triage.
 */
export type VerificationTier = "1" | "2" | "3";

/** Output language for the assembled package. */
export type InvestigationLang = "ar" | "en";

/** Roles allowed to start / review an investigation. Matches ROLE_VALUES in
 *  src/lib/validation/auth.ts (human-readable form, NOT the screaming-snake
 *  default in the schema). Client Representative is explicitly excluded. */
export const INVESTIGATION_ALLOWED_ROLES = [
  "Managing Partner",
  "Senior Associate",
  "In-House Counsel",
] as const;

export type InvestigationAllowedRole =
  (typeof INVESTIGATION_ALLOWED_ROLES)[number];

/** Attorney review decision on an assembled package. */
export type ReviewDecision =
  | "approve"
  | "reject"
  | "request_changes";

// -----------------------------------------------------------------------------
// Source anchoring — every extracted fact / claim / date / amount points back
// at a verifiable location in the original intake input. This is what the
// citation-verify + fact-consistency agents re-check.
// -----------------------------------------------------------------------------

/**
 * A pointer back at the intake input. Either a character offset range (for
 * pasted text) or a logical reference (for structured input).
 *
 * The anchor MUST be present on every hard fact (tier 1 + 2). The
 * fact-consistency agent treats a missing anchor as 'unverifiable'.
 */
export interface SourceAnchor {
  /** "text_range" | "intake_field" | "matter_document" | "transcript_page". */
  kind: "text_range" | "intake_field" | "matter_document" | "transcript_page";
  /** Human-readable label, e.g. "Intake brief, paragraph 3". */
  label: string;
  /** For text_range: [start, end) character offsets into the intake input. */
  charStart?: number;
  charEnd?: number;
  /** For matter_document / transcript_page. */
  documentId?: string;
  transcriptId?: string;
  pageNumber?: number;
  /** For intake_field: the field name on the intake form. */
  fieldName?: string;
}

// -----------------------------------------------------------------------------
// Stage 1 — Intake Agent output (→ InvestigationIntake row)
// -----------------------------------------------------------------------------

export interface IntakeParty {
  name: string;
  role: string; // 'plaintiff' | 'defendant' | 'witness' | 'counsel' | ...
  contact?: string;
}

export interface IntakeClaim {
  text: string;
  /** 'factual' | 'legal' | 'procedural' | 'damage'. */
  type: "factual" | "legal" | "procedural" | "damage";
  sourceAnchor: SourceAnchor;
}

export interface IntakeFact {
  text: string;
  /** 'date' | 'amount' | 'identity' | 'event' | 'document_reference'. */
  category: "date" | "amount" | "identity" | "event" | "document_reference";
  sourceAnchor: SourceAnchor;
  /** LLM-assigned confidence 0..1. */
  confidence?: number;
}

export interface IntakeDate {
  date: string; // ISO 8601 (YYYY-MM-DD) when parseable, else raw text.
  label: string; // e.g. "Contract signed", "Limitation expires".
  sourceAnchor: SourceAnchor;
}

export interface IntakeAmount {
  amount: number;
  currency: string; // ISO 4217, e.g. "JOD", "USD".
  label: string;
  sourceAnchor: SourceAnchor;
}

export interface IntakeResult {
  parties: IntakeParty[];
  claims: IntakeClaim[];
  facts: IntakeFact[];
  dates: IntakeDate[];
  amounts: IntakeAmount[];
  /** Short prose summary of the intake, shown in the UI. */
  summary: string;
}

// -----------------------------------------------------------------------------
// Stage 2 — Research Agent output (→ InvestigationResearch row)
// -----------------------------------------------------------------------------
// IMPORTANT: corpusHits only ever contains statutes that ACTUALLY exist in
// LegalCorpus. The Research Agent never invents citations. If the corpus
// returns 0 hits, noCorpusHits=true and the drafting agent must proceed with
// NO legal citations (template slots stay empty / marked "no statute found").
// -----------------------------------------------------------------------------

export interface ResearchResult {
  /** The queries the agent issued — kept for audit + re-runs. */
  queries: string[];
  /** Top Jordanian corpus hits (statutes). May be empty. */
  corpusHits: RetrievedChunk[];
  /** Top matter chunk hits (org + matter scoped). May be empty. */
  matterHits: RetrievedChunk[];
  /** True when corpusHits.length === 0. UI surfaces this honestly. */
  noCorpusHits: boolean;
}

// -----------------------------------------------------------------------------
// Stage 3 — Court Routing Agent output (→ InvestigationCourtRouting row)
// -----------------------------------------------------------------------------
// Court routing is a LOOKUP against a reference table (Phase 2), NOT LLM
// invention. If the rules table doesn't match, noMatch=true and the pipeline
// surfaces "no court could be resolved" instead of guessing.
// -----------------------------------------------------------------------------

export interface CourtRoutingResult {
  courtCode: string | null;
  courtNameAr: string | null;
  courtNameEn: string | null;
  /** Why this court was picked: { rule: string, matchedFacts: string[] }. */
  routingReason: {
    rule: string;
    matchedFacts: string[];
  } | null;
  noMatch: boolean;
}

// -----------------------------------------------------------------------------
// Stage 4 — Drafting Agent output (→ InvestigationDraft row)
// -----------------------------------------------------------------------------
// The Drafting Agent ONLY populates template slots from IntakeResult +
// ResearchResult. citationIds reference InvestigationCitationVerification rows
// created in stage 5 (the citation-verify agent runs AFTER drafting so it can
// verify exactly what the draft cited).
// -----------------------------------------------------------------------------

export interface DraftSection {
  /** Template slot key, e.g. "background", "claims", "legal_basis", "relief". */
  sectionKey: string;
  /** Localized heading (ar or en, matching investigation.lang). */
  heading: string;
  /** Populated body text. */
  body: string;
  /** IDs of InvestigationCitationVerification rows this section relies on. */
  citationIds: string[];
}

export interface DraftResult {
  /** Template identifier, e.g. "breach_of_contract_v1". */
  templateId: string;
  sections: DraftSection[];
  /** Readable preview — concatenation of section headings + bodies. */
  renderedText: string;
}

// -----------------------------------------------------------------------------
// Stage 5 — Citation Verification (BLOCKING) — one result per citation
// -----------------------------------------------------------------------------
// The citation-verify agent re-checks EVERY citation that appears in the
// DraftResult against the real LegalCorpus. If ANY row has status 'failed'
// or 'not_found', the Assembler is blocked.
//
// 'amended' / 'superseded' statuses are surfaced to the attorney reviewer as
// warnings but do NOT block (the reviewer can still approve with caveats).
// -----------------------------------------------------------------------------

export type CitationVerificationStatus =
  | "verified"
  | "failed"
  | "not_found"
  | "amended"
  | "superseded";

export interface CitationVerification {
  /** The citation as it appears in the draft, e.g. "القانون المدني، المادة 256". */
  claimedCitation: string;
  status: CitationVerificationStatus;
  /** LegalCorpus row id when verified / amended / superseded. */
  corpusId?: string;
  /** Cosine similarity 0..1 from the re-verification search. */
  similarity?: number;
  /** Short reasoning shown to the attorney reviewer. */
  reason: string;
}

// -----------------------------------------------------------------------------
// Stage 6 — Fact Consistency (BLOCKING for tier 1/2, advisory for tier 3)
// -----------------------------------------------------------------------------
// One result per hard fact that the draft relies on. The agent re-checks it
// against the IntakeResult source anchors. A 'consistent' status means the
// draft's usage matches the intake; 'inconsistent' means it doesn't.
// 'unverifiable' means the fact couldn't be re-checked (e.g. missing anchor).
// -----------------------------------------------------------------------------

export type FactCheckStatus = "consistent" | "inconsistent" | "unverifiable";

export interface FactCheckResult {
  /** The fact being checked. */
  factText: string;
  /** Where the fact was used in the draft (section key or line ref). */
  usageRef?: string;
  status: FactCheckStatus;
  /** What the intake actually said (the source anchor value). */
  intakeValue?: string;
  reason: string;
}

// -----------------------------------------------------------------------------
// Stage 7 — Assembler output (→ InvestigationAssembly.packageJson)
// -----------------------------------------------------------------------------
// The Assembler only runs if stages 5 + 6 pass (or pass as advisory for
// tier 3). The InvestigationPackage is the structured handoff to the
// attorney reviewer + the UI.
// -----------------------------------------------------------------------------

export interface InvestigationPackage {
  investigationId: string;
  /** Mirror of CaseInvestigation.title. */
  title: string;
  lang: InvestigationLang;
  tier: VerificationTier;
  intake: IntakeResult;
  research: ResearchResult;
  courtRouting: CourtRoutingResult;
  draft: DraftResult;
  citationVerifications: CitationVerification[];
  factChecks: FactCheckResult[];
  /** True iff citationVerifications all passed AND factChecks all passed
   *  (or the investigation is tier 3 and fact failures are advisory). */
  verificationsPassed: boolean;
  /** ISO 8601 timestamp of assembly. */
  assembledAt: string;
  /** Optional disclaimer shown at the top of the package — never null. */
  disclaimer: string;
}

// -----------------------------------------------------------------------------
// Per-agent execution trace (→ InvestigationAgentRun.traceJson)
// -----------------------------------------------------------------------------

export interface AgentRunTrace {
  /** Echo of the agent's input (size-bounded by the orchestrator). */
  inputSummary?: Record<string, unknown>;
  /** Echo of the agent's output (size-bounded). */
  outputSummary?: Record<string, unknown>;
  /** Error message if status === 'failed'. */
  error?: string;
  /** LLM token usage if the agent called the LLM. */
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    model?: string;
  };
}

// -----------------------------------------------------------------------------
// API request / response shapes (used by Phase 2 API routes)
// -----------------------------------------------------------------------------

/** POST /api/investigations body — start a new investigation. */
export interface StartInvestigationInput {
  title: string;
  intakeInput: string;
  matterId?: string;
  verificationTier?: VerificationTier;
  lang?: InvestigationLang;
}

/** Attorney review submission — POST /api/investigations/:id/review. */
export interface AttorneyReviewInput {
  decision: ReviewDecision;
  note?: string;
}

// -----------------------------------------------------------------------------
// Helpers (used by Phase 2 agents + API)
// -----------------------------------------------------------------------------

/**
 * Returns true if the verification results allow assembly.
 *   - Citation verify: every row must be 'verified' (or 'amended' /
 *     'superseded' with a non-blocking advisory flag).
 *   - Fact consistency:
 *       tier 1 + 2 → every row must be 'consistent' (or 'unverifiable' for
 *                    tier 2 only — tier 1 treats 'unverifiable' as blocking).
 *       tier 3     → 'inconsistent' / 'unverifiable' are advisory (non-blocking).
 */
export function canAssemble(
  citations: CitationVerification[],
  facts: FactCheckResult[],
  tier: VerificationTier,
): { canAssemble: boolean; blockingReasons: string[] } {
  const blockingReasons: string[] = [];

  // Citation verify — always blocking for 'failed' and 'not_found'.
  for (const c of citations) {
    if (c.status === "failed" || c.status === "not_found") {
      blockingReasons.push(
        `Citation "${c.claimedCitation}" failed verification (${c.status}).`,
      );
    }
  }

  // Fact consistency — blocking for tier 1 + 2.
  if (tier === "1" || tier === "2") {
    for (const f of facts) {
      const blocking =
        tier === "1"
          ? f.status !== "consistent"
          : f.status === "inconsistent";
      if (blocking) {
        blockingReasons.push(
          `Fact "${f.factText}" is ${f.status} (tier ${tier} blocks assembly).`,
        );
      }
    }
  }

  return { canAssemble: blockingReasons.length === 0, blockingReasons };
}

/**
 * Roles allowed to start OR review an investigation. Client Representative
 * is explicitly excluded by the product spec.
 */
export function canUseInvestigationAgent(role: string): boolean {
  return (INVESTIGATION_ALLOWED_ROLES as readonly string[]).includes(role);
}
