// =============================================================================
// Al Mizan — Self-Hosted Jordanian Law MCP Server
// -----------------------------------------------------------------------------
// This is a FULLY SELF-HOSTED MCP server that runs inside Almizan itself.
// It does NOT depend on any external hosted service — the statute data lives
// in your own LegalCorpus database table (the 31 articles seeded via
// rag:seed, extensible by adding more entries to src/data/jordanian-corpus.ts).
//
// IMPLEMENTS THE SAME 5 TOOLS as the external MCP pattern:
//   1. search_legislation     — keyword search across all articles
//   2. get_provision          — fetch verbatim text by law name + article number
//   3. validate_citation      — check if a citation string resolves to a real article
//   4. check_currency         — is the provision still in force?
//   5. build_legal_stance     — structured supporting/opposing provisions for a position
//
// PROTOCOL: accepts POST { tool, arguments } and returns { result: { ... } }.
// This is the same JSON-RPC-style protocol our adapter in
// src/lib/mcp/jordanian-law.ts expects, so the adapter works unchanged.
//
// DEPLOYMENT: runs as a Next.js API route on Vercel. No separate server,
// no Docker, no external dependency. The endpoint URL is:
//   https://almizan.legalwakeely.com/api/mcp/jordanian-law
//
// SECURITY:
//   - Server-side only (Next.js API route).
//   - No authentication required for the MCP endpoint itself (the statute
//     data is public law — not client confidential). BUT the data never
//     leaves Almizan's own infrastructure.
//   - No client matter data is stored or processed here — only public
//     legal queries (law name + article number).
//
// HOW TO EXTEND THE DATABASE:
//   Add more articles to src/data/jordanian-corpus.ts, then re-run
//   `bun run rag:seed` (or click the one-click setup button). The new
//   articles are immediately available to all MCP tools.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isVectorSearchAvailable } from "@/lib/rag/retrieve";
import { generateEmbedding } from "@/lib/rag/embed";

// ─────────────────────────────────────────────────────────────────────────
// Tool dispatcher
// ─────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tool, arguments: args } = body;

    if (!tool || typeof tool !== "string") {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Missing 'tool' field" } },
        { status: 400 },
      );
    }

    const result = await dispatchTool(tool, args ?? {});
    return NextResponse.json({ result });
  } catch (err: any) {
    console.error("[mcp/jordanian-law] error:", err?.message ?? err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: err?.message ?? "Unknown error",
        },
      },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// GET — health check / list / exists endpoints
// -----------------------------------------------------------------------------
// Supports three modes via the ?action= query parameter:
//
//   1. (no action)  → health check / server info
//      GET /api/mcp/jordanian-law
//
//   2. action=list  → clean table of all laws/articles in the database
//      GET /api/mcp/jordanian-law?action=list
//      Returns: { articles: [{ lawName, lawNameEn, articleNumber, title,
//                              status, lastUpdated, ... }] }
//
//   3. action=exists → check if a specific article exists + its status
//      GET /api/mcp/jordanian-law?action=exists&law=...&article=...
//      Returns: { exists, status, superseded, provision, message }
// ─────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  // ── action=list: return a clean table of all articles ──────────────────
  if (action === "list") {
    try {
      const articles = await db.legalCorpus.findMany({
        orderBy: [{ lawName: "asc" }, { articleNumber: "asc" }],
        select: {
          id: true,
          lawName: true,
          lawNameEn: true,
          lawType: true,
          articleNumber: true,
          title: true,
          year: true,
          status: true,
          effectiveFrom: true,
          effectiveTo: true,
          amendedBy: true,
          supersededBy: true,
          sourceUrl: true,
          lastCheckedAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json({
        total: articles.length,
        articles: articles.map((a) => ({
          id: a.id,
          lawName: a.lawName,
          lawNameEn: a.lawNameEn,
          lawType: a.lawType,
          articleNumber: a.articleNumber,
          title: a.title,
          year: a.year,
          status: a.status,
          effectiveFrom: a.effectiveFrom?.toISOString() ?? null,
          effectiveTo: a.effectiveTo?.toISOString() ?? null,
          amendedBy: a.amendedBy,
          supersededBy: a.supersededBy,
          sourceUrl: a.sourceUrl,
          lastCheckedAt: a.lastCheckedAt?.toISOString() ?? null,
          lastUpdated: a.updatedAt.toISOString(),
        })),
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: "Failed to list articles", detail: err?.message },
        { status: 500 },
      );
    }
  }

  // ── action=exists: check if a specific article exists + its status ─────
  if (action === "exists") {
    const law = searchParams.get("law");
    const article = searchParams.get("article");

    if (!law || !article) {
      return NextResponse.json(
        { error: "Both 'law' and 'article' query parameters are required" },
        { status: 400 },
      );
    }

    try {
      // Try exact match first, then partial match on law name.
      let record = await db.legalCorpus.findFirst({
        where: {
          articleNumber: article,
          OR: [
            { lawName: { contains: law } },
            { lawNameEn: { contains: law } },
          ],
        },
      });

      // If no match on law name, try matching just the article number.
      if (!record) {
        record = await db.legalCorpus.findFirst({
          where: { articleNumber: article },
        });
      }

      if (!record) {
        return NextResponse.json({
          exists: false,
          status: null,
          superseded: false,
          provision: null,
          message: `No article found matching law="${law}" article="${article}"`,
        });
      }

      const isSuperseded =
        record.status === "superseded" || !!record.supersededBy;
      const isAmended = record.status === "amended" || !!record.amendedBy;
      const isRepealed = record.status === "repealed";

      let message = `Found: ${record.lawName} م${record.articleNumber}`;
      if (isSuperseded) {
        message += ` — SUPERSEDED${record.supersededBy ? ` by ${record.supersededBy}` : ""}`;
      } else if (isAmended) {
        message += ` — AMENDED${record.amendedBy ? ` by ${record.amendedBy}` : ""}`;
      } else if (isRepealed) {
        message += ` — REPEALED`;
      } else {
        message += ` — in force`;
      }

      return NextResponse.json({
        exists: true,
        status: record.status,
        superseded: isSuperseded,
        amended: isAmended,
        repealed: isRepealed,
        provision: {
          id: record.id,
          lawName: record.lawName,
          lawNameEn: record.lawNameEn,
          articleNumber: record.articleNumber,
          title: record.title,
          status: record.status,
          effectiveFrom: record.effectiveFrom?.toISOString() ?? null,
          effectiveTo: record.effectiveTo?.toISOString() ?? null,
          amendedBy: record.amendedBy,
          supersededBy: record.supersededBy,
          sourceUrl: record.sourceUrl,
        },
        message,
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: "Lookup failed", detail: err?.message },
        { status: 500 },
      );
    }
  }

  // ── default: health check / server info ────────────────────────────────
  let articleCount = 0;
  let inForceCount = 0;
  let amendedCount = 0;
  let repealedCount = 0;
  try {
    articleCount = await db.legalCorpus.count();
    inForceCount = await db.legalCorpus.count({ where: { status: "in_force" } });
    amendedCount = await db.legalCorpus.count({ where: { status: "amended" } });
    repealedCount = await db.legalCorpus.count({ where: { status: "repealed" } });
  } catch {
    // DB not ready — return 0.
  }

  return NextResponse.json({
    server: "Al Mizan Self-Hosted Jordanian Law MCP",
    version: "1.1.0",
    status: "operational",
    articleCount,
    statusBreakdown: {
      in_force: inForceCount,
      amended: amendedCount,
      repealed: repealedCount,
      superseded: await db.legalCorpus.count({ where: { status: "superseded" } }).catch(() => 0),
    },
    endpoints: {
      health: "GET /api/mcp/jordanian-law",
      list: "GET /api/mcp/jordanian-law?action=list",
      exists: "GET /api/mcp/jordanian-law?action=exists&law=...&article=...",
      tools: "POST /api/mcp/jordanian-law { tool, arguments }",
    },
    tools: [
      "search_legislation",
      "get_provision",
      "validate_citation",
      "check_currency",
      "build_legal_stance",
      "list_sources",
    ],
    selfHosted: true,
    noExternalDependency: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Tool implementations
// ─────────────────────────────────────────────────────────────────────────

async function dispatchTool(
  tool: string,
  args: Record<string, any>,
): Promise<any> {
  switch (tool) {
    case "search_legislation":
      return await searchLegislation(args);
    case "get_provision":
      return await getProvision(args);
    case "validate_citation":
      return await validateCitation(args);
    case "check_currency":
      return await checkCurrency(args);
    case "build_legal_stance":
      return await buildLegalStance(args);
    case "list_sources":
      return await listSources();
    default:
      return {
        error: `Unknown tool: ${tool}. Available: search_legislation, get_provision, validate_citation, check_currency, build_legal_stance, list_sources`,
      };
  }
}

/**
 * 1. search_legislation — search across all Jordanian articles by keyword.
 * Supports both semantic (pgvector) and text-search (fallback) retrieval.
 */
async function searchLegislation(args: any): Promise<any> {
  const { query, limit = 10, lang = "ar" } = args ?? {};
  if (!query || typeof query !== "string") {
    return { results: [], error: "query is required" };
  }

  // Try semantic search first (pgvector).
  const vectorAvailable = await isVectorSearchAvailable();
  if (vectorAvailable) {
    const embResult = await generateEmbedding(query);
    if (embResult.values) {
      try {
        const literal =
          "[" + embResult.values.map((n) => Number(n).toFixed(7)).join(",") + "]";
        const rows = (await db.$queryRaw`
          SELECT
            lc.id,
            lc."lawName",
            lc."lawType",
            lc."articleNumber",
            lc.title,
            lc.content,
            lc.year,
            lc."sourceUrl",
            lc.embedding IS NOT NULL AS has_embedding,
            (1 - (lc.embedding <=> ${literal}::vector))::float AS score
          FROM "LegalCorpus" lc
          WHERE lc.embedding IS NOT NULL
          ORDER BY lc.embedding <=> ${literal}::vector
          LIMIT ${limit}
        `) as any[];
        return {
          results: rows.map((r) => ({
            id: r.id,
            lawName: r.lawName,
            lawType: r.lawType,
            articleNumber: r.articleNumber,
            title: r.title,
            excerpt: r.content?.slice(0, 200) + "...",
            year: r.year,
            sourceUrl: r.sourceUrl,
            inForce: true, // All articles in our corpus are in force
            score: r.score,
          })),
        };
      } catch (err) {
        console.warn("[mcp] semantic search failed, falling back to text:", err);
      }
    }
  }

  // Text-search fallback (SQLite dev or pgvector unavailable).
  const articles = await db.legalCorpus.findMany({
    where: {
      OR: [
        { content: { contains: query } },
        { title: { contains: query } },
        { lawName: { contains: query } },
        // Also split into keywords for partial matching.
        ...query
          .split(/\s+/)
          .filter((w) => w.length >= 3)
          .slice(0, 6)
          .flatMap((w) => [
            { content: { contains: w } },
            { title: { contains: w } },
          ]),
      ],
    },
    take: limit,
    orderBy: { lawName: "asc" },
  });

  return {
    results: articles.map((a) => ({
      id: a.id,
      lawName: a.lawName,
      lawType: a.lawType,
      articleNumber: a.articleNumber,
      title: a.title,
      excerpt: a.content?.slice(0, 200) + "...",
      year: a.year,
      sourceUrl: a.sourceUrl,
      inForce: true,
      score: undefined as number | undefined, // text search has no similarity score
    })),
  };
}

/**
 * 2. get_provision — fetch the full verbatim text of a specific article.
 */
async function getProvision(args: any): Promise<any> {
  const { law_name, article_number } = args ?? {};
  if (!law_name || !article_number) {
    return { provision: null, error: "law_name and article_number are required" };
  }

  // Try exact match first, then partial match on law name.
  let article = await db.legalCorpus.findFirst({
    where: {
      articleNumber: article_number,
      lawName: { contains: law_name },
    },
  });

  if (!article) {
    // Try matching just on article number (might match multiple laws).
    article = await db.legalCorpus.findFirst({
      where: { articleNumber: article_number },
    });
  }

  if (!article) {
    return { provision: null, error: "Provision not found" };
  }

  return {
    provision: {
      id: article.id,
      jurisdiction: "JO",
      lawName: article.lawName,
      lawNameEn: article.lawNameEn,
      lawType: article.lawType,
      articleNumber: article.articleNumber,
      title: article.title,
      text: article.content, // Verbatim official text — never paraphrased
      year: article.year,
      inForce: article.status === "in_force",
      status: article.status,
      amendedBy: article.amendedBy ?? null,
      supersededBy: article.supersededBy ?? null,
      effectiveFrom: article.effectiveFrom?.toISOString() ?? null,
      effectiveTo: article.effectiveTo?.toISOString() ?? null,
      amendedDate: article.effectiveTo?.toISOString() ?? null,
      repealedDate: undefined,
      repealedBy: undefined,
      sourceUrl: article.sourceUrl,
      references: [],
    },
  };
}

/**
 * 3. validate_citation — check if a citation string resolves to a real article.
 * Parses citations like "القانون المدني م256" or "Civil Code Article 256".
 */
async function validateCitation(args: any): Promise<any> {
  const { citation } = args ?? {};
  if (!citation || typeof citation !== "string") {
    return {
      validation: {
        valid: false,
        message: "citation is required",
      },
    };
  }

  // Parse the citation — extract article number (digits) + law name (rest).
  const articleMatch = citation.match(/(\d+)/);
  const articleNumber = articleMatch ? articleMatch[1] : null;

  // Try to extract law name by removing the article number + common words.
  const lawNameHint = citation
    .replace(/\d+/g, "")
    .replace(/\b(m|article|مادة|المادة|قانون|القانون|law|code)\b/gi, "")
    .replace(/[()\[\]{}""«»]/g, "")
    .trim();

  if (!articleNumber) {
    return {
      validation: {
        valid: false,
        message: "Could not extract article number from citation",
        citation,
      },
    };
  }

  // Search for a matching article.
  const candidates = await db.legalCorpus.findMany({
    where: { articleNumber },
    take: 10,
  });

  if (candidates.length === 0) {
    return {
      validation: {
        valid: false,
        articleNumber,
        message: `No article found with number ${articleNumber}`,
        citation,
      },
    };
  }

  // Try to find the best match by law name.
  let bestMatch = candidates[0];
  if (lawNameHint) {
    const scored = candidates.map((c) => ({
      article: c,
      score: lawNameHint
        .split(/\s+/)
        .filter((w) => w.length >= 3)
        .reduce(
          (acc, w) => acc + (c.lawName.includes(w) ? 1 : 0),
          0,
        ),
    }));
    scored.sort((a, b) => b.score - a.score);
    bestMatch = scored[0].article;
  }

  // ── Report amendment / currency status in the validation response ──────
  const inForce = bestMatch.status === "in_force";
  const isAmended = bestMatch.status === "amended" || !!bestMatch.amendedBy;
  const isSuperseded = bestMatch.status === "superseded" || !!bestMatch.supersededBy;
  const isRepealed = bestMatch.status === "repealed";

  let message = `Citation resolved to ${bestMatch.lawName} م${bestMatch.articleNumber}`;
  if (isSuperseded) {
    message += ` — WARNING: SUPERSEDED${bestMatch.supersededBy ? ` by ${bestMatch.supersededBy}` : ""}. Use the superseding provision instead.`;
  } else if (isAmended) {
    message += ` — NOTE: AMENDED${bestMatch.amendedBy ? ` by ${bestMatch.amendedBy}` : ""}. Text is the pre-amendment version; verify the current text.`;
  } else if (isRepealed) {
    message += ` — WARNING: REPEALED. Do not cite this provision.`;
  } else {
    message += ` — in force.`;
  }

  return {
    validation: {
      valid: true,
      lawName: bestMatch.lawName,
      lawNameEn: bestMatch.lawNameEn,
      articleNumber: bestMatch.articleNumber,
      provisionId: bestMatch.id,
      inForce,
      status: bestMatch.status,
      amended: isAmended,
      amendedBy: bestMatch.amendedBy ?? null,
      superseded: isSuperseded,
      supersededBy: bestMatch.supersededBy ?? null,
      repealed: isRepealed,
      effectiveFrom: bestMatch.effectiveFrom?.toISOString() ?? null,
      effectiveTo: bestMatch.effectiveTo?.toISOString() ?? null,
      message,
    },
  };
}

/**
 * 4. check_currency — is a provision still in force?
 * All articles in our corpus are current Jordanian law, so this returns true
 * unless the article doesn't exist.
 */
async function checkCurrency(args: any): Promise<any> {
  const { provision_id } = args ?? {};
  if (!provision_id) {
    return {
      currency: {
        inForce: false,
        message: "provision_id is required",
      },
    };
  }

  const article = await db.legalCorpus.findUnique({
    where: { id: provision_id },
  });

  if (!article) {
    return {
      currency: {
        provisionId: provision_id,
        inForce: false,
        status: "not_found",
        message: "Provision not found in database",
      },
    };
  }

  // Determine currency from the new status fields.
  const inForce = article.status === "in_force";
  const isAmended = article.status === "amended" || !!article.amendedBy;
  const isSuperseded = article.status === "superseded" || !!article.supersededBy;
  const isRepealed = article.status === "repealed";

  // Update lastCheckedAt — this is a currency check, so stamp it.
  try {
    await db.legalCorpus.update({
      where: { id: article.id },
      data: { lastCheckedAt: new Date() },
    });
  } catch {
    // Non-blocking — the currency response still returns.
  }

  let message = `${article.lawName} م${article.articleNumber} is `;
  if (inForce) {
    message += "in force.";
  } else if (isSuperseded) {
    message += `SUPERSEDED${article.supersededBy ? ` by ${article.supersededBy}` : ""}.`;
  } else if (isAmended) {
    message += `AMENDED${article.amendedBy ? ` by ${article.amendedBy}` : ""}.`;
  } else if (isRepealed) {
    message += "REPEALED.";
  }

  return {
    currency: {
      provisionId: article.id,
      lawName: article.lawName,
      articleNumber: article.articleNumber,
      inForce,
      status: article.status,
      amendedDate: article.effectiveTo?.toISOString() ?? null,
      amendedBy: article.amendedBy ?? null,
      repealedDate: article.effectiveTo?.toISOString() ?? null,
      repealedBy: isRepealed ? article.amendedBy : null,
      supersededBy: article.supersededBy ?? null,
      effectiveFrom: article.effectiveFrom?.toISOString() ?? null,
      effectiveTo: article.effectiveTo?.toISOString() ?? null,
      lastCheckedAt: new Date().toISOString(),
      message,
      notes:
        "Currency checked against the Al Mizan LegalCorpus database. Always verify against the official gazette before filing.",
    },
  };
}

/**
 * 5. build_legal_stance — find supporting + opposing provisions for a position.
 * Uses semantic search to find articles relevant to the position, then
 * classifies them as supporting or opposing based on keyword heuristics.
 */
async function buildLegalStance(args: any): Promise<{ stance: any }> {
  const { position, lang = "ar" } = args ?? {};
  if (!position) {
    return {
      stance: {
        position: "",
        supporting: [],
        opposing: [],
        summary: "position is required",
        jurisdiction: "JO",
      },
    };
  }

  // Search for articles relevant to the position.
  const searchResult = await searchLegislation({ query: position, limit: 8, lang });
  const articles = searchResult.results;

  // Classify each article as supporting or opposing based on simple heuristics.
  // This is a lightweight classification — not a legal opinion.
  const supporting: any[] = [];
  const opposing: any[] = [];

  const opposingKeywords = [
    "استثناء",
    "إلا",
    "لا يجوز",
    "محظور",
    "ممنوع",
    "باطل",
    "غير جائز",
    "exception",
    "prohibited",
    "void",
    "not allowed",
  ];

  for (const article of articles) {
    // Fetch the full provision text.
    const provResult = await getProvision({
      law_name: article.lawName,
      article_number: article.articleNumber,
    });

    if (provResult.provision) {
      const text = provResult.provision.text || "";
      const isOpposing = opposingKeywords.some((kw) =>
        text.toLowerCase().includes(kw.toLowerCase()),
      );
      if (isOpposing) {
        opposing.push(provResult.provision);
      } else {
        supporting.push(provResult.provision);
      }
    }
  }

  const summary =
    lang === "ar"
      ? `بناءً على البحث في المدوّنة القانونية الأردنية، تم العثور على ${supporting.length} مادة داعمة و${opposing.length} مادة معارضة للموقف المطروح. يُرجى مراجعة المواد المذكورة والتحقق منها مقابل الجريدة الرسمية قبل الاعتماد عليها في أي إجراء قانوني.`
      : `Based on search of the Jordanian legal corpus, ${supporting.length} supporting and ${opposing.length} opposing provisions were found for this position. Please review and verify against the official gazette before relying on them in any legal proceeding.`;

  return {
    stance: {
      position,
      supporting,
      opposing,
      summary,
      jurisdiction: "JO",
    },
  };
}

/**
 * list_sources — list all law types in the corpus.
 */
async function listSources(): Promise<{ sources: any[] }> {
  const sources = await db.legalCorpus.groupBy({
    by: ["lawName", "lawType"],
    _count: { articleNumber: true },
    orderBy: { lawName: "asc" },
  });

  return {
    sources: sources.map((s) => ({
      lawName: s.lawName,
      lawType: s.lawType,
      articleCount: s._count.articleNumber,
    })),
  };
}
