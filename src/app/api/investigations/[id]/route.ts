// =============================================================================
// /api/investigations/[id] — get a single investigation (status + result)
// -----------------------------------------------------------------------------
// Returns the full investigation state:
//   - top-level status, title, tier, lang, failureReason
//   - the assembled InvestigationPackage (when status is awaiting_attorney_review
//     or completed)
//   - the per-stage outputs (intake, research, court routing, draft,
//     verification rows, fact checks, agent runs, reviews)
//
// All JSON-encoded columns are parsed back to objects at the API boundary,
// following the same pattern as /api/conflict-check (matchedEntities).
//
// Authorisation: requireInvestigationAccess() + verify the investigation
// belongs to the user's org (org-scoped where clause).
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireInvestigationAccess } from "../_gate";

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireInvestigationAccess();
  if (gate.ok === false) return gate.response;
  const session = gate.session;
  const { id } = await ctx.params;

  const investigation = await db.caseInvestigation.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      intake: true,
      research: true,
      courtRouting: true,
      draft: true,
      citationVerifications: { orderBy: { createdAt: "asc" } },
      factChecks: { orderBy: { createdAt: "asc" } },
      assembly: true,
      reviews: { orderBy: { createdAt: "desc" } },
      agentRuns: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!investigation) {
    return NextResponse.json(
      { error: "Investigation not found" },
      { status: 404 },
    );
  }

  // Parse the JSON-encoded columns back to objects.
  const result = {
    id: investigation.id,
    title: investigation.title,
    status: investigation.status,
    verificationTier: investigation.verificationTier,
    lang: investigation.lang,
    matterId: investigation.matterId,
    startedByUserId: investigation.startedByUserId,
    failureReason: investigation.failureReason,
    createdAt: investigation.createdAt,
    updatedAt: investigation.updatedAt,

    intake: investigation.intake
      ? {
          summary: investigation.intake.summary,
          parties: safeParse(investigation.intake.partiesJson, []),
          claims: safeParse(investigation.intake.claimsJson, []),
          facts: safeParse(investigation.intake.factsJson, []),
          dates: safeParse(investigation.intake.datesJson, []),
          amounts: safeParse(investigation.intake.amountsJson, []),
        }
      : null,

    research: investigation.research
      ? {
          queries: safeParse(investigation.research.queriesJson, []),
          corpusHits: safeParse(investigation.research.corpusHitsJson, []),
          matterHits: safeParse(investigation.research.matterHitsJson, []),
          noCorpusHits: investigation.research.noCorpusHits,
        }
      : null,

    courtRouting: investigation.courtRouting
      ? {
          courtCode: investigation.courtRouting.courtCode,
          courtNameAr: investigation.courtRouting.courtNameAr,
          courtNameEn: investigation.courtRouting.courtNameEn,
          routingReason: safeParse(
            investigation.courtRouting.routingReasonJson,
            null,
          ),
          noMatch: investigation.courtRouting.noMatch,
        }
      : null,

    draft: investigation.draft
      ? {
          templateId: investigation.draft.templateId,
          sections: safeParse(investigation.draft.sectionsJson, []),
          renderedText: investigation.draft.renderedText,
        }
      : null,

    citationVerifications: investigation.citationVerifications,
    factChecks: investigation.factChecks,

    assembly: investigation.assembly
      ? {
          package: safeParse(investigation.assembly.packageJson, null),
          verificationsPassed: investigation.assembly.verificationsPassed,
          pdfBlobUrl: investigation.assembly.pdfBlobUrl,
          assembledAt: investigation.assembly.createdAt,
        }
      : null,

    reviews: investigation.reviews,
    agentRuns: investigation.agentRuns.map((r) => ({
      id: r.id,
      agentName: r.agentName,
      status: r.status,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      durationMs: r.durationMs,
    })),
  };

  return NextResponse.json(result);
}
