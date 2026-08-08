-- =============================================================================
-- 0004 chunk-3: Backfill — every existing Matter gets at least one assignment
-- -----------------------------------------------------------------------------
-- PRD v0.7 Fix 2: "Every matter must end up with at least one assigned
-- attorney after migration, or the invite-permission check will lock everyone
-- out of matters that predate this change."
--
-- Strategy: for each Matter, find the org's Managing Partner(s) and create a
-- MatterAssignment row. If the org has no Managing Partner (edge case —
-- shouldn't happen but is possible if the MP was soft-deleted), the matter
-- ends up with zero assignments and the owner-override in the invite check
-- (Managing Partner can always invite) won't apply because there IS no MP.
-- The platform admin would need to assign someone manually via the UI.
--
-- Uses INSERT ... SELECT ... to create one row per (matter, managing-partner)
-- pair. The ON CONFLICT clause handles the unique constraint in case this
-- migration is re-run.
-- =============================================================================

INSERT INTO "MatterAssignment" ("id", "matterId", "userId", "role", "createdAt")
SELECT
  CONCAT('ma_backfill_', m."id", '_', u."id") AS id,
  m."id" AS matterId,
  u."id" AS userId,
  'lead' AS role,
  NOW() AS createdAt
FROM "Matter" m
JOIN "User" u ON u."organizationId" = m."organizationId"
  AND u."role" = 'Managing Partner'
  AND u."deletedAt" IS NULL
WHERE m."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "MatterAssignment" ma WHERE ma."matterId" = m."id"
  )
ON CONFLICT ("matterId", "userId") DO NOTHING;
