-- =============================================================================
-- 0001 chunk-2: Indexes
-- =============================================================================

-- PlatformAdmin — email is already unique-indexed in chunk-1.

-- AuditLog — new indexes for the platform-wide read view (PRD v0.3 §6).
-- The existing (organizationId, createdAt) and (userId) indexes from 0000_init
-- remain; the orgId index still works for null lookups but we add explicit
-- indexes for the new query patterns.
CREATE INDEX IF NOT EXISTS "AuditLog_platformAdminId_createdAt_idx"
    ON "AuditLog"("platformAdminId", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_actorType_idx"
    ON "AuditLog"("actorType");

-- Organization — index status for the admin list view's status filter.
CREATE INDEX IF NOT EXISTS "Organization_status_idx"
    ON "Organization"("status");
