// =============================================================================
// Agent 7 — Assembler
// -----------------------------------------------------------------------------
// Produces the final structured InvestigationPackage. The Assembler ONLY runs
// if the citation-verify + fact-consistency agents passed (or passed as
// advisory for tier 3). The blocking decision is made by the orchestrator
// via types.ts:canAssemble() — the assembler trusts that decision and does
// not re-check.
//
// The assembler does NOT call the LLM. It just packs the upstream outputs
// into the InvestigationPackage shape + writes a disclaimer.
//
// PDF generation is Phase 3 — pdfBlobUrl is left null for now.
// =============================================================================

import { canAssemble } from "@/lib/agents/types";
import type {
  CitationVerification,
  CourtRoutingResult,
  DraftResult,
  FactCheckResult,
  IntakeResult,
  InvestigationLang,
  InvestigationPackage,
  ResearchResult,
  VerificationTier,
} from "@/lib/agents/types";

export interface AssemblerInput {
  investigationId: string;
  title: string;
  lang: InvestigationLang;
  tier: VerificationTier;
  intake: IntakeResult;
  research: ResearchResult;
  courtRouting: CourtRoutingResult;
  draft: DraftResult;
  citationVerifications: CitationVerification[];
  factChecks: FactCheckResult[];
}

export async function runAssembler(
  input: AssemblerInput,
): Promise<InvestigationPackage> {
  const { canAssemble: passed, blockingReasons } = canAssemble(
    input.citationVerifications,
    input.factChecks,
    input.tier,
  );

  const isAr = input.lang === "ar";
  const disclaimer = isAr
    ? "هذه حزمة تحقيق مولدة بواسطة الذكاء الاصطناعي ضمن منظومة الميزان. جميع الاستشهادات القانونية موثقة من المدوّنة الأردنية المعتمدة. يبقى المحامي المسؤول النهائي عن المراجعة والاعتماد."
    : "This is an AI-generated investigation package within the Al Mizan platform. All legal citations are verified against the curated Jordanian legal corpus. The attorney reviewer remains responsible for final review and approval.";

  return {
    investigationId: input.investigationId,
    title: input.title,
    lang: input.lang,
    tier: input.tier,
    intake: input.intake,
    research: input.research,
    courtRouting: input.courtRouting,
    draft: input.draft,
    citationVerifications: input.citationVerifications,
    factChecks: input.factChecks,
    verificationsPassed: passed,
    assembledAt: new Date().toISOString(),
    disclaimer,
    // blockingReasons is not part of the persisted package — the orchestrator
    // uses it to decide whether to write the assembly row at all. When the
    // assembler IS called, blockingReasons is always [] (orchestrator already
    // verified). We don't include it in the returned package.
  };
}

/** Re-exported for the orchestrator so it has one import for the gate. */
export { canAssemble };
