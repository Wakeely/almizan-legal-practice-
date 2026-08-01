-- =============================================================================
-- Al Mizan — pgvector setup for Legal RAG (SPLIT VERSION for Vercel Query UI)
-- -----------------------------------------------------------------------------
-- Vercel → Storage → Postgres → Query throws "cannot insert multiple commands
-- into a prepared statement" when you paste the whole rag_pgvector_setup.sql
-- file at once. This file is the SAME setup, split into individual statements
-- that you paste ONE AT A TIME into the Vercel Query box.
--
-- HOW TO USE:
--   1. Open Vercel → your project → Storage → Postgres → Query.
--   2. For EACH numbered block below: copy from "BEGIN STATEMENT N" to
--      "END STATEMENT N" (inclusive of the trailing semicolon), paste into
--      the Query box, click Run. Wait for "Success".
--   3. If a statement errors, STOP and read the message — most likely the
--      tables don't exist yet (run `prisma db push` first, or see the
--      table-creation SQL at the bottom of this file).
--   4. After all 11 statements succeed, run the verification query at the
--      very bottom to confirm functions exist.
--
-- PREREQUISITE: DocumentChunk and LegalCorpus tables must already exist.
--   On Vercel, `prisma db push` runs automatically during `bun run build`
--   (it's in the build script). So just deploying the app once creates them.
--   If you're unsure, paste the existence check at the bottom first.
-- =============================================================================


-- =========================================================================
-- BEGIN STATEMENT 1 — Enable pgvector extension
-- =========================================================================
CREATE EXTENSION IF NOT EXISTS vector;
-- END STATEMENT 1
-- Expected: "Success" (may take a few seconds the first time).


-- =========================================================================
-- BEGIN STATEMENT 2 — Add embedding column to DocumentChunk (if missing)
-- =========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'DocumentChunk' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE "DocumentChunk" ADD COLUMN embedding vector(768);
  END IF;
END $$;
-- END STATEMENT 2
-- Expected: "Success". If it errors with "relation DocumentChunk does not
-- exist", the tables haven't been created yet — deploy the app once so
-- `prisma db push` runs, OR run the table-creation SQL at the bottom of
-- this file first.


-- =========================================================================
-- BEGIN STATEMENT 3 — Add embedding column to LegalCorpus (if missing)
-- =========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'LegalCorpus' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE "LegalCorpus" ADD COLUMN embedding vector(768);
  END IF;
END $$;
-- END STATEMENT 3
-- Expected: "Success".


-- =========================================================================
-- BEGIN STATEMENT 4 — Create HNSW index on DocumentChunk.embedding
-- =========================================================================
DROP INDEX IF EXISTS "DocumentChunk_embedding_hnsw";
CREATE INDEX "DocumentChunk_embedding_hnsw"
  ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
-- END STATEMENT 4
-- Expected: "Success". May take a few seconds. If it errors with
-- "column embedding does not exist", go back and run statement 2 first.
-- If it errors with "extension vector does not exist" or "access to
-- extension vector is not allowed", your Vercel Postgres plan doesn't
-- support pgvector — see the note at the bottom of this file.


-- =========================================================================
-- BEGIN STATEMENT 5 — Create HNSW index on LegalCorpus.embedding
-- =========================================================================
DROP INDEX IF EXISTS "LegalCorpus_embedding_hnsw";
CREATE INDEX "LegalCorpus_embedding_hnsw"
  ON "LegalCorpus" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
-- END STATEMENT 5
-- Expected: "Success".


-- =========================================================================
-- BEGIN STATEMENT 6 — match_document_chunks function (org + matter scoped)
-- =========================================================================
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
  documentId text,
  transcriptId text,
  sourceType text,
  pageNumber int,
  chunkIndex int,
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
-- END STATEMENT 6
-- Expected: "Success" / "CREATE FUNCTION".


-- =========================================================================
-- BEGIN STATEMENT 7 — match_legal_corpus function (global corpus search)
-- =========================================================================
CREATE OR REPLACE FUNCTION match_legal_corpus(
  query_embedding vector(768),
  match_count int DEFAULT 6,
  match_threshold float DEFAULT 0.30
)
RETURNS TABLE (
  id text,
  lawName text,
  lawType text,
  articleNumber text,
  title text,
  content text,
  year int,
  sourceUrl text,
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
-- END STATEMENT 7
-- Expected: "Success" / "CREATE FUNCTION".


-- =========================================================================
-- BEGIN STATEMENT 8 — set_document_chunk_embedding helper
-- =========================================================================
CREATE OR REPLACE FUNCTION set_document_chunk_embedding(
  chunk_id text,
  new_embedding vector(768)
)
RETURNS void
LANGUAGE sql AS $$
  UPDATE "DocumentChunk" SET embedding = new_embedding WHERE id = chunk_id;
$$;
-- END STATEMENT 8
-- Expected: "Success" / "CREATE FUNCTION".


-- =========================================================================
-- BEGIN STATEMENT 9 — set_legal_corpus_embedding helper
-- =========================================================================
CREATE OR REPLACE FUNCTION set_legal_corpus_embedding(
  corpus_id text,
  new_embedding vector(768)
)
RETURNS void
LANGUAGE sql AS $$
  UPDATE "LegalCorpus" SET embedding = new_embedding WHERE id = corpus_id;
$$;
-- END STATEMENT 9
-- Expected: "Success" / "CREATE FUNCTION".


-- =========================================================================
-- VERIFICATION — paste this AFTER all 9 statements above succeed.
-- It should return 4 rows: match_document_chunks, match_legal_corpus,
-- set_document_chunk_embedding, set_legal_corpus_embedding.
-- =========================================================================
SELECT proname FROM pg_proc WHERE proname IN (
  'match_document_chunks',
  'match_legal_corpus',
  'set_document_chunk_embedding',
  'set_legal_corpus_embedding'
) ORDER BY proname;
-- Expected output: 4 rows listing the function names.


-- =========================================================================
-- EXISTENCE CHECK — run this FIRST if you're unsure whether the tables
-- exist. Should return 2 rows (DocumentChunk, LegalCorpus).
-- =========================================================================
-- SELECT tablename FROM pg_tables WHERE tablename IN ('DocumentChunk', 'LegalCorpus');
-- (uncomment and run separately if needed)


-- =========================================================================
-- NOTE: pgvector not available on your Vercel Postgres plan?
-- =========================================================================
-- Vercel Postgres supports pgvector on all current plans, but if you're on
-- an older provisioned instance you may see "extension vector does not exist".
-- Fix options:
--   1. In Vercel → Storage → your Postgres → Settings, check for a "pgvector"
--      toggle or an "Upgrade" prompt. Newer instances have it enabled by default.
--   2. If you can't enable it, the RAG system will gracefully fall back to
--      text search (keyword matching) — semantic search just won't work until
--      pgvector is available. The app will NOT crash; you'll see a "Vector
--      search unavailable — using text search" badge in the UI.
--   3. As a last resort, spin up a fresh Vercel Postgres store (the free tier
--      supports pgvector) and re-point DATABASE_URL to it.
