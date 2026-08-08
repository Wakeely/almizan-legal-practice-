-- =============================================================================
-- 0003 chunk-2: Indexes + foreign keys
-- =============================================================================

-- Invitation indexes
CREATE INDEX IF NOT EXISTS "Invitation_organizationId_status_idx"
    ON "Invitation"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Invitation_email_idx"
    ON "Invitation"("email");
CREATE INDEX IF NOT EXISTS "Invitation_invitedByUserId_idx"
    ON "Invitation"("invitedByUserId");

-- Invitation → Organization FK
ALTER TABLE "Invitation"
    ADD CONSTRAINT "Invitation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
