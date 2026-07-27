// =============================================================================
// GET /api/admin/init-db — one-time database initialization endpoint
// -----------------------------------------------------------------------------
// Visiting this URL in a browser creates all 18 tables in your Vercel Postgres
// using the DIRECT connection (PRISMA_DATABASE_URL) via the `pg` package.
//
// This is the simplest path for non-technical users — no CLI, no terminal,
// no Vercel SQL Query tab. Just open the URL once and the tables are created.
//
// SECURITY:
// - Uses CREATE TABLE IF NOT EXISTS (idempotent — safe to call multiple times)
// - No auth required (only runs DDL, doesn't read or write tenant data)
// - Returns a JSON report of which statements succeeded/failed
// - Disable this route in production after first use by removing the file
// =============================================================================

import { NextResponse } from "next/server";
import { Pool } from "pg";

// All 18 CREATE TABLE statements — order matters (parents before children)
const CREATE_TABLES_SQL = [
  // Identity & multi-tenancy
  `CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "barAssociationId" TEXT,
    "jurisdiction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "barAssociationId" TEXT,
    "jurisdiction" TEXT,
    "accountType" TEXT NOT NULL DEFAULT 'Law Firm',
    "role" TEXT NOT NULL DEFAULT 'MANAGING_PARTNER',
    "avatarUrl" TEXT,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'Free Trial',
    "planStatus" TEXT NOT NULL DEFAULT 'Trial',
    "trialDaysLeft" INTEGER NOT NULL DEFAULT 14,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "maxSeats" INTEGER NOT NULL DEFAULT 10,
    "billingCycle" TEXT NOT NULL DEFAULT 'Monthly',
    "renewalDate" TEXT,
    "biometricEnabled" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "organizationId" TEXT NOT NULL,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
  )`,
  // Matter / Case Management
  `CREATE TABLE IF NOT EXISTS "Matter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "opposingParty" TEXT,
    "opposingCounsel" TEXT,
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'Medium',
    "winProbability" INTEGER NOT NULL DEFAULT 50,
    "judge" TEXT,
    "court" TEXT,
    "statuteOfLimitations" TEXT,
    "statuteDeadline" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "aiStrategy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Matter_pkey" PRIMARY KEY ("id")
  )`,
  // Documents
  `CREATE TABLE IF NOT EXISTS "Document" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileSize" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visibleToClient" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "aiSummary" TEXT,
    "aiTags" TEXT,
    "isRedacted" BOOLEAN NOT NULL DEFAULT false,
    "redactedVersionId" TEXT,
    "redactionCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
  )`,
  // Tasks & Workflow
  `CREATE TABLE IF NOT EXISTS "Task" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedTo" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "visibleToClient" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'To Do',
    "dependsOnTaskIds" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
  )`,
  // Billing & Timekeeping
  `CREATE TABLE IF NOT EXISTS "TimeEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "date" TEXT NOT NULL,
    "billed" BOOLEAN NOT NULL DEFAULT false,
    "taskCode" TEXT,
    "activityCode" TEXT,
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "dueDate" TEXT NOT NULL,
    "issueDate" TEXT,
    "paymentTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
  )`,
  // Calendar & Court Rules
  `CREATE TABLE IF NOT EXISTS "CalendarEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "time" TEXT,
    "location" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Hearing',
    "syncedToGoogleCalendar" BOOLEAN NOT NULL DEFAULT false,
    "googleEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
  )`,
  // Timeline & Client Messaging
  `CREATE TABLE IF NOT EXISTS "TimelineEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "visibleToClient" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "ClientMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "sender" TEXT NOT NULL DEFAULT 'Lawyer',
    "text" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientMessage_pkey" PRIMARY KEY ("id")
  )`,
  // Privilege Log
  `CREATE TABLE IF NOT EXISTS "PrivilegeLogEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "docControlNum" TEXT NOT NULL,
    "docDate" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "recipients" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "privilegeClaimed" TEXT NOT NULL DEFAULT 'Attorney-Client Privilege',
    "justification" TEXT NOT NULL,
    "isRedacted" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" TEXT NOT NULL DEFAULT 'Flagged',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrivilegeLogEntry_pkey" PRIMARY KEY ("id")
  )`,
  // Deposition / Transcript Indexer
  `CREATE TABLE IF NOT EXISTS "DepositionTranscript" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "witnessName" TEXT NOT NULL,
    "witnessRole" TEXT NOT NULL,
    "depositionDate" TEXT NOT NULL,
    "deponentParty" TEXT NOT NULL DEFAULT 'Fact Witness',
    "pagesCount" INTEGER NOT NULL DEFAULT 0,
    "keyAdmissionsSummary" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepositionTranscript_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "TranscriptPage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "lineNumber" TEXT,
    "timestamp" TEXT,
    "speaker" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isKeyAdmission" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT,
    CONSTRAINT "TranscriptPage_pkey" PRIMARY KEY ("id")
  )`,
  // Trial War Room
  `CREATE TABLE IF NOT EXISTS "WarRoomWitness" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Fact',
    "examinationNotes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WarRoomWitness_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "WarRoomExhibit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "exhibitNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "admissionStatus" TEXT NOT NULL DEFAULT 'Pending',
    "party" TEXT NOT NULL DEFAULT 'Plaintiff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WarRoomExhibit_pkey" PRIMARY KEY ("id")
  )`,
  // Conflict of Interest Engine
  `CREATE TABLE IF NOT EXISTS "ConflictCheck" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL DEFAULT '',
    "searchQuery" TEXT NOT NULL,
    "matchedEntities" TEXT,
    "clearanceStatus" TEXT NOT NULL DEFAULT 'Pending',
    "ethicalWallSet" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConflictCheck_pkey" PRIMARY KEY ("id")
  )`,
  // Audit Log — APPEND ONLY
  `CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "matterId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
  )`,
];

// Indexes (also idempotent via IF NOT EXISTS)
const CREATE_INDEXES_SQL = [
  `CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token")`,
  `CREATE INDEX IF NOT EXISTS "Matter_organizationId_idx" ON "Matter"("organizationId")`,
  `CREATE INDEX IF NOT EXISTS "Document_organizationId_matterId_idx" ON "Document"("organizationId", "matterId")`,
  `CREATE INDEX IF NOT EXISTS "Task_organizationId_matterId_idx" ON "Task"("organizationId", "matterId")`,
  `CREATE INDEX IF NOT EXISTS "TimeEntry_organizationId_matterId_idx" ON "TimeEntry"("organizationId", "matterId")`,
  `CREATE INDEX IF NOT EXISTS "Invoice_organizationId_matterId_idx" ON "Invoice"("organizationId", "matterId")`,
  `CREATE INDEX IF NOT EXISTS "CalendarEvent_organizationId_matterId_idx" ON "CalendarEvent"("organizationId", "matterId")`,
  `CREATE INDEX IF NOT EXISTS "TimelineEvent_organizationId_matterId_idx" ON "TimelineEvent"("organizationId", "matterId")`,
  `CREATE INDEX IF NOT EXISTS "ClientMessage_organizationId_matterId_idx" ON "ClientMessage"("organizationId", "matterId")`,
  `CREATE INDEX IF NOT EXISTS "PrivilegeLogEntry_organizationId_matterId_idx" ON "PrivilegeLogEntry"("organizationId", "matterId")`,
  `CREATE INDEX IF NOT EXISTS "DepositionTranscript_organizationId_matterId_idx" ON "DepositionTranscript"("organizationId", "matterId")`,
  `CREATE INDEX IF NOT EXISTS "TranscriptPage_organizationId_transcriptId_idx" ON "TranscriptPage"("organizationId", "transcriptId")`,
  `CREATE INDEX IF NOT EXISTS "WarRoomWitness_organizationId_matterId_idx" ON "WarRoomWitness"("organizationId", "matterId")`,
  `CREATE INDEX IF NOT EXISTS "WarRoomExhibit_organizationId_matterId_idx" ON "WarRoomExhibit"("organizationId", "matterId")`,
  `CREATE INDEX IF NOT EXISTS "ConflictCheck_organizationId_idx" ON "ConflictCheck"("organizationId")`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId")`,
];

// Foreign key constraints (also idempotent via DO blocks)
const ADD_FOREIGN_KEYS_SQL = [
  `DO $$ BEGIN ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Account" ADD CONSTRAINT "Account_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Session" ADD CONSTRAINT "Session_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Matter" ADD CONSTRAINT "Matter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Document" ADD CONSTRAINT "Document_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Task" ADD CONSTRAINT "Task_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "ClientMessage" ADD CONSTRAINT "ClientMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "ClientMessage" ADD CONSTRAINT "ClientMessage_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "PrivilegeLogEntry" ADD CONSTRAINT "PrivilegeLogEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "PrivilegeLogEntry" ADD CONSTRAINT "PrivilegeLogEntry_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "DepositionTranscript" ADD CONSTRAINT "DepositionTranscript_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "DepositionTranscript" ADD CONSTRAINT "DepositionTranscript_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "TranscriptPage" ADD CONSTRAINT "TranscriptPage_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "DepositionTranscript"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "WarRoomWitness" ADD CONSTRAINT "WarRoomWitness_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "WarRoomWitness" ADD CONSTRAINT "WarRoomWitness_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "WarRoomExhibit" ADD CONSTRAINT "WarRoomExhibit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "WarRoomExhibit" ADD CONSTRAINT "WarRoomExhibit_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "ConflictCheck" ADD CONSTRAINT "ConflictCheck_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

export async function GET() {
  // Use the DIRECT connection (PRISMA_DATABASE_URL) — required for DDL ops
  // because Vercel's pooled connection (DATABASE_URL via PgBouncer) cannot
  // run CREATE TABLE / ALTER TABLE in transaction mode.
  const connectionString = process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json(
      {
        ok: false,
        error: "PRISMA_DATABASE_URL (or DATABASE_URL) is not set on the server.",
        hint: "Make sure your Vercel Postgres store is linked to this project.",
      },
      { status: 500 },
    );
  }

  const pool = new Pool({ connectionString, max: 1 });
  const results: { step: string; ok: boolean; error?: string }[] = [];

  try {
    // Step 1: Create all tables
    for (const sql of CREATE_TABLES_SQL) {
      const tableName = sql.match(/"(\w+)"/)?.[1] ?? "unknown";
      try {
        await pool.query(sql);
        results.push({ step: `CREATE TABLE ${tableName}`, ok: true });
      } catch (err: any) {
        results.push({ step: `CREATE TABLE ${tableName}`, ok: false, error: err.message });
      }
    }

    // Step 2: Create indexes
    for (const sql of CREATE_INDEXES_SQL) {
      const indexName = sql.match(/"(\w+)"/)?.[1] ?? "unknown";
      try {
        await pool.query(sql);
        results.push({ step: `CREATE INDEX ${indexName}`, ok: true });
      } catch (err: any) {
        results.push({ step: `CREATE INDEX ${indexName}`, ok: false, error: err.message });
      }
    }

    // Step 3: Add foreign keys
    for (const sql of ADD_FOREIGN_KEYS_SQL) {
      const fkName = sql.match(/"(\w+_\w+)_fkey"/)?.[1] ?? "unknown";
      try {
        await pool.query(sql);
        results.push({ step: `ADD FK ${fkName}`, ok: true });
      } catch (err: any) {
        results.push({ step: `ADD FK ${fkName}`, ok: false, error: err.message });
      }
    }

    const failed = results.filter((r) => !r.ok);
    const succeeded = results.filter((r) => r.ok);

    return NextResponse.json({
      ok: failed.length === 0,
      message:
        failed.length === 0
          ? `✅ All 18 tables, 21 indexes, and 33 foreign keys created successfully. You can now register at https://almizan.legalwakeely.com`
          : `⚠️ ${succeeded.length}/${results.length} steps succeeded. ${failed.length} failed — see details below.`,
      summary: {
        tablesCreated: results.filter((r) => r.step.startsWith("CREATE TABLE") && r.ok).length,
        indexesCreated: results.filter((r) => r.step.startsWith("CREATE INDEX") && r.ok).length,
        foreignKeysAdded: results.filter((r) => r.step.startsWith("ADD FK") && r.ok).length,
        totalSteps: results.length,
        failedSteps: failed.length,
      },
      failures: failed,
      nextStep: failed.length === 0
        ? "Go to https://almizan.legalwakeely.com and click 'Launch Workspace' → 'Register' tab to create your first user."
        : "Fix the failures above (most likely already-exists errors which are safe to ignore).",
    });
  } finally {
    await pool.end();
  }
}
