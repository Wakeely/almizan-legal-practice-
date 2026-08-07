-- =============================================================================
-- 0001 chunk-1: New table + ALTER TABLE column adds
-- =============================================================================

-- ── PlatformAdmin table (PRD v0.3 §1, §2) ─────────────────────────────────
-- Separate identity for the Super Admin Dashboard. NOT a tenant User.
CREATE TABLE IF NOT EXISTS "PlatformAdmin" (
    "id"                 TEXT NOT NULL,
    "email"              TEXT NOT NULL,
    "name"               TEXT NOT NULL,
    "passwordHash"       TEXT NOT NULL,
    "role"               TEXT NOT NULL DEFAULT 'super_admin',
    "mfaEnabled"         BOOLEAN NOT NULL DEFAULT false,
    "mfaSecretEncrypted" TEXT,
    "lastLoginAt"        TIMESTAMP(3),
    "lastLoginIp"        TEXT,
    "createdByBootstrap" BOOLEAN NOT NULL DEFAULT false,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformAdmin_email_key" ON "PlatformAdmin"("email");

-- ── Organization: add status / suspendedAt / suspendedReason (PRD v0.3 §7) ──
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "status"          TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "suspendedAt"     TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "suspendedReason" TEXT;

-- ── AuditLog: make organizationId nullable + add actorType / platformAdminId
-- (PRD v0.3 §6) ─────────────────────────────────────────────────────────────
-- Step 1: add the new columns (nullable so existing rows survive).
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "actorType"       TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "platformAdminId" TEXT;

-- Step 2: backfill actorType for existing rows — every existing row was
-- written by a tenant user (the platform-admin path did not exist yet).
UPDATE "AuditLog" SET "actorType" = 'tenant_user' WHERE "actorType" IS NULL;

-- Step 3: now enforce NOT NULL on actorType (safe after backfill).
ALTER TABLE "AuditLog" ALTER COLUMN "actorType" SET NOT NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "actorType" SET DEFAULT 'tenant_user';

-- Step 4: drop the NOT NULL on organizationId so platform-only actions can
-- write null. Existing rows all have non-null values — no data loss.
ALTER TABLE "AuditLog" ALTER COLUMN "organizationId" DROP NOT NULL;
