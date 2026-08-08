-- =============================================================================
-- Al Mizan — Migration 0004: MatterAssignment (PRD v0.7 Fix 2)
-- -----------------------------------------------------------------------------
-- Additive. Creates the MatterAssignment join table + backfills one row per
-- existing Matter (assigned to that org's Managing Partner) so nothing
-- currently working breaks on deploy.
-- =============================================================================

\i chunk-1-tables.sql
\i chunk-2-indexes.sql
\i chunk-3-backfill.sql
