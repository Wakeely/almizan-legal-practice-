// =============================================================================
// Al Mizan — Jordanian Law MCP Client Adapter (SELF-HOSTED)
// -----------------------------------------------------------------------------
// Talks to the SELF-HOSTED Jordanian Law MCP server that runs INSIDE Almizan
// at /api/mcp/jordanian-law. This is a fully self-contained solution — NO
// external dependency on any hosted service.
//
// === HOW IT WORKS ===
//
// The MCP server (src/app/api/mcp/jordanian-law/route.ts) implements all 5
// tools (search_legislation, get_provision, validate_citation, check_currency,
// build_legal_stance) using the LegalCorpus table in your own database. The
// statute data is the 31 curated articles seeded via rag:seed (extensible by
// editing src/data/jordanian-corpus.ts).
//
// The adapter calls this internal endpoint via HTTP. On Vercel, the URL is
// built from VERCEL_URL (auto-set) or NEXTAUTH_URL (manually set). No env
// var configuration needed — it just works.
//
// === WHEN TO OVERRIDE ===
//
// If you deploy a SEPARATE MCP server (e.g. a Docker container on a different
// host for isolation), set MCP_ENDPOINT to its URL:
//   MCP_ENDPOINT=https://your-separate-mcp-server.com/mcp
//
// If MCP_ENDPOINT is unset, the adapter uses the self-hosted internal route.
//
// === SECURITY ===
//   - Server-side only. This file must NEVER be imported from client code.
//   - Only public legal queries are sent (law name + article number).
//   - No client documents, organization data, or matter-specific content.
//   - Every call should be logged via audit() by the caller.
//
// === EXTENSIBILITY ===
//   This adapter implements NationalLawAdapter from ./types.ts. To add a UAE
//   or Saudi adapter later, copy this file, change the jurisdiction + endpoint,
//   and register it in gemini.ts alongside this one.
// =============================================================================

import type {
  NationalLawAdapter,
  McpSearchResult,
  McpProvision,
  McpCitationValidation,
  McpCurrencyCheck,
  McpLegalStance,
  McpAdapterOptions,
  Jurisdiction,
} from "./types";
import { McpError } from "./types";

// =============================================================================
// ENDPOINT CONFIGURATION
// -----------------------------------------------------------------------------
// The adapter defaults to the SELF-HOSTED MCP server that runs inside Almizan
// itself at /api/mcp/jordanian-law. This means:
//   - NO external dependency (no Ansvar-Systems hosted endpoint)
//   - The statute database lives in your own LegalCorpus table
//   - Everything runs on your Vercel deployment
//
// To override (e.g. for a separate Docker deployment), set MCP_ENDPOINT env var
// to the full URL of your MCP server.
//
// The self-hosted URL is built from VERCEL_URL (auto-set by Vercel) or
// NEXTAUTH_URL (set by you). On Vercel, VERCEL_URL is always available.
// =============================================================================
const DEFAULT_TIMEOUT_MS = 15000;

function getSelfHostedEndpoint(): string {
  // On Vercel, VERCEL_URL is automatically set (e.g. "almizan-xxx.vercel.app").
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/mcp/jordanian-law`;
  }
  // Fallback to NEXTAUTH_URL (which the user sets manually).
  if (process.env.NEXTAUTH_URL) {
    return `${process.env.NEXTAUTH_URL.replace(/\/$/, "")}/api/mcp/jordanian-law`;
  }
  // Local dev — relative URL won't work for fetch(), so use localhost.
  return "http://localhost:3000/api/mcp/jordanian-law";
}

/**
 * Jordanian Law MCP adapter. Implements the unified NationalLawAdapter
 * surface so it can be registered as Gemini tool declarations and called
 * transparently from AI routes.
 *
 * DEFAULT: uses the self-hosted MCP server at /api/mcp/jordanian-law
 * (runs inside Almizan itself — no external dependency).
 */
export class JordanianLawMcp implements NationalLawAdapter {
  readonly jurisdiction: Jurisdiction = "JO";
  readonly displayName = "Jordanian Law";

  private readonly endpoint: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;

  constructor(opts?: McpAdapterOptions) {
    // Priority: explicit opts > MCP_ENDPOINT env var > self-hosted internal route
    this.endpoint =
      opts?.endpoint ??
      process.env.MCP_ENDPOINT ??
      getSelfHostedEndpoint();
    this.apiKey = opts?.apiKey ?? process.env.MCP_API_KEY;
    this.timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Search Jordanian legislation. Query can be Arabic or English.
   * Returns ranked results with excerpts — does NOT return full text.
   * Use getProvision() for the verbatim article text.
   */
  async searchLegislation(
    query: string,
    opts?: { limit?: number; lang?: "ar" | "en" },
  ): Promise<McpSearchResult[]> {
    const limit = opts?.limit ?? 10;
    const lang = opts?.lang ?? "ar";
    const data = await this.callMcp("search_legislation", { query, limit, lang });
    return (data?.results ?? []) as McpSearchResult[];
  }

  /**
   * Get the full verbatim text of a specific provision.
   * Returns null if the law/article combination doesn't exist.
   */
  async getProvision(
    lawName: string,
    articleNumber: string,
  ): Promise<McpProvision | null> {
    const data = await this.callMcp("get_provision", {
      law_name: lawName,
      article_number: articleNumber,
    });
    if (!data || !data.provision) return null;
    return {
      ...data.provision,
      jurisdiction: "JO",
    } as McpProvision;
  }

  /**
   * Validate a free-text citation like "القانون المدني الأردني م256" or
   * "Civil Code Article 256". Returns whether it resolves + the canonical ID.
   */
  async validateCitation(citation: string): Promise<McpCitationValidation> {
    const data = await this.callMcp("validate_citation", { citation });
    return (data?.validation ?? {
      valid: false,
      message: "No response from MCP server",
    }) as McpCitationValidation;
  }

  /**
   * Check whether a provision is still in force (not repealed/superseded).
   * Use this before relying on a citation in a filed document.
   */
  async checkCurrency(provisionId: string): Promise<McpCurrencyCheck> {
    const data = await this.callMcp("check_currency", { provision_id: provisionId });
    if (!data?.currency) {
      throw new McpError(
        "MCP returned no currency data",
        "INVALID_RESPONSE",
      );
    }
    return {
      ...data.currency,
      checkedAt: new Date().toISOString(),
    } as McpCurrencyCheck;
  }

  /**
   * Build a structured legal stance from MCP provisions. Given a position
   * (e.g. "the tenant is entitled to a 30-day cure period"), returns
   * supporting + opposing provisions and a neutral summary.
   */
  async buildLegalStance(
    position: string,
    opts?: { lang?: "ar" | "en" },
  ): Promise<McpLegalStance> {
    const lang = opts?.lang ?? "ar";
    const data = await this.callMcp("build_legal_stance", {
      position,
      lang,
    });
    if (!data?.stance) {
      throw new McpError(
        "MCP returned no stance data",
        "INVALID_RESPONSE",
      );
    }
    return {
      ...data.stance,
      jurisdiction: "JO",
    } as McpLegalStance;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Internal: low-level MCP HTTP call with timeout + error handling.
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Call a single MCP tool with the given arguments. Uses a simple JSON-RPC
   * style request over HTTP POST. Handles timeouts, auth, and error codes.
   *
   * The MCP server is expected to accept:
   *   POST {endpoint}
   *   Content-Type: application/json
   *   { "tool": "<tool_name>", "arguments": { ... } }
   *
   * And return:
   *   { "result": { ... } }  on success
   *   { "error": { "code": "...", "message": "..." } }  on failure
   */
  private async callMcp(
    tool: string,
    args: Record<string, unknown>,
  ): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      const res = await fetch(this.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ tool, arguments: args }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 401 || res.status === 403) {
          throw new McpError(
            `MCP auth failed (${res.status})`,
            "AUTH",
            res.status,
          );
        }
        if (res.status === 429) {
          throw new McpError(
            "MCP rate limit exceeded",
            "RATE_LIMIT",
            res.status,
          );
        }
        if (res.status === 404) {
          throw new McpError(
            `MCP tool not found: ${tool}`,
            "NOT_FOUND",
            res.status,
          );
        }
        throw new McpError(
          `MCP HTTP ${res.status}: ${body.slice(0, 200)}`,
          "INVALID_RESPONSE",
          res.status,
        );
      }

      const json = await res.json();

      // MCP servers return errors in an "error" field.
      if (json?.error) {
        const errMsg =
          json.error.message ?? JSON.stringify(json.error).slice(0, 200);
        throw new McpError(
          `MCP tool '${tool}' error: ${errMsg}`,
          "INVALID_RESPONSE",
        );
      }

      return json?.result ?? json;
    } catch (err: any) {
      if (err instanceof McpError) throw err;
      if (err?.name === "AbortError") {
        throw new McpError(
          `MCP call timed out after ${this.timeoutMs}ms`,
          "TIMEOUT",
        );
      }
      // Network error (DNS, connection refused, etc.)
      throw new McpError(
        `MCP network error: ${err?.message ?? String(err)}`,
        "NETWORK",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Singleton instance — used by the Gemini tool executor + AI routes.
// Lazily initialized so the adapter isn't created at module-load time
// (avoids hitting the MCP endpoint during cold starts that don't need it).
// ─────────────────────────────────────────────────────────────────────────

let _instance: JordanianLawMcp | null = null;

export function getJordanianLawMcp(): JordanianLawMcp {
  if (!_instance) {
    _instance = new JordanianLawMcp();
  }
  return _instance;
}

/**
 * Check whether the Jordanian Law MCP is configured + reachable.
 * Used by the Gemini tool layer to decide whether to offer the tools.
 * Returns false (not an error) if the MCP is unreachable — the AI route
 * should fall back gracefully.
 */
export async function isJordanianLawMcpAvailable(): Promise<boolean> {
  try {
    const mcp = getJordanianLawMcp();
    // Cheap probe — list sources (should return immediately).
    await mcp.searchLegislation("test", { limit: 1 });
    return true;
  } catch {
    return false;
  }
}
