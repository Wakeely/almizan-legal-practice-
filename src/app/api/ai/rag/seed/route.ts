// =============================================================================
// POST /api/ai/rag/seed — TEMPORARY admin-only Jordan corpus seeder
// -----------------------------------------------------------------------------
// This endpoint exists so non-developers can seed the Jordanian legal corpus
// from the browser WITHOUT a terminal. It does the same thing as
// `bun run rag:seed` but runs inside the Next.js runtime.
//
// SECURITY:
//   - Requires the Managing Partner role (the only role that can view audit
//     logs in this app — the most privileged role).
//   - Requires RAG_SEED_ENABLED=1 in the environment. This is a kill-switch:
//     after you've seeded once, unset the env var (or set it to 0) and the
//     endpoint returns 403 even for Managing Partners. This prevents anyone
//     from accidentally re-running an expensive embedding pass.
//   - Audit-logged as ai.rag.seed with the count of articles processed.
//   - Does NOT accept any body — the corpus source is the committed
//     data/jordanian-corpus.ts file, not user input. No injection surface.
//
// IDEMPOTENT: upserts by (lawName, articleNumber). Safe to re-run; existing
// articles get their content + embedding refreshed, new articles are inserted.
//
// HOW TO USE (no terminal):
//   1. In Vercel → Project → Settings → Environment Variables, add:
//        RAG_SEED_ENABLED = 1
//      (and make sure GEMINI_API_KEY is also set, on the server, not in client
//       code — it already is, because src/lib/gemini.ts reads it server-side.)
//   2. Redeploy (or just wait for Vercel to pick up the env var if you set it
//      on Production environment).
//   3. Log in as a Managing Partner, open any matter, go to the AI module →
//      "Ask with Sources" tab. You'll see a small "Seed Jordan corpus" button.
//   4. Click it. Wait ~30-60 seconds (it embeds 31 articles via Gemini).
//   5. The response tells you how many articles were inserted + embedded.
//   6. After it succeeds, go back to Vercel env vars and either DELETE
//      RAG_SEED_ENABLED or set it to 0, then redeploy. The button disappears.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/org";
import { audit } from "@/lib/audit";
import { JORDANIAN_CORPUS, CORPUS_STATS } from "@/data/jordanian-corpus";
import { generateEmbedding, toVectorLiteral } from "@/lib/rag/embed";

export async function POST(req: Request) {
  // 1. Auth — Managing Partner only.
  //    Accept both forms because the codebase is inconsistent: the Prisma
  //    schema defaults to "MANAGING_PARTNER" (underscore) but the register
  //    route writes "Managing Partner" (spaced). Both are the same role.
  const r = await requireRole(["Managing Partner"]);
  if (r.ok === false) return r.response;

  // 2. Kill-switch — env flag must be explicitly set to "1".
  //    This is separate from the role check so you can disable the endpoint
  //    without changing code. After seeding, unset RAG_SEED_ENABLED and the
  //    endpoint becomes a 403 even for Managing Partners.
  if (process.env.RAG_SEED_ENABLED !== "1") {
    return NextResponse.json(
      {
        error:
          "Seed endpoint is disabled. Set RAG_SEED_ENABLED=1 in Vercel environment variables to enable it, then redeploy. After seeding, unset it to lock the endpoint down.",
      },
      { status: 403 },
    );
  }

  // 3. Verify Gemini key is configured — embedding will silently return null
  //    otherwise and we'd insert rows with no vectors (text-search only).
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY is not set on the server. Add it to Vercel environment variables (Production) and redeploy before seeding.",
      },
      { status: 500 },
    );
  }

  let inserted = 0;
  let updated = 0;
  let embeddingsWritten = 0;
  let embeddingErrors = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  for (const article of JORDANIAN_CORPUS) {
    try {
      // Upsert by (lawName, articleNumber) — the unique constraint.
      const before = await db.legalCorpus.findUnique({
        where: {
          lawName_articleNumber: {
            lawName: article.lawName,
            articleNumber: article.articleNumber,
          },
        },
        select: { id: true, createdAt: true, updatedAt: true },
      });

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

      if (before && before.createdAt.getTime() !== before.updatedAt.getTime()) {
        updated++;
      } else if (before) {
        // existed but hadn't been updated — treat as update for stats
        updated++;
      } else {
        inserted++;
      }

      // Embed + write vector via raw SQL (Prisma can't write Unsupported("vector")).
      const embResult = await generateEmbedding(
        `${article.lawName} — المادة ${article.articleNumber}\n${article.title ?? ""}\n${article.content}`,
      );
      if (!embResult.values) {
        embeddingErrors++;
        if (errorDetails.length < 5) {
          errorDetails.push(`${article.lawName} م${article.articleNumber}: ${embResult.error ?? "embedding failed"}`);
        }
        continue;
      }
      const literal = toVectorLiteral(embResult.values);
      if (!literal) {
        embeddingErrors++;
        continue;
      }
      try {
        await db.$executeRaw`
          UPDATE "LegalCorpus"
          SET embedding = ${literal}::vector
          WHERE id = ${row.id}
        `;
        embeddingsWritten++;
      } catch (err: any) {
        embeddingErrors++;
        if (errorDetails.length < 5) {
          errorDetails.push(
            `${article.lawName} م${article.articleNumber}: ${err?.message ?? "embedding write failed"}`,
          );
        }
      }
    } catch (err: any) {
      errors++;
      if (errorDetails.length < 5) {
        errorDetails.push(
          `${article.lawName} م${article.articleNumber}: ${err?.message ?? "unknown error"}`,
        );
      }
    }
  }

  await audit({
    action: "ai.rag.seed",
    entity: "legalCorpus",
    entityId: "global",
    details: {
      inserted,
      updated,
      embeddingsWritten,
      embeddingErrors,
      errors,
      totalArticles: JORDANIAN_CORPUS.length,
      byUserId: r.session.id,
    },
  }, req);

  return NextResponse.json({
    ok: true,
    summary: {
      totalArticles: JORDANIAN_CORPUS.length,
      inserted,
      updated,
      embeddingsWritten,
      embeddingErrors,
      errors,
    },
    byType: CORPUS_STATS,
    errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
    nextStep:
      "If embeddingsWritten === totalArticles, you're done. Go to Vercel → Settings → Environment Variables and set RAG_SEED_ENABLED=0 (or delete it), then redeploy to lock this endpoint down.",
  });
}

// GET — returns whether the seed endpoint is enabled + current corpus count.
// Useful for the UI to decide whether to show the seed button.
export async function GET(req: Request) {
  const r = await requireRole(["Managing Partner"]);
  if (r.ok === false) return r.response;

  let count = 0;
  let withEmbeddings = 0;
  try {
    count = await db.legalCorpus.count();
    // Count rows with non-null embedding. We can't use Prisma (Unsupported
    // type), so raw SQL. On SQLite dev the embedding column doesn't exist —
    // the try/catch returns 0 for withEmbeddings, which is correct.
    try {
      const rows = (await db.$queryRaw`
        SELECT COUNT(*)::int AS n FROM "LegalCorpus" WHERE embedding IS NOT NULL
      `) as Array<{ n: number }>;
      withEmbeddings = rows[0]?.n ?? 0;
    } catch {
      withEmbeddings = 0;
    }
  } catch {
    count = 0;
  }

  return NextResponse.json({
    enabled: process.env.RAG_SEED_ENABLED === "1",
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    corpusCount: count,
    withEmbeddings,
  });
}
