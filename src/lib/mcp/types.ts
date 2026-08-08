// =============================================================================
// Al Mizan — Shared types for national-law MCP integrations
// -----------------------------------------------------------------------------
// These types are deliberately generic so the same adapter pattern can be
// extended to other national-law MCPs (UAE, Saudi, Kuwait, etc.) later.
// Each national-law adapter extends NationalLawAdapter and implements the
// same tool surface, so the Gemini tool-registration layer doesn't need to
// know which jurisdiction it's dealing with.
// =============================================================================

/** ISO 3166-1 alpha-2 country code. Used to tag statutes + route requests. */
export type Jurisdiction = "JO" | "AE" | "SA" | "KW" | "QA" | "BH" | "OM";

/** A single search result from a national-law MCP. */
export interface McpSearchResult {
  /** Stable identifier from the MCP server (e.g. "jo-civil-256"). */
  id: string;
  /** Law name in the original language (e.g. "القانون المدني الأردني"). */
  lawName: string;
  /** Law name in English (e.g. "Jordanian Civil Code"). */
  lawNameEn?: string;
  /** Article / provision number (e.g. "256"). */
  articleNumber: string;
  /** Article title / heading, if the source provides one. */
  title?: string;
  /** Short excerpt (first ~200 chars) for display in search results. */
  excerpt: string;
  /** Year of the law (e.g. 1976). */
  year?: number;
  /** Whether the provision is currently in force. */
  inForce?: boolean;
  /** Official source URL if available. */
  sourceUrl?: string;
  /** Similarity / relevance score from the MCP search (0..1). */
  score?: number;
}

/** Full provision text returned by get_provision. */
export interface McpProvision {
  id: string;
  jurisdiction: Jurisdiction;
  lawName: string;
  lawNameEn?: string;
  lawType: string; // 'civil' | 'labour' | 'procedure' | 'evidence' | ...
  articleNumber: string;
  title?: string;
  /** Verbatim official text — never paraphrased by an LLM. */
  text: string;
  year?: number;
  inForce: boolean;
  /** If the provision was amended, the date of the latest amendment. */
  amendedDate?: string;
  /** If the provision was repealed, the date + repealing law. */
  repealedDate?: string;
  repealedBy?: string;
  sourceUrl?: string;
  /** Other provisions that this one cross-references. */
  references?: string[];
}

/** Result of validating a citation like "القانون المدني الأردني م256". */
export interface McpCitationValidation {
  valid: boolean;
  /** The law name as parsed from the citation. */
  lawName?: string;
  /** The article number as parsed from the citation. */
  articleNumber?: string;
  /** The canonical provision ID from the MCP, if the citation resolved. */
  provisionId?: string;
  /** Whether the cited provision is currently in force. */
  inForce?: boolean;
  /** A suggested corrected citation if the original was close but malformed. */
  suggestedCorrection?: string;
  /** Diagnostic message explaining why validation failed. */
  message: string;
}

/** Result of checking whether a provision is still in force. */
export interface McpCurrencyCheck {
  provisionId: string;
  lawName: string;
  articleNumber: string;
  inForce: boolean;
  /** ISO date string of the last check against the MCP server. */
  checkedAt: string;
  amendedDate?: string;
  repealedDate?: string;
  repealedBy?: string;
  notes?: string;
}

/** A structured legal stance / argument built from MCP provisions. */
export interface McpLegalStance {
  /** The user's original question or position. */
  position: string;
  /** Provisions that support the position. */
  supporting: McpProvision[];
  /** Provisions that contradict or qualify the position. */
  opposing: McpProvision[];
  /** A neutral summary citing the provisions. */
  summary: string;
  jurisdiction: Jurisdiction;
}

/** The unified tool surface every national-law adapter must implement. */
export interface NationalLawAdapter {
  readonly jurisdiction: Jurisdiction;
  readonly displayName: string;
  searchLegislation(query: string, opts?: { limit?: number; lang?: "ar" | "en" }): Promise<McpSearchResult[]>;
  getProvision(lawName: string, articleNumber: string): Promise<McpProvision | null>;
  validateCitation(citation: string): Promise<McpCitationValidation>;
  checkCurrency(provisionId: string): Promise<McpCurrencyCheck>;
  buildLegalStance(position: string, opts?: { lang?: "ar" | "en" }): Promise<McpLegalStance>;
}

/** Error class for MCP failures — distinguishes network/auth/not-found/etc. */
export class McpError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NETWORK"
      | "TIMEOUT"
      | "AUTH"
      | "RATE_LIMIT"
      | "NOT_FOUND"
      | "INVALID_RESPONSE"
      | "NOT_CONFIGURED",
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "McpError";
  }
}

/** Options for creating an MCP adapter instance. */
export interface McpAdapterOptions {
  /**
   * The base URL of the MCP server. For HTTP/SSE transport.
   * If unset, the adapter uses the MCP_ENDPOINT env var or the default hosted URL.
   */
  endpoint?: string;
  /** API key for the MCP server (if required). */
  apiKey?: string;
  /** Request timeout in ms. Default 15000. */
  timeoutMs?: number;
  /** Whether to enable the local Prisma cache. Default true. */
  enableCache?: boolean;
}
