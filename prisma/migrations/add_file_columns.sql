-- Add file storage columns to the Document table
-- Run this in Vercel Postgres → Query tab if the build-time prisma db push fails

ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "blobUrl" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "fileContent" BYTEA;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "fileMimeType" TEXT;
