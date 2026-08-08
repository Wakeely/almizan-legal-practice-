-- =============================================================================
-- 0004 chunk-1: MatterAssignment table
-- =============================================================================

CREATE TABLE IF NOT EXISTS "MatterAssignment" (
    "id"        TEXT NOT NULL,
    "matterId"  TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "role"      TEXT NOT NULL DEFAULT 'attorney',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatterAssignment_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one assignment per (matter, user) pair
CREATE UNIQUE INDEX IF NOT EXISTS "MatterAssignment_matterId_userId_key"
    ON "MatterAssignment"("matterId", "userId");
