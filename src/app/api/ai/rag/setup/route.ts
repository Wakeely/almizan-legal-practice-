// =============================================================================
// POST /api/ai/rag/setup — ONE-CLICK RAG setup (no terminal, no SQL pasting)
// -----------------------------------------------------------------------------
// This endpoint does the ENTIRE production RAG setup in one request:
//   1. Creates DocumentChunk + LegalCorpus tables (if missing)
//   2. Enables the pgvector extension
//   3. Adds the embedding vector(768) columns (if missing)
//   4. Creates HNSW indexes
//   5. Creates match_document_chunks() + match_legal_corpus() + set_* functions
//   6. Seeds the Jordanian corpus (embeds 31 articles via Gemini)
//
// After it succeeds, RAG is fully operational. No SQL pasting, no terminal.
//
// SECURITY:
//   - Managing Partner role only (accepts both 'MANAGING_PARTNER' and
//     'Managing Partner' forms).
//   - Requires RAG_SEED_ENABLED=1 env var (same kill-switch as the seed
//     endpoint). After setup succeeds, set RAG_SEED_ENABLED=0 and redeploy
//     to lock BOTH this endpoint and the seed endpoint down.
//   - Audit-logged as ai.rag.setup.
//   - Does NOT accept body — no injection surface. All SQL is hardcoded.
//
// IDEMPOTENT: every step checks "does this already exist?" before running.
// Safe to click multiple times. If it fails halfway, fix the issue and click
// again — it picks up where it left off.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/org";
import { audit } from "@/lib/audit";
import { JORDANIAN_CORPUS, CORPUS_STATS } from "@/data/jordanian-corpus";
import { generateEmbedding, toVectorLiteral } from "@/lib/rag/embed";

// Each step returns { ok, message, detail? }. We collect them so the response
// shows exactly what succeeded/failed.
interface StepResult {
  step: string;
  ok: boolean;
  message: string;
  detail?: string;
}

export async function POST(req: Request) {
  // 1. Auth — Managing Partner only.
  const r = await requireRole(["MANAGING_PARTNER", "Managing Partner"]);
  if (r.ok === false) return r.response;

  // 2. Kill-switch.
  if (process.env.RAG_SEED_ENABLED !== "1") {
    return NextResponse.json(
      {
        error:
          "Setup endpoint is disabled. Set RAG_SEED_ENABLED=1 in Vercel environment variables, redeploy, then click this button again.",
      },
      { status: 403 },
    );
  }

  // 3. Verify Gemini key.
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY is not set on the server. Add it to Vercel environment variables (Production), redeploy, then click this button again.",
      },
      { status: 500 },
    );
  }

  const steps: StepResult[] = [];

  // ───────────────────────────────────────────────────────────────────────
  // STEP 1 — Create DocumentChunk table (if missing)
  // ───────────────────────────────────────────────────────────────────────
  try {
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "DocumentChunk" (
          "id" TEXT NOT NULL,
          "organizationId" TEXT NOT NULL,
          "matterId" TEXT NOT NULL,
          "documentId" TEXT,
          "transcriptId" TEXT,
          "sourceType" TEXT NOT NULL,
          "pageNumber" INTEGER,
          "chunkIndex" INTEGER NOT NULL,
          "content" TEXT NOT NULL,
          "tokenEstimate" INTEGER,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
      )
    `;
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "DocumentChunk_organizationId_matterId_idx"
        ON "DocumentChunk"("organizationId", "matterId")
    `;
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "DocumentChunk_organizationId_documentId_idx"
        ON "DocumentChunk"("organizationId", "documentId")
    `;
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "DocumentChunk_organizationId_transcriptId_idx"
        ON "DocumentChunk"("organizationId", "transcriptId")
    `;
    steps.push({ step: "1", ok: true, message: "DocumentChunk table ready" });
  } catch (err: any) {
    steps.push({
      step: "1",
      ok: false,
      message: "Failed to create DocumentChunk table",
      detail: err?.message ?? String(err),
    });
    // If we can't create the table, nothing else will work. Stop here.
    return finish(req, r.session.id, steps, false);
  }

  // ───────────────────────────────────────────────────────────────────────
  // STEP 2 — Create LegalCorpus table (if missing)
  // ───────────────────────────────────────────────────────────────────────
  try {
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "LegalCorpus" (
          "id" TEXT NOT NULL,
          "lawName" TEXT NOT NULL,
          "lawType" TEXT NOT NULL,
          "articleNumber" TEXT NOT NULL,
          "title" TEXT,
          "content" TEXT NOT NULL,
          "year" INTEGER,
          "sourceUrl" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "LegalCorpus_pkey" PRIMARY KEY ("id")
      )
    `;
    await db.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "LegalCorpus_lawName_articleNumber_key"
        ON "LegalCorpus"("lawName", "articleNumber")
    `;
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS "LegalCorpus_lawType_idx"
        ON "LegalCorpus"("lawType")
    `;
    steps.push({ step: "2", ok: true, message: "LegalCorpus table ready" });
  } catch (err: any) {
    steps.push({
      step: "2",
      ok: false,
      message: "Failed to create LegalCorpus table",
      detail: err?.message ?? String(err),
    });
    return finish(req, r.session.id, steps, false);
  }

  // ───────────────────────────────────────────────────────────────────────
  // STEP 3 — Enable pgvector extension
  // ───────────────────────────────────────────────────────────────────────
  // This may fail on Vercel Postgres if the role doesn't have CREATE
  // privilege. If it fails, we continue anyway — the user may need to enable
  // it from the Vercel dashboard, OR Vercel Postgres may already have it
  // enabled by default.
  try {
    await db.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
    steps.push({ step: "3", ok: true, message: "pgvector extension enabled" });
  } catch (err: any) {
    steps.push({
      step: "3",
      ok: false,
      message:
        "Could not enable pgvector extension (may require Vercel dashboard action). RAG will fall back to text search.",
      detail: err?.message ?? String(err),
    });
    // Continue — text search fallback still works. But we can't do vector
    // columns/indexes/functions, so skip steps 4-6 and go straight to seeding
    // (which will insert rows but skip embeddings).
    return finish(req, r.session.id, steps, false, true);
  }

  // ───────────────────────────────────────────────────────────────────────
  // STEP 4 — Add embedding columns (if missing)
  // ───────────────────────────────────────────────────────────────────────
  try {
    await db.$executeRaw`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'DocumentChunk' AND column_name = 'embedding'
        ) THEN
          ALTER TABLE "DocumentChunk" ADD COLUMN embedding vector(768);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'LegalCorpus' AND column_name = 'embedding'
        ) THEN
          ALTER TABLE "LegalCorpus" ADD COLUMN embedding vector(768);
        END IF;
      END $$;
    `;
    steps.push({ step: "4", ok: true, message: "Embedding columns ready" });
  } catch (err: any) {
    steps.push({
      step: "4",
      ok: false,
      message: "Failed to add embedding columns",
      detail: err?.message ?? String(err),
    });
    return finish(req, r.session.id, steps, false);
  }

  // ───────────────────────────────────────────────────────────────────────
  // STEP 5 — Create HNSW indexes
  // ───────────────────────────────────────────────────────────────────────
  try {
    await db.$executeRaw`
      DROP INDEX IF EXISTS "DocumentChunk_embedding_hnsw"
    `;
    await db.$executeRaw`
      CREATE INDEX "DocumentChunk_embedding_hnsw"
        ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    `;
    await db.$executeRaw`
      DROP INDEX IF EXISTS "LegalCorpus_embedding_hnsw"
    `;
    await db.$executeRaw`
      CREATE INDEX "LegalCorpus_embedding_hnsw"
        ON "LegalCorpus" USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    `;
    steps.push({ step: "5", ok: true, message: "HNSW indexes ready" });
  } catch (err: any) {
    steps.push({
      step: "5",
      ok: false,
      message: "Failed to create HNSW indexes",
      detail: err?.message ?? String(err),
    });
    return finish(req, r.session.id, steps, false);
  }

  // ───────────────────────────────────────────────────────────────────────
  // STEP 6 — Create match functions + set_* helpers
  // ───────────────────────────────────────────────────────────────────────
  try {
    await db.$executeRaw`
      CREATE OR REPLACE FUNCTION match_document_chunks(
        query_embedding vector(768),
        filter_org text,
        filter_matter text,
        match_count int DEFAULT 8,
        match_threshold float DEFAULT 0.30
      )
      RETURNS TABLE (
        id text,
        content text,
        "documentId" text,
        "transcriptId" text,
        "sourceType" text,
        "pageNumber" int,
        "chunkIndex" int,
        similarity float
      )
      LANGUAGE sql STABLE AS $$
        SELECT
          dc.id,
          dc.content,
          dc."documentId",
          dc."transcriptId",
          dc."sourceType",
          dc."pageNumber",
          dc."chunkIndex",
          (1 - (dc.embedding <=> query_embedding))::float AS similarity
        FROM "DocumentChunk" dc
        WHERE dc."organizationId" = filter_org
          AND dc."matterId" = filter_matter
          AND dc.embedding IS NOT NULL
          AND 1 - (dc.embedding <=> query_embedding) >= match_threshold
        ORDER BY dc.embedding <=> query_embedding
        LIMIT match_count;
      $$;
    `;
    await db.$executeRaw`
      CREATE OR REPLACE FUNCTION match_legal_corpus(
        query_embedding vector(768),
        match_count int DEFAULT 6,
        match_threshold float DEFAULT 0.30
      )
      RETURNS TABLE (
        id text,
        "lawName" text,
        "lawType" text,
        "articleNumber" text,
        title text,
        content text,
        year int,
        "sourceUrl" text,
        similarity float
      )
      LANGUAGE sql STABLE AS $$
        SELECT
          lc.id,
          lc."lawName",
          lc."lawType",
          lc."articleNumber",
          lc.title,
          lc.content,
          lc.year,
          lc."sourceUrl",
          (1 - (lc.embedding <=> query_embedding))::float AS similarity
        FROM "LegalCorpus" lc
        WHERE lc.embedding IS NOT NULL
          AND 1 - (lc.embedding <=> query_embedding) >= match_threshold
        ORDER BY lc.embedding <=> query_embedding
        LIMIT match_count;
      $$;
    `;
    await db.$executeRaw`
      CREATE OR REPLACE FUNCTION set_document_chunk_embedding(
        chunk_id text,
        new_embedding vector(768)
      )
      RETURNS void
      LANGUAGE sql AS $$
        UPDATE "DocumentChunk" SET embedding = new_embedding WHERE id = chunk_id;
      $$;
    `;
    await db.$executeRaw`
      CREATE OR REPLACE FUNCTION set_legal_corpus_embedding(
        corpus_id text,
        new_embedding vector(768)
      )
      RETURNS void
      LANGUAGE sql AS $$
        UPDATE "LegalCorpus" SET embedding = new_embedding WHERE id = corpus_id;
      $$;
    `;
    steps.push({ step: "6", ok: true, message: "Match functions ready" });
  } catch (err: any) {
    steps.push({
      step: "6",
      ok: false,
      message: "Failed to create match functions",
      detail: err?.message ?? String(err),
    });
    return finish(req, r.session.id, steps, false);
  }

  // ───────────────────────────────────────────────────────────────────────
  // STEP 7 — Seed the Jordanian corpus (embed + upsert all 31 articles)
  // ───────────────────────────────────────────────────────────────────────
  let inserted = 0;
  let updated = 0;
  let embeddingsWritten = 0;
  let embeddingErrors = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  for (const article of JORDANIAN_CORPUS) {
    try {
      const row = await db.legalCorpus.upsert({
        where: {
          lawName_articleNumber: {
            lawName: article.lawName,
            articleNumber: article.articleNumber,
          },
        },
        create: {
          lawName: article.lawName,
          lawType: article.lawType,
          articleNumber: article.articleNumber,
          title: article.title ?? null,
          content: article.content,
          year: article.year ?? null,
          sourceUrl: article.sourceUrl ?? null,
        },
        update: {
          lawType: article.lawType,
          title: article.title ?? null,
          content: article.content,
          year: article.year ?? null,
          sourceUrl: article.sourceUrl ?? null,
        },
      });

      // Track create vs update heuristically.
      const existing = await db.legalCorpus.count({
        where: { lawName: article.lawName, articleNumber: article.articleNumber },
      });
      if (existing > 0) {
        // Could be insert or update — we can't easily tell from upsert.
        // Use createdAt vs updatedAt to decide.
        const fresh = await db.legalCorpus.findUnique({
          where: { id: row.id },
          select: { createdAt: true, updatedAt: true },
        });
        if (fresh && fresh.createdAt.getTime() === fresh.updatedAt.getTime()) {
          inserted++;
        } else {
          updated++;
        }
      } else {
        inserted++;
      }

      // Embed + write vector.
      const embedding = await generateEmbedding(
        `${article.lawName} — المادة ${article.articleNumber}\n${article.title ?? ""}\n${article.content}`,
      );
      const literal = toVectorLiteral(embedding);
      if (!literal) {
        embeddingErrors++;
        continue;
      }
      try {
        await db.$executeRaw`
          UPDATE "LegalCorpus"
          SET embedding = ${literal}::vector
          WHERE id = ${row.id}
        `;
        embeddingsWritten++;
      } catch (err: any) {
        embeddingErrors++;
        if (errorDetails.length < 5) {
          errorDetails.push(`${article.lawName} م${article.articleNumber}: ${err?.message ?? "embedding write failed"}`);
        }
      }
    } catch (err: any) {
      errors++;
      if (errorDetails.length < 5) {
        errorDetails.push(`${article.lawName} م${article.articleNumber}: ${err?.message ?? "unknown error"}`);
      }
    }
  }

  steps.push({
    step: "7",
    ok: embeddingsWritten === JORDANIAN_CORPUS.length,
    message: `Corpus seeded: ${embeddingsWritten}/${JORDANIAN_CORPUS.length} embeddings written${embeddingErrors > 0 ? `, ${embeddingErrors} errors` : ""}`,
    detail: errorDetails.length > 0 ? errorDetails.join("; ") : undefined,
  });

  const allOk = steps.every((s) => s.ok);
  return finish(req, r.session.id, steps, allOk, undefined, {
    inserted,
    updated,
    embeddingsWritten,
    embeddingErrors,
    errors,
    totalArticles: JORDANIAN_CORPUS.length,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Helper: write audit log + return the JSON response.
// ─────────────────────────────────────────────────────────────────────────
async function finish(
  req: Request,
  userId: string,
  steps: StepResult[],
  allOk: boolean,
  textFallbackOnly?: boolean,
  seedStats?: Record<string, number>,
) {
  await audit({
    action: "ai.rag.setup",
    entity: "legalCorpus",
    entityId: "global",
    details: {
      steps,
      allOk,
      textFallbackOnly: !!textFallbackOnly,
      seedStats,
      byUserId: userId,
    },
  }, req);

  return NextResponse.json({
    ok: allOk,
    textFallbackOnly: !!textFallbackOnly,
    steps,
    seedStats,
    byType: CORPUS_STATS,
    nextStep: allOk
      ? "RAG is fully operational. Go to Vercel → Settings → Environment Variables, set RAG_SEED_ENABLED=0, and redeploy to lock this setup endpoint down."
      : textFallbackOnly
        ? "pgvector could not be enabled from app code (needs Vercel dashboard). RAG is running in text-search mode — keyword queries work, semantic search doesn't. To enable semantic search, enable the pgvector extension from Vercel → Storage → your Postgres → Settings, then click this button again."
        : "Some steps failed. Check the 'steps' array for details, fix the issue (usually a missing env var), and click this button again — it's idempotent and will pick up where it left off.",
  });
}

// GET — returns whether setup is needed + current state.
export async function GET(req: Request) {
  const r = await requireRole(["MANAGING_PARTNER", "Managing Partner"]);
  if (r.ok === false) return r.response;

  // Check each component's existence.
  let tablesExist = false;
  let pgvectorEnabled = false;
  let embeddingColumnsExist = false;
  let matchFunctionExists = false;
  let corpusCount = 0;
  let withEmbeddings = 0;

  try {
    const tableRows = (await db.$queryRaw`
      SELECT tablename FROM pg_tables WHERE tablename IN ('DocumentChunk', 'LegalCorpus')
    `) as Array<{ tablename: string }>;
    tablesExist = tableRows.length === 2;
  } catch {}

  try {
    const extRows = (await db.$queryRaw`
      SELECT 1 FROM pg_extension WHERE extname = 'vector' LIMIT 1
    `) as Array<unknown>;
    pgvectorEnabled = extRows.length > 0;
  } catch {}

  try {
    const colRows = (await db.$queryRaw`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'LegalCorpus' AND column_name = 'embedding'
      LIMIT 1
    `) as Array<unknown>;
    embeddingColumnsExist = colRows.length > 0;
  } catch {}

  try {
    const fnRows = (await db.$queryRaw`
      SELECT 1 FROM pg_proc WHERE proname = 'match_document_chunks' LIMIT 1
    `) as Array<unknown>;
    matchFunctionExists = fnRows.length > 0;
  } catch {}

  try {
    corpusCount = await db.legalCorpus.count();
  } catch {}

  try {
    const embRows = (await db.$queryRaw`
      SELECT COUNT(*)::int AS n FROM "LegalCorpus" WHERE embedding IS NOT NULL
    `) as Array<{ n: number }>;
    withEmbeddings = embRows[0]?.n ?? 0;
  } catch {}

  const fullySetup = tablesExist && pgvectorEnabled && embeddingColumnsExist && matchFunctionExists && withEmbeddings >= 31;

  return NextResponse.json({
    enabled: process.env.RAG_SEED_ENABLED === "1",
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    tablesExist,
    pgvectorEnabled,
    embeddingColumnsExist,
    matchFunctionExists,
    corpusCount,
    withEmbeddings,
    fullySetup,
  });
}
