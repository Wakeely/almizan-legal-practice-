-- =============================================================================
-- Al Mizan — Migration 0002: Phase 2 (MFA recovery codes + AiUsageLog)
-- -----------------------------------------------------------------------------
-- PRD v0.4 (Aug 8, 2026). Additive — no existing column is removed or retyped.
-- The mfaEnabled / mfaSecretEncrypted columns on PlatformAdmin already exist
-- (added in migration 0001); this migration adds the recovery-code table and
-- the AI usage log table.
-- =============================================================================

\i chunk-1-tables.sql
\i chunk-2-indexes.sql
\i chunk-3-foreign-keys.sql
