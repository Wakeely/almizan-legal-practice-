// =============================================================================
// Al Mizan — Gemini Function-Calling Tool Declarations + Executor
// -----------------------------------------------------------------------------
// Registers the Jordanian Law MCP tools as Gemini function declarations so
// the model can decide when to call them. When the model requests a function
// call, the executor routes it to the MCP adapter, gets the result, and feeds
// it back to the model in the next turn.
//
// This file is the bridge between:
//   - src/lib/gemini.ts (the LLM calling layer)
//   - src/lib/mcp/jordanian-law.ts (the national-law adapter)
//
// The tool surface is designed to be extensible — adding UAE or Saudi MCPs
// later means adding their tool declarations + executors here, no changes to
// the calling layer needed.
// =============================================================================

import type { FunctionDeclaration } from "@google/genai";
import { getJordanianLawMcp, isJordanianLawMcpAvailable } from "./jordanian-law";
import { McpError } from "./types";

// Helper to build a JSON Schema for function parameters. The Gemini SDK
// accepts parametersJsonSchema (raw JSON Schema) which is simpler than the
// SDK's typed Schema object. This keeps our tool declarations readable.
function schema(props: Record<string, any>, required: string[] = []): any {
  return {
    type: "object",
    properties: props,
    required,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Tool declarations — what Gemini sees as available functions.
// Names use the 'jordanian_' prefix so the model knows the jurisdiction.
// ─────────────────────────────────────────────────────────────────────────

export const JORDANIAN_LAW_TOOLS: FunctionDeclaration[] = [
  {
    name: "search_jordanian_legislation",
    description:
      "Search Jordanian legislation (statutes, codes, regulations) by keyword or natural-language query. " +
      "Returns ranked results with law name + article number + short excerpt. " +
      "Use this when the user asks about Jordanian law and you need to find relevant provisions. " +
      "Works with both Arabic and English queries.",
    parametersJsonSchema: schema(
      {
        query: {
          type: "string",
          description:
            "The search query — can be Arabic or English. E.g. 'مدة استئناف الأحكام' or 'appeal deadline'.",
        },
        limit: {
          type: "integer",
          description: "Maximum number of results to return. Default 5.",
        },
        lang: {
          type: "string",
          enum: ["ar", "en"],
          description: "Preferred language for results. Default 'ar'.",
        },
      },
      ["query"],
    ),
  },
  {
    name: "get_jordanian_provision",
    description:
      "Get the full verbatim official text of a specific Jordanian legal provision by law name + article number. " +
      "Use this AFTER search_jordanian_legislation when you need the exact text to cite. " +
      "Returns the official Arabic text — never paraphrased.",
    parametersJsonSchema: schema(
      {
        law_name: {
          type: "string",
          description:
            "The law name in Arabic or English. E.g. 'القانون المدني الأردني' or 'Jordanian Civil Code'.",
        },
        article_number: {
          type: "string",
          description: "The article / provision number. E.g. '256'.",
        },
      },
      ["law_name", "article_number"],
    ),
  },
  {
    name: "validate_jordanian_citation",
    description:
      "Validate a free-text legal citation like 'القانون المدني م256' or 'Civil Code Article 256'. " +
      "Returns whether the citation resolves to a real provision + its canonical ID + whether it's in force. " +
      "Use this to verify citations before including them in a drafted document.",
    parametersJsonSchema: schema(
      {
        citation: {
          type: "string",
          description: "The citation string to validate.",
        },
      },
      ["citation"],
    ),
  },
  {
    name: "check_jordanian_law_currency",
    description:
      "Check whether a specific Jordanian legal provision is still in force (not repealed or superseded). " +
      "Use this before relying on a citation in a filed document to ensure the law hasn't changed.",
    parametersJsonSchema: schema(
      {
        provision_id: {
          type: "string",
          description:
            "The provision ID from a previous search or get_provision call. E.g. 'jo-civil-256'.",
        },
      },
      ["provision_id"],
    ),
  },
  {
    name: "build_jordanian_legal_stance",
    description:
      "Build a structured legal stance from Jordanian provisions. Given a position (e.g. 'the tenant is entitled to a 30-day cure period'), " +
      "returns supporting + opposing provisions and a neutral summary. " +
      "Use this for risk analysis or when building an argument.",
    parametersJsonSchema: schema(
      {
        position: {
          type: "string",
          description: "The legal position or argument to evaluate.",
        },
        lang: {
          type: "string",
          enum: ["ar", "en"],
          description: "Preferred language for the summary. Default 'ar'.",
        },
      },
      ["position"],
    ),
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Tool executor — routes Gemini function calls to the MCP adapter.
// Returns a JSON string that gets fed back to the model.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Execute a Gemini-requested function call against the Jordanian Law MCP.
 * Called when Gemini returns a functionCall part in its response.
 *
 * Returns the tool result as a JSON string (to be sent back to the model
 * as a functionResponse in the next turn).
 *
 * If the MCP is unavailable, returns a graceful error message that tells
 * the model to proceed without the tool (never crashes the flow).
 */
export async function executeJordanianLawTool(
  toolName: string,
  args: Record<string, any>,
): Promise<string> {
  try {
    // Quick availability check — if the MCP is down, tell the model.
    const available = await isJordanianLawMcpAvailable();
    if (!available) {
      return JSON.stringify({
        error: "Jordanian Law MCP is currently unavailable. Proceed without it and note that citations could not be verified.",
      });
    }

    const mcp = getJordanianLawMcp();

    switch (toolName) {
      case "search_jordanian_legislation": {
        const results = await mcp.searchLegislation(args.query, {
          limit: args.limit,
          lang: args.lang,
        });
        return JSON.stringify({ results });
      }

      case "get_jordanian_provision": {
        const provision = await mcp.getProvision(
          args.law_name,
          args.article_number,
        );
        return JSON.stringify({
          provision: provision ?? { error: "Provision not found" },
        });
      }

      case "validate_jordanian_citation": {
        const validation = await mcp.validateCitation(args.citation);
        return JSON.stringify({ validation });
      }

      case "check_jordanian_law_currency": {
        const currency = await mcp.checkCurrency(args.provision_id);
        return JSON.stringify({ currency });
      }

      case "build_jordanian_legal_stance": {
        const stance = await mcp.buildLegalStance(args.position, {
          lang: args.lang,
        });
        return JSON.stringify({ stance });
      }

      default:
        return JSON.stringify({
          error: `Unknown tool: ${toolName}`,
        });
    }
  } catch (err: any) {
    // Graceful error — the model gets a message it can relay to the user.
    const isMcpError = err instanceof McpError;
    return JSON.stringify({
      error: isMcpError
        ? `Jordanian Law MCP error (${err.code}): ${err.message}`
        : `Tool execution failed: ${err?.message ?? String(err)}`,
    });
  }
}

/**
 * Get the list of tool declarations to register with Gemini.
 * Only includes tools whose MCP is configured.
 * (For now, only Jordanian Law. Extend by adding UAE/SA arrays here later.)
 */
export function getAvailableLawTools(): FunctionDeclaration[] {
  // We always declare the tools — the executor handles MCP-unavailable
  // gracefully. This lets the model decide to call them, and if the MCP
  // is down, the model gets a clear "unavailable" response.
  return JORDANIAN_LAW_TOOLS;
}

/**
 * Check whether a Gemini response contains a function call that we handle.
 * Returns the first matching function call, or null.
 */
export function extractFunctionCall(
  response: any,
): { name: string; args: Record<string, any> } | null {
  const candidates = response?.candidates ?? [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts ?? [];
    for (const part of parts) {
      if (part?.functionCall?.name) {
        return {
          name: part.functionCall.name,
          args: part.functionCall.args ?? {},
        };
      }
    }
  }
  return null;
}
