-- =============================================================================
-- Al Mizan — CREATE the RAG tables (DocumentChunk + LegalCorpus)
-- -----------------------------------------------------------------------------
-- Run this FIRST, before prisma/sql/rag_pgvector_setup_split.sql, if your
-- Vercel Postgres doesn't have the tables yet.
--
-- WHY THIS EXISTS:
--   The Vercel build script runs `prisma generate` (creates the TypeScript
--   client) but does NOT run `prisma db push` (creates the actual DB tables).
--   So on a fresh database, the tables don't exist and step 2 of
--   rag_pgvector_setup_split.sql fails with:
--     "relation DocumentChunk does not exist"
--
--   This file creates the two RAG tables with the EXACT column names Prisma
--   expects (camelCase, quoted). Once they exist, you can run the pgvector
--   setup SQL as normal.
--
-- HOW TO USE:
--   Paste EACH statement below ONE AT A TIME into Vercel → Storage → your
--   Postgres → Query. Wait for "Success" before the next.
--
--   After both tables exist, continue with prisma/sql/rag_pgvector_setup_split.sql
--   (statements 1-9 + verification).
-- =============================================================================


-- =========================================================================
-- BEGIN STATEMENT 1 — Create DocumentChunk table
-- =========================================================================
-- Column names are quoted camelCase to match Prisma's schema.prisma exactly
-- (no @map renames). The `embedding` column is created here WITHOUT a type
-- because pgvector isn't enabled yet — step 1 of rag_pgvector_setup_split.sql
-- enables the extension, then step 2 adds the vector(768) type. We use
-- `text` as a placeholder type that step 2 will ALTER to vector(768).
--
-- Actually, cleaner approach: create the table WITHOUT the embedding column
-- here. Step 2 of rag_pgvector_setup_split.sql adds it via ALTER TABLE
-- (which is exactly what that step does). This avoids a type mismatch.
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
);
-- END STATEMENT 1
-- Expected: "Success" / "CREATE TABLE".


-- =========================================================================
-- BEGIN STATEMENT 2 — Create indexes on DocumentChunk
-- =========================================================================
-- These match the @@index declarations in schema.prisma.
CREATE INDEX IF NOT EXISTS "DocumentChunk_organizationId_matterId_idx"
    ON "DocumentChunk"("organizationId", "matterId");

CREATE INDEX IF NOT EXISTS "DocumentChunk_organizationId_documentId_idx"
    ON "DocumentChunk"("organizationId", "documentId");

CREATE INDEX IF NOT EXISTS "DocumentChunk_organizationId_transcriptId_idx"
    ON "DocumentChunk"("organizationId", "transcriptId");
-- END STATEMENT 2
-- Expected: "Success" / "CREATE INDEX" (x3 — paste all three lines together,
-- Vercel Query treats them as separate statements only if you run them
-- separately. If it errors, paste each CREATE INDEX line individually).


-- =========================================================================
-- BEGIN STATEMENT 3 — Create LegalCorpus table
-- =========================================================================
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
);
-- END STATEMENT 3
-- Expected: "Success" / "CREATE TABLE".


-- =========================================================================
-- BEGIN STATEMENT 4 — Create unique constraint + index on LegalCorpus
-- =========================================================================
-- Matches @@unique([lawName, articleNumber]) and @@index([lawType]).
CREATE UNIQUE INDEX IF NOT EXISTS "LegalCorpus_lawName_articleNumber_key"
    ON "LegalCorpus"("lawName", "articleNumber");

CREATE INDEX IF NOT EXISTS "LegalCorpus_lawType_idx"
    ON "LegalCorpus"("lawType");
-- END STATEMENT 4
-- Expected: "Success" / "CREATE INDEX" (x2).


-- =========================================================================
-- VERIFICATION — paste this to confirm both tables exist
-- =========================================================================
-- SELECT tablename FROM pg_tables WHERE tablename IN ('DocumentChunk', 'LegalCorpus');
-- Expected: 2 rows.


-- =========================================================================
-- WHAT TO DO NEXT
-- =========================================================================
-- 1. Run prisma/sql/rag_pgvector_setup_split.sql statements 1-9.
--    Statement 2 of THAT file will ALTER TABLE ... ADD COLUMN embedding vector(768)
--    to both tables (the column we intentionally omitted here).
-- 2. Run the verification query at the bottom of that file.
-- 3. Seed the corpus via the browser seed button (see README Step 3).
