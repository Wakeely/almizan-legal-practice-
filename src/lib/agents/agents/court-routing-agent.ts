// =============================================================================
// Agent 3 — Court Routing Agent
// -----------------------------------------------------------------------------
// Resolves the appropriate court / forum for the investigation by LOOKUP
// against the court-routing reference table (court-routing-service.ts).
// This agent NEVER calls the LLM to invent a court. If the reference table
// has no match, it returns { noMatch: true } and the pipeline surfaces that
// honestly.
//
// The agent infers (jurisdiction, claimType, amount) from the intake + the
// optional matter, then delegates to routeCourt().
// =============================================================================

import {
  routeCourt,
  inferClaimType,
} from "@/lib/agents/services/court-routing-service";
import type { CourtRoutingResult, IntakeResult } from "@/lib/agents/types";

export interface CourtRoutingAgentInput {
  intake: IntakeResult;
  /** Matter jurisdiction (e.g. "Amman, Jordan"). Falls back to "Jordan". */
  jurisdiction?: string | null;
}

export async function runCourtRoutingAgent(
  input: CourtRoutingAgentInput,
): Promise<CourtRoutingResult> {
  const jurisdiction = (input.jurisdiction ?? "Jordan").trim();

  // Build a single text blob from claims + facts to infer the claim type.
  const claimsText = [
    ...(input.intake.claims ?? []).map((c) => c.text),
    ...(input.intake.facts ?? []).map((f) => f.text),
  ].join(" ");
  const claimType = inferClaimType(claimsText);

  // Pick the largest amount as the claim value (if any).
  const amounts = input.intake.amounts ?? [];
  const maxAmount = amounts.length > 0 ? Math.max(...amounts.map((a) => a.amount)) : undefined;

  return routeCourt({
    jurisdiction,
    claimType,
    amountJOD: maxAmount,
  });
}
