// =============================================================================
// Al Mizan Legal Practice — runtime DB migration check
// -----------------------------------------------------------------------------
// Called on app startup to ensure the Document table has the file storage
// columns (blobUrl, fileContent, fileMimeType). If they're missing, adds them
// using a direct SQL query via the Prisma raw query interface.
//
// This is needed because:
// 1. Vercel's Postgres Query tab is read-only (can't run ALTER TABLE)
// 2. prisma db push during build may fail if PRISMA_DATABASE_URL isn't
//    available in the Build environment
// 3. The user shouldn't need to install psql or use the CLI
// =============================================================================

import { db } from "@/lib/db";

let _checked = false;

export async function ensureFileColumns(): Promise<void> {
  if (_checked) return;
  _checked = true;

  try {
    // Check if the fileContent column exists
    // Using a simple SELECT that will fail if the column doesn't exist
    await db.$queryRaw`SELECT "fileContent" FROM "Document" LIMIT 1`;
    // If we get here, the column exists — no migration needed
    return;
  } catch (err: any) {
    // Column doesn't exist — add all 3 columns
    console.log("[migration] Document.fileContent column missing — adding file storage columns...");
  }

  try {
    // Add columns using raw SQL (Prisma $executeRaw)
    // IF NOT EXISTS makes this idempotent
    await db.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "blobUrl" TEXT`);
    console.log("[migration] Added blobUrl column");
  } catch (err: any) {
    console.error("[migration] Failed to add blobUrl:", err?.message);
  }

  try {
    await db.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "fileContent" BYTEA`);
    console.log("[migration] Added fileContent column");
  } catch (err: any) {
    console.error("[migration] Failed to add fileContent:", err?.message);
  }

  try {
    await db.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "fileMimeType" TEXT`);
    console.log("[migration] Added fileMimeType column");
  } catch (err: any) {
    console.error("[migration] Failed to add fileMimeType:", err?.message);
  }
}
