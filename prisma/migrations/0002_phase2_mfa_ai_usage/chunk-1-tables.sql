-- =============================================================================
-- 0002 chunk-1: New tables
-- =============================================================================

-- ── PlatformAdminRecoveryCode (Phase 2 §2.1) ──────────────────────────────
-- Single-use TOTP recovery codes. Hashed at rest (SHA-256). The plaintext is
-- shown ONCE at enrollment and never stored.
CREATE TABLE IF NOT EXISTS "PlatformAdminRecoveryCode" (
    "id"              TEXT NOT NULL,
    "platformAdminId" TEXT NOT NULL,
    "codeHash"        TEXT NOT NULL,
    "usedAt"          TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAdminRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformAdminRecoveryCode_codeHash_key"
    ON "PlatformAdminRecoveryCode"("codeHash");

-- ── AiUsageLog (Phase 2 §2.4) ──────────────────────────────────────────────
-- Per-call AI cost tracking. Written at the point where dispatchAiText()
-- returns. Best-effort, async — never blocks the AI response.
CREATE TABLE IF NOT EXISTS "AiUsageLog" (
    "id"               TEXT NOT NULL,
    "organizationId"   TEXT NOT NULL,
    "userId"           TEXT,
    "provider"         TEXT NOT NULL,
    "model"            TEXT NOT NULL,
    "feature"          TEXT,
    "tokensIn"         INTEGER NOT NULL DEFAULT 0,
    "tokensOut"        INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "keySource"        TEXT NOT NULL DEFAULT 'platform',
    "stub"             BOOLEAN NOT NULL DEFAULT false,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);
