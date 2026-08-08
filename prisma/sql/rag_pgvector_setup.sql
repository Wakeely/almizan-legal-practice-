-- =============================================================================
-- Al Mizan — pgvector setup for Legal RAG
-- -----------------------------------------------------------------------------
-- Run this ONCE against your Postgres (Vercel Postgres / Neon / Supabase)
-- after `prisma db push` has created the DocumentChunk and LegalCorpus tables.
--
--   psql "$DATABASE_URL" -f prisma/sql/rag_pgvector_setup.sql
--
-- What this does:
--   1. Enables the pgvector extension.
--   2. Adds an `embedding vector(768)` column to DocumentChunk and LegalCorpus
--      (only if missing — re-running is safe).
--   3. Creates HNSW indexes for fast cosine similarity search.
--   4. Defines match_document_chunks() and match_legal_corpus() helper funcs.
--
-- SQLite dev does NOT need this — the dev schema omits the embedding column
-- and retrieve.ts falls back to text search.
-- =============================================================================

-- 1. pgvector extension (idempotent on PG 13+)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding columns (idempotent via DO block)
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

-- 3. HNSW indexes for cosine similarity (the <=> operator).
--    HNSW gives sub-linear approximate NN search; perfect for legal RAG.
--    Drop-if-exists keeps the script idempotent.
DROP INDEX IF EXISTS "DocumentChunk_embedding_hnsw";
CREATE INDEX "DocumentChunk_embedding_hnsw"
  ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

DROP INDEX IF EXISTS "LegalCorpus_embedding_hnsw";
CREATE INDEX "LegalCorpus_embedding_hnsw"
  ON "LegalCorpus" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4a. match_document_chunks — org + matter scoped similarity search.
--     SECURITY: "organizationId" and "matterId" are MANDATORY filters. There
--     is no overload that returns cross-org chunks. This is the only
--     sanctioned path to read matter chunks by similarity.
--
--     IMPORTANT: Prisma creates columns with the EXACT camelCase names declared
--     in schema.prisma (no @map), so on Postgres the columns are literally
--     "organizationId", "matterId", "documentId", etc. We MUST quote them —
--     unquoted identifiers fold to lowercase in Postgres and would not match.
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

-- 4b. match_legal_corpus — global Jordanian corpus search (read-only shared).
--     Same camelCase column quoting as match_document_chunks above.
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

-- 5. Helper: upsert a chunk's embedding by id (used by ingest.ts).
--    We expose this because Prisma cannot write Unsupported("vector") columns
--    directly, so we round-trip through raw SQL with explicit ::vector cast.
CREATE OR REPLACE FUNCTION set_document_chunk_embedding(
  chunk_id text,
  new_embedding vector(768)
)
RETURNS void
LANGUAGE sql AS $$
  UPDATE "DocumentChunk" SET embedding = new_embedding WHERE id = chunk_id;
$$;

CREATE OR REPLACE FUNCTION set_legal_corpus_embedding(
  corpus_id text,
  new_embedding vector(768)
)
RETURNS void
LANGUAGE sql AS $$
  UPDATE "LegalCorpus" SET embedding = new_embedding WHERE id = corpus_id;
$$;
