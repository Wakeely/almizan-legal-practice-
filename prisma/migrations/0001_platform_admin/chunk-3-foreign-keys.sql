-- =============================================================================
-- 0001 chunk-3: Foreign-key constraints
-- =============================================================================
-- Note: the existing AuditLog → Organization FK (from 0000_init) used
-- ON DELETE CASCADE. We are changing it to ON DELETE SET NULL because
-- organizationId is now nullable — platform-only audit entries have no org,
-- and even org-scoped entries should survive an org hard-delete (which v1
-- does not perform, but the constraint must be consistent with the column's
-- nullability). Prisma's db push will reconcile this automatically; this
-- migration does it explicitly for migrate-deploy environments.

-- Drop the old CASCADE FK on AuditLog → Organization.
ALTER TABLE "AuditLog"
    DROP CONSTRAINT IF EXISTS "AuditLog_organizationId_fkey";

-- Re-add with SET NULL to match the nullable column.
ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- New FK: AuditLog → PlatformAdmin.
ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_platformAdminId_fkey"
    FOREIGN KEY ("platformAdminId") REFERENCES "PlatformAdmin"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
