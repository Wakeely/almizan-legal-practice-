// =============================================================================
// Al Mizan — safe Prisma db push wrapper for Vercel builds
// -----------------------------------------------------------------------------
// Runs `prisma db push` against the production schema. If it fails (e.g.
// PRISMA_DATABASE_URL not set, DB unreachable, pgvector extension missing),
// we log a warning but exit 0 so the Next.js build still succeeds. The RAG
// feature will degrade to text-search mode until the tables exist; the user
// can create them manually via prisma/sql/create_rag_tables.sql.
//
// This is the right tradeoff for a no-terminal deployment: a failed DB push
// should NOT break the entire site deploy.
// =============================================================================

const { execSync } = require("child_process");

try {
  console.log("[build] running prisma db push (production schema)...");
  execSync(
    "npx prisma db push --accept-data-loss --schema=prisma/schema.prisma --skip-generate",
    { stdio: "inherit" },
  );
  console.log("[build] prisma db push succeeded ✓");
} catch (err) {
  console.warn("");
  console.warn("============================================================");
  console.warn("[build] prisma db push FAILED — continuing anyway.");
  console.warn("[build] The app will still build and deploy, but RAG tables");
  console.warn("[build] (DocumentChunk, LegalCorpus) may not exist in the DB.");
  console.warn("[build]");
  console.warn("[build] To fix: either");
  console.warn("[build]   1. Set PRISMA_DATABASE_URL (the DIRECT connection string)");
  console.warn("[build]      in Vercel → Settings → Environment Variables, then");
  console.warn("[build]      redeploy. The next build will create the tables.");
  console.warn("[build] OR");
  console.warn("[build]   2. Paste prisma/sql/create_rag_tables.sql into Vercel");
  console.warn("[build]      → Storage → Postgres → Query (one statement at a time).");
  console.warn("============================================================");
  console.warn("");
  // Exit 0 so the build continues. The app runs fine without RAG tables —
  // retrieval just returns empty results until they exist.
  process.exit(0);
}
