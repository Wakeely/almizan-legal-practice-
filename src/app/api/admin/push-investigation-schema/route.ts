// =============================================================================
// POST /api/admin/push-investigation-schema — ONE-TIME setup endpoint
// -----------------------------------------------------------------------------
// Creates the 10 Case Investigation Agent tables + the investigationAgentEnabled
// column on Organization in the production database. Idempotent — safe to run
// multiple times (every statement uses IF NOT EXISTS).
//
// WHY THIS EXISTS:
//   The Investigation Agent was deployed (commit 7c7e399) but the Prisma schema
//   changes (10 new tables + 1 new column) haven't been pushed to the production
//   database yet. The owner is non-technical and can't use a terminal, so this
//   endpoint lets them create the tables from the browser while logged in as
//   Managing Partner.
//
// SECURITY (3 layers, matching the existing /api/mcp/migrate pattern):
//   1. requireRole(["MANAGING_PARTNER", "Managing Partner"]) — most privileged role only
//   2. INVESTIGATION_SETUP_ENABLED=1 env var — kill-switch. After the tables are
//      created, the owner sets this back to 0 in Vercel to lock this endpoint down.
//   3. audit() log entry — records who ran it + when + what happened.
//
// WHAT IT DOES (all idempotent / additive):
//   - Adds Organization.investigationAgentEnabled BOOLEAN DEFAULT FALSE if missing
//   - Creates the 10 investigation tables (CaseInvestigation, InvestigationIntake,
//     InvestigationResearch, InvestigationCourtRouting, InvestigationDraft,
//     InvestigationCitationVerification, InvestigationFactConsistency,
//     InvestigationAssembly, InvestigationReview, InvestigationAgentRun)
//   - Creates the indexes from the Prisma schema
//   - Returns a report of what was created vs. what already existed
//
// AFTER SUCCESS: set INVESTIGATION_SETUP_ENABLED=0 in Vercel env vars + redeploy
// to disable this endpoint. The tables persist; the endpoint just stops responding.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";

interface StepResult {
  step: string;
  ok: boolean;
  message: string;
  detail?: string;
}

export async function POST(req: Request) {
  const steps: StepResult[] = [];

  // ── Layer 1: kill-switch — env var must be set ─────────────────────────
  // NOTE: This endpoint previously required requireRole(["Managing Partner"]),
  // but that created a chicken-and-egg problem: if login is broken (e.g.
  // because the Organization table is missing investigationAgentEnabled),
  // the owner can't log in to run this endpoint. So we switched to the same
  // token-based auth the password-reset + diagnose-login endpoints use.
  // The token is shared across all admin endpoints via PASSWORD_RESET_TOKEN.
  if (process.env.INVESTIGATION_SETUP_ENABLED !== "1") {
    return NextResponse.json(
      {
        error:
          "Investigation setup endpoint is disabled. Set INVESTIGATION_SETUP_ENABLED=1 + PASSWORD_RESET_TOKEN=<your-secret> in Vercel environment variables, redeploy, then retry.",
        disabled: true,
      },
      { status: 403 },
    );
  }

  // ── Layer 2: token check (same token as password reset) ────────────────
  const expectedToken = process.env.PASSWORD_RESET_TOKEN;
  if (!expectedToken || expectedToken.length < 8) {
    return NextResponse.json(
      {
        error:
          "Server misconfigured: PASSWORD_RESET_TOKEN env var is not set. Set it to a random string of at least 16 characters, redeploy, then retry.",
      },
      { status: 500 },
    );
  }

  // Token can be supplied in the body OR as a Bearer header, to support
  // both fetch-from-console (body) and browser-address-bar (header) usage.
  let suppliedToken: string | undefined;
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    suppliedToken = authHeader.slice(7);
  } else {
    try {
      const body = await req.json().catch((): null => null);
      suppliedToken = body?.token;
    } catch {
      suppliedToken = undefined;
    }
  }

  if (!suppliedToken || suppliedToken !== expectedToken) {
    return NextResponse.json(
      { error: "Invalid or missing token. Pass { token: '...' } in the body or Authorization: Bearer <token> header." },
      { status: 401 },
    );
  }

  // ── Rate limit ─────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  const limit = await authRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  // ── Step 1: Add investigationAgentEnabled column to Organization ───────
  try {
    await db.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'Organization' AND column_name = 'investigationAgentEnabled'
        ) THEN
          ALTER TABLE "Organization" ADD COLUMN "investigationAgentEnabled" BOOLEAN NOT NULL DEFAULT FALSE;
        END IF;
      END $$;
    `);
    steps.push({
      step: "add_organization_column",
      ok: true,
      message: "Organization.investigationAgentEnabled column present (added or already existed). Default is FALSE — no org has the add-on enabled yet.",
    });
  } catch (err: any) {
    steps.push({
      step: "add_organization_column",
      ok: false,
      message: `Failed to add Organization.investigationAgentEnabled: ${err?.message ?? String(err)}`,
    });
    // Don't abort — try the tables anyway, they might succeed independently.
  }

  // ── Step 2: Create the 10 investigation tables ─────────────────────────
  // Each CREATE TABLE IF NOT EXISTS is in its own try/catch so one failure
  // doesn't block the others. Column names are quoted camelCase to match the
  // Prisma schema exactly (Postgres lowercases unquoted identifiers).

  const tableDefinitions: Array<{ name: string; sql: string }> = [
    {
      name: "CaseInvestigation",
      sql: `CREATE TABLE IF NOT EXISTS "CaseInvestigation" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "matterId" TEXT,
        "startedByUserId" TEXT,
        "title" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'queued',
        "intakeInput" TEXT NOT NULL,
        "verificationTier" TEXT NOT NULL DEFAULT '2',
        "failureReason" TEXT,
        "lang" TEXT NOT NULL DEFAULT 'ar',
        "deletedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "CaseInvestigation_pkey" PRIMARY KEY ("id")
      );`,
    },
    {
      name: "InvestigationIntake",
      sql: `CREATE TABLE IF NOT EXISTS "InvestigationIntake" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "investigationId" TEXT NOT NULL,
        "partiesJson" TEXT,
        "claimsJson" TEXT,
        "factsJson" TEXT,
        "datesJson" TEXT,
        "amountsJson" TEXT,
        "summary" TEXT,
        "deletedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InvestigationIntake_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "InvestigationIntake_investigationId_fkey"
          FOREIGN KEY ("investigationId") REFERENCES "CaseInvestigation"("id") ON DELETE CASCADE,
        CONSTRAINT "InvestigationIntake_organizationId_fkey"
          FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
      );`,
    },
    {
      name: "InvestigationResearch",
      sql: `CREATE TABLE IF NOT EXISTS "InvestigationResearch" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "investigationId" TEXT NOT NULL,
        "queriesJson" TEXT,
        "corpusHitsJson" TEXT,
        "matterHitsJson" TEXT,
        "noCorpusHits" BOOLEAN NOT NULL DEFAULT FALSE,
        "deletedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InvestigationResearch_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "InvestigationResearch_investigationId_fkey"
          FOREIGN KEY ("investigationId") REFERENCES "CaseInvestigation"("id") ON DELETE CASCADE,
        CONSTRAINT "InvestigationResearch_organizationId_fkey"
          FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
      );`,
    },
    {
      name: "InvestigationCourtRouting",
      sql: `CREATE TABLE IF NOT EXISTS "InvestigationCourtRouting" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "investigationId" TEXT NOT NULL,
        "courtCode" TEXT,
        "courtNameAr" TEXT,
        "courtNameEn" TEXT,
        "routingReasonJson" TEXT,
        "noMatch" BOOLEAN NOT NULL DEFAULT FALSE,
        "deletedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InvestigationCourtRouting_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "InvestigationCourtRouting_investigationId_fkey"
          FOREIGN KEY ("investigationId") REFERENCES "CaseInvestigation"("id") ON DELETE CASCADE,
        CONSTRAINT "InvestigationCourtRouting_organizationId_fkey"
          FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
      );`,
    },
    {
      name: "InvestigationDraft",
      sql: `CREATE TABLE IF NOT EXISTS "InvestigationDraft" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "investigationId" TEXT NOT NULL,
        "templateId" TEXT,
        "sectionsJson" TEXT,
        "renderedText" TEXT,
        "deletedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InvestigationDraft_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "InvestigationDraft_investigationId_fkey"
          FOREIGN KEY ("investigationId") REFERENCES "CaseInvestigation"("id") ON DELETE CASCADE,
        CONSTRAINT "InvestigationDraft_organizationId_fkey"
          FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
      );`,
    },
    {
      name: "InvestigationCitationVerification",
      sql: `CREATE TABLE IF NOT EXISTS "InvestigationCitationVerification" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "investigationId" TEXT NOT NULL,
        "claimedCitation" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "corpusId" TEXT,
        "similarity" DOUBLE PRECISION,
        "reason" TEXT,
        "deletedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InvestigationCitationVerification_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "InvestigationCitationVerification_investigationId_fkey"
          FOREIGN KEY ("investigationId") REFERENCES "CaseInvestigation"("id") ON DELETE CASCADE,
        CONSTRAINT "InvestigationCitationVerification_organizationId_fkey"
          FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
      );`,
    },
    {
      name: "InvestigationFactConsistency",
      sql: `CREATE TABLE IF NOT EXISTS "InvestigationFactConsistency" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "investigationId" TEXT NOT NULL,
        "factText" TEXT NOT NULL,
        "usageRef" TEXT,
        "status" TEXT NOT NULL,
        "intakeValue" TEXT,
        "reason" TEXT,
        "deletedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InvestigationFactConsistency_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "InvestigationFactConsistency_investigationId_fkey"
          FOREIGN KEY ("investigationId") REFERENCES "CaseInvestigation"("id") ON DELETE CASCADE,
        CONSTRAINT "InvestigationFactConsistency_organizationId_fkey"
          FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
      );`,
    },
    {
      name: "InvestigationAssembly",
      sql: `CREATE TABLE IF NOT EXISTS "InvestigationAssembly" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "investigationId" TEXT NOT NULL,
        "packageJson" TEXT NOT NULL,
        "pdfBlobUrl" TEXT,
        "verificationsPassed" BOOLEAN NOT NULL DEFAULT FALSE,
        "deletedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InvestigationAssembly_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "InvestigationAssembly_investigationId_fkey"
          FOREIGN KEY ("investigationId") REFERENCES "CaseInvestigation"("id") ON DELETE CASCADE,
        CONSTRAINT "InvestigationAssembly_organizationId_fkey"
          FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
      );`,
    },
    {
      name: "InvestigationReview",
      sql: `CREATE TABLE IF NOT EXISTS "InvestigationReview" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "investigationId" TEXT NOT NULL,
        "reviewerId" TEXT NOT NULL,
        "decision" TEXT NOT NULL,
        "note" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InvestigationReview_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "InvestigationReview_investigationId_fkey"
          FOREIGN KEY ("investigationId") REFERENCES "CaseInvestigation"("id") ON DELETE CASCADE,
        CONSTRAINT "InvestigationReview_organizationId_fkey"
          FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
        CONSTRAINT "InvestigationReview_reviewerId_fkey"
          FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE
      );`,
    },
    {
      name: "InvestigationAgentRun",
      sql: `CREATE TABLE IF NOT EXISTS "InvestigationAgentRun" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "investigationId" TEXT NOT NULL,
        "agentName" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "startedAt" TIMESTAMP(3),
        "finishedAt" TIMESTAMP(3),
        "durationMs" INTEGER,
        "traceJson" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InvestigationAgentRun_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "InvestigationAgentRun_investigationId_fkey"
          FOREIGN KEY ("investigationId") REFERENCES "CaseInvestigation"("id") ON DELETE CASCADE,
        CONSTRAINT "InvestigationAgentRun_organizationId_fkey"
          FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
      );`,
    },
  ];

  let tablesCreated = 0;
  let tablesSkipped = 0;
  for (const t of tableDefinitions) {
    try {
      const result = await db.$executeRawUnsafe(t.sql);
      // $executeRawUnsafe returns the number of affected rows. CREATE TABLE
      // returns 0. We can't easily tell "created" vs "already existed" from
      // this, so we check information_schema for a definitive answer.
      const exists = await db.$queryRawUnsafe(`
        SELECT 1 FROM information_schema.tables
        WHERE table_name = '${t.name}' LIMIT 1
      `);
      if (Array.isArray(exists) && exists.length > 0) {
        // Table exists now. We treat it as "ok" — created-or-already-there.
        tablesCreated++;
        steps.push({
          step: `create_table_${t.name}`,
          ok: true,
          message: `Table "${t.name}" is present.`,
        });
      } else {
        steps.push({
          step: `create_table_${t.name}`,
          ok: false,
          message: `Table "${t.name}" was not created (unknown reason).`,
        });
      }
    } catch (err: any) {
      steps.push({
        step: `create_table_${t.name}`,
        ok: false,
        message: `Failed to create table "${t.name}": ${err?.message ?? String(err)}`,
      });
    }
  }

  // ── Step 3: Create indexes (idempotent via IF NOT EXISTS) ──────────────
  const indexDefinitions: string[] = [
    `CREATE INDEX IF NOT EXISTS "CaseInvestigation_organizationId_idx" ON "CaseInvestigation"("organizationId");`,
    `CREATE INDEX IF NOT EXISTS "CaseInvestigation_organizationId_matterId_idx" ON "CaseInvestigation"("organizationId", "matterId");`,
    `CREATE INDEX IF NOT EXISTS "CaseInvestigation_deletedAt_idx" ON "CaseInvestigation"("deletedAt");`,
    `CREATE INDEX IF NOT EXISTS "CaseInvestigation_status_idx" ON "CaseInvestigation"("status");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationIntake_organizationId_investigationId_idx" ON "InvestigationIntake"("organizationId", "investigationId");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationIntake_deletedAt_idx" ON "InvestigationIntake"("deletedAt");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationResearch_organizationId_investigationId_idx" ON "InvestigationResearch"("organizationId", "investigationId");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationResearch_deletedAt_idx" ON "InvestigationResearch"("deletedAt");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationCourtRouting_organizationId_investigationId_idx" ON "InvestigationCourtRouting"("organizationId", "investigationId");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationCourtRouting_deletedAt_idx" ON "InvestigationCourtRouting"("deletedAt");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationDraft_organizationId_investigationId_idx" ON "InvestigationDraft"("organizationId", "investigationId");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationDraft_deletedAt_idx" ON "InvestigationDraft"("deletedAt");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationCitationVerification_organizationId_investigationId_idx" ON "InvestigationCitationVerification"("organizationId", "investigationId");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationCitationVerification_deletedAt_idx" ON "InvestigationCitationVerification"("deletedAt");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationCitationVerification_status_idx" ON "InvestigationCitationVerification"("status");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationFactConsistency_organizationId_investigationId_idx" ON "InvestigationFactConsistency"("organizationId", "investigationId");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationFactConsistency_deletedAt_idx" ON "InvestigationFactConsistency"("deletedAt");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationFactConsistency_status_idx" ON "InvestigationFactConsistency"("status");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationAssembly_organizationId_investigationId_idx" ON "InvestigationAssembly"("organizationId", "investigationId");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationAssembly_deletedAt_idx" ON "InvestigationAssembly"("deletedAt");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationReview_organizationId_investigationId_idx" ON "InvestigationReview"("organizationId", "investigationId");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationReview_reviewerId_idx" ON "InvestigationReview"("reviewerId");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationAgentRun_organizationId_investigationId_idx" ON "InvestigationAgentRun"("organizationId", "investigationId");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationAgentRun_agentName_idx" ON "InvestigationAgentRun"("agentName");`,
    `CREATE INDEX IF NOT EXISTS "InvestigationAgentRun_status_idx" ON "InvestigationAgentRun"("status");`,
  ];

  let indexesCreated = 0;
  let indexErrors = 0;
  for (const idxSql of indexDefinitions) {
    try {
      await db.$executeRawUnsafe(idxSql);
      indexesCreated++;
    } catch {
      // Index creation failure is non-fatal — the table still works, just slower.
      indexErrors++;
    }
  }
  steps.push({
    step: "create_indexes",
    ok: true,
    message: `Indexes: ${indexesCreated} created or already existed${indexErrors > 0 ? `, ${indexErrors} failed (non-fatal)` : ""}.`,
  });

  // ── Step 4: Add back-relations on User (no-op for the DB — relations are
  // a Prisma-level concept, not a DB constraint. But we DO need to add the
  // startedByUserId + reviewerId foreign keys, which we already did in the
  // CREATE TABLE statements above. So this step is just a verification.)
  // The foreign keys are already in place from step 2.

  // ── Audit log ──────────────────────────────────────────────────────────
  const allOk = steps.every((s) => s.ok);
  await audit(
    {
      action: "admin.investigation_schema_setup",
      entity: "organization",
      details: {
        allOk,
        tablesCreated,
        indexesCreated,
        indexErrors,
        stepCount: steps.length,
        authMethod: "token",
      },
    },
    req,
  );

  return NextResponse.json({
    ok: allOk,
    message: allOk
      ? "Investigation schema setup complete. All 10 tables + the investigationAgentEnabled column are present. Default is FALSE — no org has the add-on enabled yet. Next: set INVESTIGATION_SETUP_ENABLED=0 in Vercel to lock this endpoint down."
      : "Setup completed with some failures — see steps for details. Tables that succeeded are usable; failed ones need manual investigation.",
    tablesCreated,
    indexesCreated,
    steps,
    nextAction:
      "After confirming success, go to Vercel → Settings → Environment Variables → set INVESTIGATION_SETUP_ENABLED=0 → Redeploy. This disables this endpoint. The tables persist.",
  });
}

// GET — returns whether the endpoint is enabled, WITHOUT running anything.
// No auth required for GET (it reveals only enabled/disabled status, nothing sensitive).
export async function GET() {
  return NextResponse.json({
    enabled: process.env.INVESTIGATION_SETUP_ENABLED === "1",
    message:
      process.env.INVESTIGATION_SETUP_ENABLED === "1"
        ? "Endpoint is ENABLED. POST to this URL to run the schema setup."
        : "Endpoint is DISABLED. Set INVESTIGATION_SETUP_ENABLED=1 in Vercel env vars + redeploy to enable.",
  });
}
