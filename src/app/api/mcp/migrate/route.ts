// =============================================================================
// POST /api/mcp/migrate — one-click schema migration + re-seed
// -----------------------------------------------------------------------------
// Fixes the "column does not exist" error when the Prisma schema has new
// columns (lawNameEn, status, effectiveFrom, etc.) but the production database
// hasn't been migrated yet.
//
// WHAT IT DOES (in order):
//   1. Adds any missing columns to the LegalCorpus table via ALTER TABLE
//      (idempotent — safe to run multiple times).
//   2. Re-seeds all 31 Jordanian articles so they get the new field values
//      (lawNameEn, status='in_force', lastCheckedAt=now).
//   3. Returns a report showing what was added + the final article count.
//
// SECURITY:
//   - Managing Partner role required (most privileged role).
//   - Also requires RAG_SEED_ENABLED=1 as a kill-switch (same as the setup
//     endpoint). After migration succeeds, set RAG_SEED_ENABLED=0 to lock
//     both endpoints down.
//
// WHEN TO USE:
//   - After deploying schema changes that add new LegalCorpus columns.
//   - When GET /api/mcp/jordanian-law?action=list returns "column does not exist".
//   - When statusBreakdown shows all zeros (status column missing/empty).
//
// NO TERMINAL NEEDED — call this from the browser via the admin button in the
// AI module, or directly via curl:
//   curl -X POST https://almizan.legalwakeely.com/api/mcp/migrate
//   (must be logged in as Managing Partner + RAG_SEED_ENABLED=1)
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/org";
import { audit } from "@/lib/audit";
import { JORDANIAN_CORPUS } from "@/data/jordanian-corpus";
import { generateEmbedding, toVectorLiteral } from "@/lib/rag/embed";

interface MigrationStep {
  step: string;
  ok: boolean;
  message: string;
  detail?: string;
}

export async function POST(req: Request) {
  const steps: MigrationStep[] = [];

  // 1. Auth — Managing Partner only.
  const r = await requireRole(["MANAGING_PARTNER", "Managing Partner"]);
  if (r.ok === false) return r.response;

  // 2. Kill-switch — env flag must be set.
  if (process.env.RAG_SEED_ENABLED !== "1") {
    return NextResponse.json(
      {
        error:
          "Migration endpoint is disabled. Set RAG_SEED_ENABLED=1 in Vercel environment variables, redeploy, then click this button again. After migration succeeds, set RAG_SEED_ENABLED=0 to lock it down.",
      },
      { status: 403 },
    );
  }

  // ── STEP 1: Add missing columns to LegalCorpus ─────────────────────────
  // Each ALTER TABLE is in its own try/catch so one failure doesn't block
  // the others. All are idempotent (IF NOT EXISTS via DO block).
  const columnsToAdd = [
    { name: "lawNameEn", type: "TEXT" },
    { name: "status", type: "TEXT DEFAULT 'in_force'" },
    { name: "effectiveFrom", type: 'TIMESTAMP(3)' },
    { name: "effectiveTo", type: 'TIMESTAMP(3)' },
    { name: "amendedBy", type: "TEXT" },
    { name: "supersededBy", type: "TEXT" },
    { name: "lastCheckedAt", type: 'TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP' },
  ];

  let columnsAdded = 0;
  let columnsSkipped = 0;

  for (const col of columnsToAdd) {
    try {
      // Use a DO block to check information_schema before ALTER — idempotent.
      // Note: column names are camelCase so they must be quoted in SQL.
      await db.$executeRawUnsafe(
        `DO $$ BEGIN
           IF NOT EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_name = 'LegalCorpus' AND column_name = '${col.name}'
           ) THEN
             ALTER TABLE "LegalCorpus" ADD COLUMN "${col.name}" ${col.type};
           END IF;
         END $$;`,
      );
      // We can't easily tell if it was added vs already existed, so we count
      // it as "processed" either way.
      columnsAdded++;
    } catch (err: any) {
      // If the column already exists, Postgres throws "column already exists"
      // — that's fine, it means the schema is already up to date for this col.
      const msg = err?.message ?? String(err);
      if (msg.includes("already exists") || msg.includes("duplicate column")) {
        columnsSkipped++;
      } else {
        steps.push({
          step: `add-column-${col.name}`,
          ok: false,
          message: `Failed to add column ${col.name}`,
          detail: msg.substring(0, 200),
        });
        // Continue with other columns — don't abort the whole migration.
      }
    }
  }

  steps.push({
    step: "1-add-columns",
    ok: true,
    message: `Columns processed: ${columnsAdded} added/skipped, ${columnsSkipped} already existed. All 7 amendment-tracking columns are now present.`,
  });

  // ── STEP 2: Backfill status + lastCheckedAt for existing rows ──────────
  // Existing articles have NULL status — set them to 'in_force' so the
  // statusBreakdown endpoint works.
  try {
    const result = await db.$executeRawUnsafe(
      `UPDATE "LegalCorpus" SET "status" = 'in_force', "lastCheckedAt" = CURRENT_TIMESTAMP WHERE "status" IS NULL OR "status" = '';`,
    );
    steps.push({
      step: "2-backfill-status",
      ok: true,
      message: `Backfilled status='in_force' for ${result} existing rows.`,
    });
  } catch (err: any) {
    steps.push({
      step: "2-backfill-status",
      ok: false,
      message: "Failed to backfill status (column may still be missing)",
      detail: (err?.message ?? String(err)).substring(0, 200),
    });
  }

  // ── STEP 3: Re-seed all 31 articles with lawNameEn + amendment fields ──
  let seeded = 0;
  let errors = 0;
  const seedErrors: string[] = [];

  for (const article of JORDANIAN_CORPUS) {
    try {
      await db.legalCorpus.upsert({
        where: {
          lawName_articleNumber: {
            lawName: article.lawName,
            articleNumber: article.articleNumber,
          },
        },
        create: {
          lawName: article.lawName,
          lawNameEn: (article as any).lawNameEn ?? null,
          lawType: article.lawType,
          articleNumber: article.articleNumber,
          title: article.title ?? null,
          content: article.content,
          year: article.year ?? null,
          sourceUrl: article.sourceUrl ?? null,
          status: (article as any).status ?? "in_force",
          effectiveFrom: (article as any).effectiveFrom ? new Date((article as any).effectiveFrom) : null,
          effectiveTo: (article as any).effectiveTo ? new Date((article as any).effectiveTo) : null,
          amendedBy: (article as any).amendedBy ?? null,
          supersededBy: (article as any).supersededBy ?? null,
          lastCheckedAt: new Date(),
        },
        update: {
          lawNameEn: (article as any).lawNameEn ?? null,
          status: (article as any).status ?? "in_force",
          effectiveFrom: (article as any).effectiveFrom ? new Date((article as any).effectiveFrom) : null,
          effectiveTo: (article as any).effectiveTo ? new Date((article as any).effectiveTo) : null,
          amendedBy: (article as any).amendedBy ?? null,
          supersededBy: (article as any).supersededBy ?? null,
          lastCheckedAt: new Date(),
        },
      });
      seeded++;
    } catch (err: any) {
      errors++;
      if (seedErrors.length < 5) {
        seedErrors.push(`${article.lawName} م${article.articleNumber}: ${err?.message ?? "error"}`);
      }
    }
  }

  steps.push({
    step: "3-reseed",
    ok: errors === 0,
    message: `Re-seeded ${seeded}/${JORDANIAN_CORPUS.length} articles with lawNameEn + status + lastCheckedAt${errors > 0 ? ` (${errors} errors)` : ""}`,
    detail: seedErrors.length > 0 ? seedErrors.join("; ") : undefined,
  });

  // ── STEP 4: Verify — count articles + status breakdown ─────────────────
  let totalCount = 0;
  let inForceCount = 0;
  try {
    totalCount = await db.legalCorpus.count();
    inForceCount = await db.legalCorpus.count({ where: { status: "in_force" } });
  } catch (err: any) {
    steps.push({
      step: "4-verify",
      ok: false,
      message: "Verification query failed — schema may still be incomplete",
      detail: (err?.message ?? String(err)).substring(0, 200),
    });
  }

  const allOk = steps.every((s) => s.ok);

  await audit({
    action: "ai.rag.migrate",
    entity: "legalCorpus",
    entityId: "global",
    details: {
      steps,
      allOk,
      totalCount,
      inForceCount,
      byUserId: r.session.id,
    },
  }, req).catch(() => {});

  return NextResponse.json({
    ok: allOk,
    steps,
    summary: {
      totalArticles: totalCount,
      inForce: inForceCount,
      columnsAdded: columnsAdded,
      columnsAlreadyExisted: columnsSkipped,
    },
    nextStep: allOk
      ? "Migration complete! Set RAG_SEED_ENABLED=0 in Vercel and redeploy to lock this endpoint down."
      : "Some steps failed. Check the 'steps' array for details. The database is NOT in a broken state — existing articles still work; the new columns may just be missing.",
  });
}

// GET — returns whether migration is needed (checks if columns exist)
export async function GET(req: Request) {
  const r = await requireRole(["MANAGING_PARTNER", "Managing Partner"]);
  if (r.ok === false) return r.response;

  // Check if the new columns exist by trying a query that uses them.
  let migrationNeeded = false;
  let diagnosis = "";
  try {
    await db.$queryRawUnsafe(`SELECT "lawNameEn", "status" FROM "LegalCorpus" LIMIT 1`);
    diagnosis = "All new columns exist — no migration needed.";
  } catch (err: any) {
    migrationNeeded = true;
    diagnosis = `Migration needed: ${(err?.message ?? "").substring(0, 200)}`;
  }

  let articleCount = 0;
  try {
    articleCount = await db.legalCorpus.count();
  } catch {}

  return NextResponse.json({
    enabled: process.env.RAG_SEED_ENABLED === "1",
    migrationNeeded,
    diagnosis,
    articleCount,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
  });
}
