// =============================================================================
// POST /api/admin/fix-investigation-constraints — adds missing UNIQUE constraints
// -----------------------------------------------------------------------------
// BUG FIX: The push-investigation-schema endpoint created the 10 investigation
// tables but FORGOT to add UNIQUE constraints on the `investigationId` column
// for the 1:1 child tables (Intake, Research, CourtRouting, Draft, Assembly).
// The Prisma schema declares these as @unique, so the Prisma client generates
// upsert() calls with ON CONFLICT — but Postgres rejects them because the
// actual DB tables don't have the unique index.
//
// Symptoms: "Start Investigation" button fails with status=failed, reason:
//   "there is no unique or exclusion constraint matching the ON CONFLICT
//    specification"
//
// This endpoint runs ALTER TABLE ... ADD CONSTRAINT UNIQUE for each missing
// constraint. Idempotent — uses DO $$ IF NOT EXISTS blocks.
//
// SECURITY: Same token-based auth as the other admin endpoints.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";

interface StepResult {
  step: string;
  ok: boolean;
  message: string;
}

export async function POST(req: Request) {
  const steps: StepResult[] = [];

  // ── Kill-switch: reuse INVESTIGATION_SETUP_ENABLED ─────────────────────
  if (process.env.INVESTIGATION_SETUP_ENABLED !== "1") {
    return NextResponse.json(
      { error: "Endpoint disabled. Set INVESTIGATION_SETUP_ENABLED=1 + redeploy.", disabled: true },
      { status: 403 },
    );
  }

  // ── Token check (accept either token) ──────────────────────────────────
  const resetToken = process.env.PASSWORD_RESET_TOKEN;
  const bootstrapToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
  const validTokens = [resetToken, bootstrapToken].filter(
    (t): t is string => !!t && t.length >= 8,
  );
  if (validTokens.length === 0) {
    return NextResponse.json(
      { error: "Server misconfigured: no token env var set." },
      { status: 500 },
    );
  }

  const ip = getClientIp(req);
  const limit = await authRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  let body: { token?: string } | null = null;
  try {
    body = await req.json().catch((): null => null);
  } catch {
    body = null;
  }
  const suppliedToken = body?.token;
  if (!suppliedToken || !validTokens.includes(suppliedToken)) {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  // ── The 5 child tables that need UNIQUE on investigationId ─────────────
  // (CaseInvestigation itself has `id` as PK — that's fine. The 1:1 children
  //  are the ones with investigationId @unique in the Prisma schema.)
  const tablesNeedingUnique = [
    "InvestigationIntake",
    "InvestigationResearch",
    "InvestigationCourtRouting",
    "InvestigationDraft",
    "InvestigationAssembly",
  ];

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const table of tablesNeedingUnique) {
    const constraintName = `${table}_investigationId_key`;
    try {
      // DO $$ block: check if constraint exists, add if not. Idempotent.
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = '${constraintName}'
              AND conrelid = '"${table}"'::regclass
          ) THEN
            ALTER TABLE "${table}"
            ADD CONSTRAINT "${constraintName}" UNIQUE ("investigationId");
          END IF;
        END $$;
      `);
      // Verify it exists now
      const check = await db.$queryRawUnsafe(`
        SELECT 1 FROM pg_constraint
        WHERE conname = '${constraintName}'
          AND conrelid = '"${table}"'::regclass
        LIMIT 1
      `);
      if (Array.isArray(check) && check.length > 0) {
        added++;
        steps.push({
          step: `unique_${table}`,
          ok: true,
          message: `UNIQUE constraint on "${table}"."investigationId" is present (added or already existed).`,
        });
      } else {
        failed++;
        steps.push({
          step: `unique_${table}`,
          ok: false,
          message: `Constraint was not created on "${table}" (unknown reason).`,
        });
      }
    } catch (err: any) {
      failed++;
      steps.push({
        step: `unique_${table}`,
        ok: false,
        message: `Failed on "${table}": ${err?.message ?? String(err)}`,
      });
    }
  }

  // ── Also add the foreign key from CaseInvestigation.startedByUserId → User ──
  // (The original CREATE TABLE didn't add this FK because User is in a
  //  different table creation order. Let's add it if missing.)
  try {
    await db.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'CaseInvestigation_startedByUserId_fkey'
            AND conrelid = '"CaseInvestigation"'::regclass
        ) THEN
          ALTER TABLE "CaseInvestigation"
          ADD CONSTRAINT "CaseInvestigation_startedByUserId_fkey"
          FOREIGN KEY ("startedByUserId") REFERENCES "User"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    steps.push({
      step: "fk_startedByUserId",
      ok: true,
      message: "CaseInvestigation.startedByUserId → User FK present.",
    });
  } catch (err: any) {
    steps.push({
      step: "fk_startedByUserId",
      ok: false,
      message: `FK failed: ${err?.message ?? String(err)} (non-fatal)`,
    });
  }

  const allOk = failed === 0;
  await audit(
    {
      action: "admin.fix_investigation_constraints",
      entity: "organization",
      details: { allOk, added, skipped, failed, stepCount: steps.length },
    },
    req,
  );

  return NextResponse.json({
    ok: allOk,
    message: allOk
      ? "All UNIQUE constraints added. The 'Start Investigation' button should now work. Try creating an investigation again."
      : "Completed with some failures — see steps. The constraints that succeeded are usable.",
    added,
    failed,
    steps,
    nextAction: "Go to the Investigation tab and click 'New Investigation'. It should now complete the pipeline successfully.",
  });
}

export async function GET() {
  return NextResponse.json({
    enabled: process.env.INVESTIGATION_SETUP_ENABLED === "1",
    message: "POST with { token } to add the missing UNIQUE constraints.",
  });
}
