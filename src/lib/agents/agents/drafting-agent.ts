// =============================================================================
// Agent 4 — Drafting Agent
// -----------------------------------------------------------------------------
// Populates a TEMPLATE from the intake + research outputs. The Drafting Agent
// NEVER free-form generates legal arguments — it only fills template slots.
//
// TEMPLATES live in code (DRAFT_TEMPLATES below). Each template defines a set
// of sections (background, claims, legal_basis, relief) and the rules for
// populating each section from the intake + research.
//
// CITATIONS: the drafting agent attaches corpusHits to the legal_basis section
// by their chunkId. The citation-verify agent (stage 5) will re-check each
// cited chunk against the real LegalCorpus and produce
// InvestigationCitationVerification rows. The citationIds on each section are
// the chunkIds the draft CITED — the verify agent turns these into verification
// rows + rewrites them as verification row IDs.
//
// When noCorpusHits=true, the legal_basis section is populated with an honest
// "no statute found" message — the agent does NOT invent citations.
// =============================================================================

import type {
  CourtRoutingResult,
  DraftResult,
  DraftSection,
  IntakeResult,
  InvestigationLang,
  ResearchResult,
} from "@/lib/agents/types";

interface DraftTemplate {
  id: string;
  /** Section keys this template populates, in order. */
  sections: Array<{
    key: string;
    headingAr: string;
    headingEn: string;
  }>;
}

// Single general-purpose template for Phase 2. Phase 3 can add more (e.g.
// breach_of_contract_v1, labour_dispute_v1) and the orchestrator will pick
// one based on intake classification.
const GENERAL_TEMPLATE: DraftTemplate = {
  id: "general_investigation_v1",
  sections: [
    { key: "background", headingAr: "خلفية القضية", headingEn: "Background" },
    { key: "parties", headingAr: "الأطراف", headingEn: "Parties" },
    { key: "claims", headingAr: "الادعاءات", headingEn: "Claims" },
    { key: "facts", headingAr: "الوقائع", headingEn: "Key Facts" },
    { key: "court_routing", headingAr: "الاختصاص القضائي", headingEn: "Jurisdiction & Court" },
    { key: "legal_basis", headingAr: "الأساس القانوني", headingEn: "Legal Basis" },
    { key: "relief", headingAr: "الطلبات", headingEn: "Relief Sought" },
  ],
};

export interface DraftingAgentInput {
  intake: IntakeResult;
  research: ResearchResult;
  courtRouting: CourtRoutingResult;
  lang: InvestigationLang;
}

export async function runDraftingAgent(
  input: DraftingAgentInput,
): Promise<DraftResult> {
  const { intake, research, courtRouting, lang } = input;
  const template = GENERAL_TEMPLATE;
  const isAr = lang === "ar";

  const sections: DraftSection[] = [];

  for (const sec of template.sections) {
    const heading = isAr ? sec.headingAr : sec.headingEn;
    const { body, citationIds } = populateSection(
      sec.key,
      intake,
      research,
      courtRouting,
      isAr,
    );
    sections.push({ sectionKey: sec.key, heading, body, citationIds });
  }

  const renderedText = sections
    .map((s) => `${s.heading}\n${"─".repeat(s.heading.length)}\n${s.body}`)
    .join("\n\n");

  return {
    templateId: template.id,
    sections,
    renderedText,
  };
}

// -----------------------------------------------------------------------------
// Section population — pure functions, no LLM. Template slots are filled
// deterministically from the intake + research outputs.
// -----------------------------------------------------------------------------

function populateSection(
  key: string,
  intake: IntakeResult,
  research: ResearchResult,
  courtRouting: CourtRoutingResult,
  isAr: boolean,
): { body: string; citationIds: string[] } {
  switch (key) {
    case "background":
      return {
        body: intake.summary || (isAr ? "لا توجد خلفية متاحة." : "No background available."),
        citationIds: [],
      };

    case "parties": {
      if (!intake.parties || intake.parties.length === 0) {
        return {
          body: isAr ? "لم يتم تحديد الأطراف." : "No parties identified.",
          citationIds: [],
        };
      }
      const lines = intake.parties.map(
        (p) => `• ${p.name} — ${p.role}${p.contact ? ` (${p.contact})` : ""}`,
      );
      return { body: lines.join("\n"), citationIds: [] };
    }

    case "claims": {
      if (!intake.claims || intake.claims.length === 0) {
        return {
          body: isAr ? "لم يتم تحديد الادعاءات." : "No claims identified.",
          citationIds: [],
        };
      }
      const lines = intake.claims.map(
        (c) => `• [${c.type}] ${c.text}`,
      );
      return { body: lines.join("\n"), citationIds: [] };
    }

    case "facts": {
      if (!intake.facts || intake.facts.length === 0) {
        return {
          body: isAr ? "لم يتم تحديد الوقائع الرئيسية." : "No key facts identified.",
          citationIds: [],
        };
      }
      const lines = intake.facts.map(
        (f) => `• [${f.category}] ${f.text}`,
      );
      return { body: lines.join("\n"), citationIds: [] };
    }

    case "court_routing": {
      if (courtRouting.noMatch) {
        return {
          body: isAr
            ? "تعذّر تحديد المحكمة المختصة من بيانات الاستيعاب. يُرجى المراجعة اليدوية."
            : "No court could be resolved from the intake. Manual review required.",
          citationIds: [],
        };
      }
      const name = isAr ? courtRouting.courtNameAr : courtRouting.courtNameEn;
      const rule = courtRouting.routingReason?.rule ?? "";
      return {
        body: `${name ?? courtRouting.courtCode}\n${rule}`,
        citationIds: [],
      };
    }

    case "legal_basis": {
      if (research.noCorpusHits || research.corpusHits.length === 0) {
        return {
          body: isAr
            ? "لم يتم العثور على مواد قانونية داعمة في المدوّنة الأردنية المعتمدة. لا يمكن الاستشهاد بنص قانوني غير موثق."
            : "No supporting statutes were found in the curated Jordanian legal corpus. No unverified legal citation can be made.",
          citationIds: [],
        };
      }
      // Cite each corpus hit by chunkId. The citation-verify agent will
      // re-check each one and produce verification rows.
      const lines = research.corpusHits.map((h) => {
        const lawName = h.lawName ?? "?";
        const article = h.articleNumber ?? "?";
        const excerpt = (h.content ?? "").slice(0, 200);
        return `• ${lawName} — ${isAr ? "المادة" : "Art."} ${article}\n  "${excerpt}..."`;
      });
      return {
        body: lines.join("\n"),
        citationIds: research.corpusHits.map((h) => h.chunkId),
      };
    }

    case "relief": {
      const damages = (intake.claims ?? []).filter((c) => c.type === "damage");
      if (damages.length === 0) {
        return {
          body: isAr
            ? "لم يتم تحديد الطلبات بشكل صريح في الاستيعاب."
            : "No relief was explicitly identified in the intake.",
          citationIds: [],
        };
      }
      const lines = damages.map((d) => `• ${d.text}`);
      return { body: lines.join("\n"), citationIds: [] };
    }

    default:
      return { body: "", citationIds: [] };
  }
}
