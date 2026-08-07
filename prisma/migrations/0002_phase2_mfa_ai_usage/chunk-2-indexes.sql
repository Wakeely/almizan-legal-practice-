-- =============================================================================
-- 0002 chunk-2: Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS "PlatformAdminRecoveryCode_platformAdminId_idx"
    ON "PlatformAdminRecoveryCode"("platformAdminId");

CREATE INDEX IF NOT EXISTS "AiUsageLog_organizationId_createdAt_idx"
    ON "AiUsageLog"("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "AiUsageLog_provider_createdAt_idx"
    ON "AiUsageLog"("provider", "createdAt");

CREATE INDEX IF NOT EXISTS "AiUsageLog_createdAt_idx"
    ON "AiUsageLog"("createdAt");
