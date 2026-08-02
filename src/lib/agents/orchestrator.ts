// =============================================================================
// Al Mizan — Case Investigation Agent — Orchestrator
// -----------------------------------------------------------------------------
// Runs the 7-stage pipeline in order, persists each stage's output to the
// Prisma tables, and tracks per-agent execution in InvestigationAgentRun.
//
// STATUS FLOW:
//   queued → running → (awaiting_attorney_review | failed) → completed
//
// RETRY POLICY:
//   Each agent that calls the LLM is retried up to MAX_AGENT_RETRIES times
//   on failure (network blips, transient quota). After exhausting retries
//   the pipeline marks the investigation 'failed' with a reason and stops.
//   The user can re-run from the API (POST /api/investigations/:id/restart —
//   Phase 2.5; for now, starting a new investigation is the retry path).
//
// PERSISTENCE:
//   - Each agent's output is written to its stage table (InvestigationIntake,
//     InvestigationResearch, etc.) as a JSON-encoded String.
//   - Each agent execution is logged in InvestigationAgentRun with startedAt,
//     finishedAt, durationMs, status, and a size-bounded traceJson.
//   - The CaseInvestigation row's status is updated after each stage.
//
// BLOCKING:
//   After stages 5 (citation-verify) + 6 (fact-consistency), the orchestrator
//   calls canAssemble(). If blocking, it writes the verification rows + a
//   'failed' status with the blocking reasons, and DOES NOT run the assembler.
//
// ATTORNEY REVIEW GATE:
//   When the assembler succeeds, the status moves to 'awaiting_attorney_review'.
//   It stays there until an attorney approves via POST /api/investigations/:id/review.
//   On approve → status becomes 'completed'. On reject/request_changes → status
//   stays 'awaiting_attorney_review' (so the attorney can re-review after edits)
//   unless the reviewer explicitly rejects, in which case it moves to 'failed'.
// =============================================================================

import { db } from "@/lib/db";
import { runIntakeAgent } from "@/lib/agents/agents/intake-agent";
import { runResearchAgent } from "@/lib/agents/agents/research-agent";
import { runCourtRoutingAgent } from "@/lib/agents/agents/court-routing-agent";
import { runDraftingAgent } from "@/lib/agents/agents/drafting-agent";
import { runCitationVerifyAgent } from "@/lib/agents/agents/citation-verify-agent";
import { runFactConsistencyAgent } from "@/lib/agents/agents/fact-consistency-agent";
import { runAssembler, canAssemble } from "@/lib/agents/agents/assembler-agent";
import type {
  AgentName,
  AgentRunStatus,
  AgentRunTrace,
  CitationVerification,
  FactCheckResult,
  InvestigationLang,
  PipelineStatus,
  VerificationTier,
} from "@/lib/agents/types";

const MAX_AGENT_RETRIES = 2;
const TRACE_MAX_CHARS = 8000; // size cap for traceJson

// -----------------------------------------------------------------------------
// Public entry point — called by POST /api/investigations (start) and by a
// restart endpoint (Phase 2.5). Runs synchronously; the API route can run it
// in a fire-and-forget way for long-running investigations.
// -----------------------------------------------------------------------------

export interface OrchestratorInput {
  investigationId: string;
  organizationId: string;
  matterId: string | null;
  jurisdiction?: string | null;
  lang: InvestigationLang;
  tier: VerificationTier;
}

export interface OrchestratorResult {
  status: PipelineStatus;
  failureReason?: string;
}

export async function runInvestigationPipeline(
  input: OrchestratorInput,
): Promise<OrchestratorResult> {
  const { investigationId, organizationId, matterId, jurisdiction, lang, tier } = input;

  // Mark the investigation as running.
  await updateInvestigationStatus(investigationId, organizationId, "running");

  // ── Stage 1: Intake ────────────────────────────────────────────────────
  const intake = await runStageWithRetry(
    investigationId,
    organizationId,
    "intake",
    async () => {
      const inv = await db.caseInvestigation.findUniqueOrThrow({
        where: { id: investigationId },
        select: { intakeInput: true },
      });
      return runIntakeAgent(inv.intakeInput, lang);
    },
  );
  if (intake.ok === false) return failInvestigation(investigationId, organizationId, "intake", intake.error);

  await db.investigationIntake.upsert({
    where: { investigationId },
    create: {
      organizationId,
      investigationId,
      partiesJson: JSON.stringify(intake.data.parties),
      claimsJson: JSON.stringify(intake.data.claims),
      factsJson: JSON.stringify(intake.data.facts),
      datesJson: JSON.stringify(intake.data.dates),
      amountsJson: JSON.stringify(intake.data.amounts),
      summary: intake.data.summary,
    },
    update: {
      partiesJson: JSON.stringify(intake.data.parties),
      claimsJson: JSON.stringify(intake.data.claims),
      factsJson: JSON.stringify(intake.data.facts),
      datesJson: JSON.stringify(intake.data.dates),
      amountsJson: JSON.stringify(intake.data.amounts),
      summary: intake.data.summary,
    },
  });

  // ── Stage 2: Research ──────────────────────────────────────────────────
  const research = await runStageWithRetry(
    investigationId,
    organizationId,
    "research",
    async () => runResearchAgent(organizationId, matterId, intake.data),
  );
  if (research.ok === false) return failInvestigation(investigationId, organizationId, "research", research.error);

  await db.investigationResearch.upsert({
    where: { investigationId },
    create: {
      organizationId,
      investigationId,
      queriesJson: JSON.stringify(research.data.queries),
      corpusHitsJson: JSON.stringify(research.data.corpusHits),
      matterHitsJson: JSON.stringify(research.data.matterHits),
      noCorpusHits: research.data.noCorpusHits,
    },
    update: {
      queriesJson: JSON.stringify(research.data.queries),
      corpusHitsJson: JSON.stringify(research.data.corpusHits),
      matterHitsJson: JSON.stringify(research.data.matterHits),
      noCorpusHits: research.data.noCorpusHits,
    },
  });

  // ── Stage 3: Court Routing ─────────────────────────────────────────────
  const courtRouting = await runStageWithRetry(
    investigationId,
    organizationId,
    "court_routing",
    async () => runCourtRoutingAgent({ intake: intake.data, jurisdiction }),
  );
  if (courtRouting.ok === false) return failInvestigation(investigationId, organizationId, "court_routing", courtRouting.error);

  await db.investigationCourtRouting.upsert({
    where: { investigationId },
    create: {
      organizationId,
      investigationId,
      courtCode: courtRouting.data.courtCode,
      courtNameAr: courtRouting.data.courtNameAr,
      courtNameEn: courtRouting.data.courtNameEn,
      routingReasonJson: courtRouting.data.routingReason
        ? JSON.stringify(courtRouting.data.routingReason)
        : null,
      noMatch: courtRouting.data.noMatch,
    },
    update: {
      courtCode: courtRouting.data.courtCode,
      courtNameAr: courtRouting.data.courtNameAr,
      courtNameEn: courtRouting.data.courtNameEn,
      routingReasonJson: courtRouting.data.routingReason
        ? JSON.stringify(courtRouting.data.routingReason)
        : null,
      noMatch: courtRouting.data.noMatch,
    },
  });

  // ── Stage 4: Drafting ──────────────────────────────────────────────────
  const draft = await runStageWithRetry(
    investigationId,
    organizationId,
    "drafting",
    async () =>
      runDraftingAgent({
        intake: intake.data,
        research: research.data,
        courtRouting: courtRouting.data,
        lang,
      }),
  );
  if (draft.ok === false) return failInvestigation(investigationId, organizationId, "drafting", draft.error);

  await db.investigationDraft.upsert({
    where: { investigationId },
    create: {
      organizationId,
      investigationId,
      templateId: draft.data.templateId,
      sectionsJson: JSON.stringify(draft.data.sections),
      renderedText: draft.data.renderedText,
    },
    update: {
      templateId: draft.data.templateId,
      sectionsJson: JSON.stringify(draft.data.sections),
      renderedText: draft.data.renderedText,
    },
  });

  // ── Stage 5: Citation Verify (BLOCKING) ────────────────────────────────
  const citationVerifications = await runStageWithRetry(
    investigationId,
    organizationId,
    "citation_verify",
    async () => runCitationVerifyAgent(draft.data, research.data),
  );
  if (citationVerifications.ok === false)
    return failInvestigation(investigationId, organizationId, "citation_verify", citationVerifications.error);

  // Persist verification rows. Delete existing rows first so re-runs don't
  // accumulate duplicates.
  await db.investigationCitationVerification.deleteMany({
    where: { investigationId, organizationId },
  });
  if (citationVerifications.data.length > 0) {
    await db.investigationCitationVerification.createMany({
      data: citationVerifications.data.map((c) => ({
        organizationId,
        investigationId,
        claimedCitation: c.claimedCitation,
        status: c.status,
        corpusId: c.corpusId ?? null,
        similarity: c.similarity ?? null,
        reason: c.reason ?? null,
      })),
    });
  }

  // ── Stage 6: Fact Consistency (BLOCKING for tier 1/2) ──────────────────
  const factChecks = await runStageWithRetry(
    investigationId,
    organizationId,
    "fact_consistency",
    async () => runFactConsistencyAgent(intake.data, draft.data, tier),
  );
  if (factChecks.ok === false)
    return failInvestigation(investigationId, organizationId, "fact_consistency", factChecks.error);

  await db.investigationFactConsistency.deleteMany({
    where: { investigationId, organizationId },
  });
  if (factChecks.data.length > 0) {
    await db.investigationFactConsistency.createMany({
      data: factChecks.data.map((f) => ({
        organizationId,
        investigationId,
        factText: f.factText,
        usageRef: f.usageRef ?? null,
        status: f.status,
        intakeValue: f.intakeValue ?? null,
        reason: f.reason ?? null,
      })),
    });
  }

  // ── Blocking gate ──────────────────────────────────────────────────────
  const { canAssemble: passed, blockingReasons } = canAssemble(
    citationVerifications.data as CitationVerification[],
    factChecks.data as FactCheckResult[],
    tier,
  );

  if (!passed) {
    const reason = blockingReasons.join(" | ");
    await db.caseInvestigation.update({
      where: { id: investigationId },
      data: {
        status: "failed",
        failureReason: reason.slice(0, 2000),
      },
    });
    return { status: "failed", failureReason: reason };
  }

  // ── Stage 7: Assembler ─────────────────────────────────────────────────
  const assembly = await runStageWithRetry(
    investigationId,
    organizationId,
    "assembler",
    async () =>
      runAssembler({
        investigationId,
        title: (await db.caseInvestigation.findUniqueOrThrow({ where: { id: investigationId }, select: { title: true } })).title,
        lang,
        tier,
        intake: intake.data,
        research: research.data,
        courtRouting: courtRouting.data,
        draft: draft.data,
        citationVerifications: citationVerifications.data,
        factChecks: factChecks.data,
      }),
  );
  if (assembly.ok === false) return failInvestigation(investigationId, organizationId, "assembler", assembly.error);

  await db.investigationAssembly.upsert({
    where: { investigationId },
    create: {
      organizationId,
      investigationId,
      packageJson: JSON.stringify(assembly.data),
      pdfBlobUrl: null,
      verificationsPassed: assembly.data.verificationsPassed,
    },
    update: {
      packageJson: JSON.stringify(assembly.data),
      pdfBlobUrl: null,
      verificationsPassed: assembly.data.verificationsPassed,
    },
  });

  // ── Move to attorney review ────────────────────────────────────────────
  await updateInvestigationStatus(investigationId, organizationId, "awaiting_attorney_review");
  return { status: "awaiting_attorney_review" };
}

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

async function runStageWithRetry<T>(
  investigationId: string,
  organizationId: string,
  agentName: AgentName,
  fn: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  let lastError = "";
  for (let attempt = 0; attempt <= MAX_AGENT_RETRIES; attempt++) {
    const startedAt = new Date();
    const trace: AgentRunTrace = {};

    try {
      const data = await fn();
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      await db.investigationAgentRun.create({
        data: {
          organizationId,
          investigationId,
          agentName,
          status: "passed",
          startedAt,
          finishedAt,
          durationMs,
          traceJson: boundTrace(trace),
        },
      });
      return { ok: true, data };
    } catch (err: any) {
      lastError = err?.message ?? String(err);
      trace.error = lastError;
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      // Log the failed attempt.
      await db.investigationAgentRun.create({
        data: {
          organizationId,
          investigationId,
          agentName,
          status: attempt < MAX_AGENT_RETRIES ? "failed" : "failed",
          startedAt,
          finishedAt,
          durationMs,
          traceJson: boundTrace(trace),
        },
      });

      if (attempt < MAX_AGENT_RETRIES) {
        // Brief backoff before retry.
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
    }
  }
  return { ok: false, error: lastError };
}

async function updateInvestigationStatus(
  investigationId: string,
  organizationId: string,
  status: PipelineStatus,
): Promise<void> {
  await db.caseInvestigation.update({
    where: { id: investigationId, organizationId },
    data: { status },
  });
}

async function failInvestigation(
  investigationId: string,
  organizationId: string,
  agentName: AgentName,
  error: string,
): Promise<OrchestratorResult> {
  const reason = `Agent '${agentName}' failed after retries: ${error.slice(0, 1500)}`;
  await db.caseInvestigation.update({
    where: { id: investigationId, organizationId },
    data: {
      status: "failed",
      failureReason: reason,
    },
  });
  return { status: "failed", failureReason: reason };
}

function boundTrace(trace: AgentRunTrace): string {
  const json = JSON.stringify(trace);
  if (json.length <= TRACE_MAX_CHARS) return json;
  // Truncate the error field if the trace is too long.
  return JSON.stringify({
    ...trace,
    error: trace.error ? trace.error.slice(0, 2000) : undefined,
    _truncated: true,
  });
}
