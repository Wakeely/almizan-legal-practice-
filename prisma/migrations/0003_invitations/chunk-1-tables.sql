-- =============================================================================
-- 0003 chunk-1: New table + ALTER TABLE column adds
-- =============================================================================

-- ── Invitation table (PRD v0.6 §5.1) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Invitation" (
    "id"              TEXT NOT NULL,
    "organizationId"  TEXT NOT NULL,
    "email"           TEXT NOT NULL,
    "role"            TEXT NOT NULL,
    "matterId"        TEXT,
    "tokenHash"       TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'pending',
    "expiresAt"       TIMESTAMP(3) NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt"      TIMESTAMP(3),

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- ── Organization: add maxSeats (PRD v0.6 §5.4) ────────────────────────────
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "maxSeats" INTEGER NOT NULL DEFAULT 10;

-- ── User: add primaryMatterId (PRD v0.6 §5.1) ────────────────────────────
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "primaryMatterId" TEXT;
