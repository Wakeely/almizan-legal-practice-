-- =============================================================================
-- Al Mizan — Migration 0001: PlatformAdmin + Organization.status + AuditLog nullable orgId
-- -----------------------------------------------------------------------------
-- PRD v0.3 (Aug 8, 2026). All changes are ADDITIVE — no existing column is
-- removed or retyped. Safe to run on a populated database.
--
-- This migration is reference SQL for environments that use `prisma migrate`.
-- The primary sync path in this repo is `prisma db push` (see package.json
-- `build` and `db:push` scripts), which reads schema.prisma directly.
--
-- Chunked to match the 0000_init pattern:
--   chunk-1-tables.sql   — new table + ALTER TABLE column adds
--   chunk-2-indexes.sql  — new indexes
--   chunk-3-foreign-keys.sql — new FK constraints
-- =============================================================================

\i chunk-1-tables.sql
\i chunk-2-indexes.sql
\i chunk-3-foreign-keys.sql
