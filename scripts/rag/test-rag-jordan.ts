// =============================================================================
// Al Mizan — RAG Jordan corpus test script
// -----------------------------------------------------------------------------
// Runs a set of Arabic queries against the LegalCorpus retrieval pipeline and
// prints the top matches. Verifies that embedding + pgvector similarity search
// returns relevant articles.
//
// Usage (from project root):
//   bun run scripts/rag/test-rag-jordan.ts
//
// Requires:
//   - DATABASE_URL pointing at Postgres with pgvector + seeded corpus
//   - GEMINI_API_KEY in the environment
//
// If pgvector is unavailable, falls back to text search (logs a warning).
// =============================================================================

import { PrismaClient } from "@prisma/client";
import { generateEmbedding } from "../../src/lib/rag/embed";
import { matchLegalCorpus, _resetVectorAvailabilityCache } from "../../src/lib/rag/retrieve";

const db = new PrismaClient();

const TEST_QUERIES: Array<{ label: string; query: string }> = [
  {
    label: "Labour — overtime pay",
    query: "ما هو الحد الأقصى لساعات العمل الإضافي والأجر المستحق عنه؟",
  },
  {
    label: "Rent — eviction grounds",
    query: "متى يجوز للمالك إخلاء المستأجر من العقار المؤجر؟",
  },
  {
    label: "Traffic — accident liability",
    query: "من يتحمل المسؤولية المدنية عن حوادث السير؟",
  },
  {
    label: "Maintenance — wife's nafaqa",
    query: "متى تجب نفقة الزوجة على زوجها وما الذي تشمله؟",
  },
  {
    label: "Civil — tort compensation",
    query: "ما هي شروط الحكم بالتعويض عن الضرر الناشئ عن الخطأ؟",
  },
  {
    label: "Evidence — written vs oral",
    query: "هل يجوز الإثبات بشهادة الشهود في الالتزامات الكبيرة؟",
  },
  {
    label: "Procedure — appeal deadline",
    query: "ما هو ميعاد استئناف الأحكام الصادرة عن محاكم البداية؟",
  },
  {
    label: "Civil — contract binding force",
    query: "هل يجوز تعديل العقد أو فسخه بعد إبرامه؟",
  },
];

async function main() {
  console.log("\n=== Al Mizan — RAG Jordan Corpus Test ===\n");

  // Verify the corpus is seeded.
  const count = await db.legalCorpus.count();
  if (count === 0) {
    console.error(
      "LegalCorpus table is empty. Run `bun run scripts/rag/seed-jordan-corpus.ts` first.",
    );
    process.exit(1);
  }
  console.log(`Corpus size: ${count} articles\n`);

  // Reset vector availability cache so the probe runs fresh.
  _resetVectorAvailabilityCache();

  for (const tc of TEST_QUERIES) {
    console.log("─".repeat(72));
    console.log(`Query [${tc.label}]: ${tc.query}`);

    const embResult = await generateEmbedding(tc.query);
    const embedding = embResult.values;
    if (!embedding) {
      console.log(`  ⚠ No embedding — ${embResult.error ?? "unknown error"}`);
    }

    const hits = await matchLegalCorpus(embedding, 4, tc.query);
    if (hits.length === 0) {
      console.log("  (no matches)");
      continue;
    }

    for (const hit of hits) {
      const sim = hit.similarity !== undefined ? ` sim=${hit.similarity.toFixed(3)}` : "";
      const excerpt =
        hit.content.length > 140 ? hit.content.slice(0, 140) + "…" : hit.content;
      console.log(
        `  • ${hit.lawName} م${hit.articleNumber} (${hit.lawType})${sim}`,
      );
      console.log(`    ${excerpt.replace(/\n/g, " ")}`);
    }
    console.log("");
  }

  console.log("─".repeat(72));
  console.log("Test complete.\n");
}

main()
  .catch((err) => {
    console.error("[test] fatal error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
