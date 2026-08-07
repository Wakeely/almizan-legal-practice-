-- =============================================================================
-- 0002 chunk-3: Foreign-key constraints
-- =============================================================================

ALTER TABLE "PlatformAdminRecoveryCode"
    ADD CONSTRAINT "PlatformAdminRecoveryCode_platformAdminId_fkey"
    FOREIGN KEY ("platformAdminId") REFERENCES "PlatformAdmin"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiUsageLog"
    ADD CONSTRAINT "AiUsageLog_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
