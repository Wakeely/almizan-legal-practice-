-- =============================================================================
-- 0004 chunk-2: Indexes + foreign keys
-- =============================================================================

CREATE INDEX IF NOT EXISTS "MatterAssignment_matterId_idx"
    ON "MatterAssignment"("matterId");

CREATE INDEX IF NOT EXISTS "MatterAssignment_userId_idx"
    ON "MatterAssignment"("userId");

-- FK to Matter (CASCADE on delete — if a matter is deleted, its assignments go too)
ALTER TABLE "MatterAssignment"
    ADD CONSTRAINT "MatterAssignment_matterId_fkey"
    FOREIGN KEY ("matterId") REFERENCES "Matter"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- FK to User (CASCADE on delete — if a user is deleted, their assignments go too)
ALTER TABLE "MatterAssignment"
    ADD CONSTRAINT "MatterAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
