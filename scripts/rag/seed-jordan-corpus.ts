// =============================================================================
// Al Mizan — Jordanian Legal Corpus seed script
// -----------------------------------------------------------------------------
// Embeds each article in data/jordanian-corpus.ts and upserts it into the
// LegalCorpus table. Idempotent — re-running updates content + embeddings for
// existing articles (matched on lawName + articleNumber).
//
// Usage (from project root):
//   bun run scripts/rag/seed-jordan-corpus.ts
//   # or: npx tsx scripts/rag/seed-jordan-corpus.ts
//
// Requires:
//   - DATABASE_URL pointing at a Postgres with pgvector set up
//     (run prisma/sql/rag_pgvector_setup.sql first)
//   - GEMINI_API_KEY in the environment
//
// On SQLite dev: the script still inserts article rows (text-only); embeddings
// are skipped because the embedding column doesn't exist. This lets you test
// the text-search retrieval path locally without a Postgres + pgvector setup.
// =============================================================================

import { PrismaClient } from "@prisma/client";
import { JORDANIAN_CORPUS, CORPUS_STATS } from "../../src/data/jordanian-corpus";
import { generateEmbedding, toVectorLiteral } from "../../src/lib/rag/embed";

// Use a standalone Prisma client (not the shared one) so this script can be
// run outside the Next.js runtime. The shared src/lib/db.ts uses the global
// singleton which is fine in dev but can hold stale connections in scripts.
const db = new PrismaClient();

async function main() {
  console.log("\n=== Al Mizan — Jordanian Legal Corpus Seed ===\n");
  console.log(`Articles to seed: ${JORDANIAN_CORPUS.length}`);
  console.log("By type:", CORPUS_STATS);
  console.log("");

  let inserted = 0;
  let updated = 0;
  let embeddingWritten = 0;
  let embeddingSkipped = false;
  let errors = 0;

  for (const article of JORDANIAN_CORPUS) {
    try {
      // Upsert by (lawName, articleNumber) — the unique constraint.
      const row = await db.legalCorpus.upsert({
        where: {
          lawName_articleNumber: {
            lawName: article.lawName,
            articleNumber: article.articleNumber,
          },
        },
        create: {
          lawName: article.lawName,
          lawType: article.lawType,
          articleNumber: article.articleNumber,
          title: article.title ?? null,
          content: article.content,
          year: article.year ?? null,
          sourceUrl: article.sourceUrl ?? null,
        },
        update: {
          lawType: article.lawType,
          title: article.title ?? null,
          content: article.content,
          year: article.year ?? null,
          sourceUrl: article.sourceUrl ?? null,
        },
      });

      // Track create vs update for logging.
      const existing = await db.legalCorpus.count({
        where: { id: row.id },
      });
      if (existing > 0) {
        // We can't easily tell create vs update from upsert result; approximate
        // by checking createdAt vs updatedAt.
        if (row.createdAt.getTime() === row.updatedAt.getTime()) {
          inserted++;
        } else {
          updated++;
        }
      }

      // Embed + write vector.
      const embResult = await generateEmbedding(
        `${article.lawName} — المادة ${article.articleNumber}\n${article.title ?? ""}\n${article.content}`,
      );
      const literal = toVectorLiteral(embResult.values);
      if (!literal) {
        embeddingSkipped = true;
        if (embResult.error) console.warn(`  [seed] embed failed: ${embResult.error}`);
        continue;
      }
      try {
        await db.$executeRaw`
          UPDATE "LegalCorpus"
          SET embedding = ${literal}::vector
          WHERE id = ${row.id}
        `;
        embeddingWritten++;
      } catch (err: any) {
        if (!embeddingSkipped) {
          console.warn(
            `[seed] could not write embedding for ${article.lawName} م${article.articleNumber} ` +
              "(likely SQLite dev or pgvector not set up):",
            err?.message ?? err,
          );
          embeddingSkipped = true;
        }
      }

      console.log(
        `  ✓ ${article.lawName} م${article.articleNumber} (${article.lawType})`,
      );
    } catch (err: any) {
      errors++;
      console.error(
        `[seed] failed for ${article.lawName} م${article.articleNumber}:`,
        err?.message ?? err,
      );
    }
  }

  console.log("\n=== Seed complete ===");
  console.log(`  Inserted:  ${inserted}`);
  console.log(`  Updated:   ${updated}`);
  console.log(`  Embeddings written:  ${embeddingWritten}`);
  console.log(`  Embeddings skipped:  ${embeddingSkipped ? "yes (dev/text-only mode)" : "no"}`);
  console.log(`  Errors:    ${errors}`);
  if (embeddingSkipped) {
    console.log("\n  NOTE: Embeddings were skipped. This is expected on SQLite dev.");
    console.log("  Run this script against a Postgres with pgvector to enable semantic search.");
  }
  console.log("");
}

main()
  .catch((err) => {
    console.error("[seed] fatal error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
