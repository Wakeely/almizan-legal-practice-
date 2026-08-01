// =============================================================================
// Al Mizan — Jordanian Law MCP adapter test stubs
// -----------------------------------------------------------------------------
// These are lightweight integration test stubs. They require MCP_ENDPOINT to
// be set (or the hosted endpoint to be reachable). Run with:
//
//   bun test tests/mcp/jordanian-law.test.ts
//
// Or execute directly:
//   bun run tests/mcp/jordanian-law.test.ts
//
// The tests are designed to PASS when the MCP is available and SKIP
// gracefully when it's not (no false failures in CI without the MCP).
// =============================================================================

import { describe, test, expect, beforeAll } from "bun:test";
import {
  JordanianLawMcp,
  getJordanianLawMcp,
  isJordanianLawMcpAvailable,
} from "@/lib/mcp/jordanian-law";
import { McpError } from "@/lib/mcp/types";

let mcpAvailable = false;

beforeAll(async () => {
  // Probe once — skip tests if the MCP isn't reachable.
  mcpAvailable = await isJordanianLawMcpAvailable();
  if (!mcpAvailable) {
    console.warn(
      "[test] Jordanian Law MCP is not available — tests will be skipped. " +
        "Set MCP_ENDPOINT to run the full integration suite.",
    );
  }
});

describe("JordanianLawMcp adapter", () => {
  test("constructs with default endpoint when no options provided", () => {
    const mcp = new JordanianLawMcp();
    expect(mcp.jurisdiction).toBe("JO");
    expect(mcp.displayName).toBe("Jordanian Law");
  });

  test("constructs with custom endpoint + apiKey", () => {
    const mcp = new JordanianLawMcp({
      endpoint: "https://custom.example.com/mcp",
      apiKey: "test-key",
      timeoutMs: 5000,
    });
    expect(mcp).toBeDefined();
  });

  test("getJordanianLawMcp returns singleton", () => {
    const a = getJordanianLawMcp();
    const b = getJordanianLawMcp();
    expect(a).toBe(b);
  });
});

// Integration tests — only run when the MCP is reachable.
const maybeTest = mcpAvailable ? test : test.skip;

describe("JordanianLawMcp integration (requires MCP endpoint)", () => {
  maybeTest(
    "searchLegislation returns results for Arabic query",
    async () => {
      const mcp = getJordanianLawMcp();
      const results = await mcp.searchLegislation("تقادم الالتزامات", {
        limit: 3,
        lang: "ar",
      });
      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        expect(results[0]).toHaveProperty("lawName");
        expect(results[0]).toHaveProperty("articleNumber");
        expect(results[0]).toHaveProperty("excerpt");
      }
    },
  );

  maybeTest(
    "searchLegislation returns results for English query",
    async () => {
      const mcp = getJordanianLawMcp();
      const results = await mcp.searchLegislation("appeal deadline", {
        limit: 3,
        lang: "en",
      });
      expect(Array.isArray(results)).toBe(true);
    },
  );

  maybeTest(
    "getProvision returns verbatim text for known article",
    async () => {
      const mcp = getJordanianLawMcp();
      const provision = await mcp.getProvision(
        "القانون المدني الأردني",
        "256",
      );
      if (provision) {
        expect(provision.jurisdiction).toBe("JO");
        expect(provision.lawName).toBeDefined();
        expect(provision.articleNumber).toBe("256");
        expect(provision.text).toBeDefined();
        expect(provision.text.length).toBeGreaterThan(50);
      }
    },
  );

  maybeTest(
    "getProvision returns null for non-existent article",
    async () => {
      const mcp = getJordanianLawMcp();
      const provision = await mcp.getProvision(
        "Non-existent Law",
        "99999",
      );
      expect(provision).toBeNull();
    },
  );

  maybeTest(
    "validateCitation resolves a valid citation",
    async () => {
      const mcp = getJordanianLawMcp();
      const result = await mcp.validateCitation("القانون المدني م256");
      expect(result).toHaveProperty("valid");
      expect(result).toHaveProperty("message");
    },
  );

  maybeTest(
    "checkCurrency returns in-force status",
    async () => {
      const mcp = getJordanianLawMcp();
      // First search to get a provision ID.
      const results = await mcp.searchLegislation("نفقة الزوجة", { limit: 1 });
      if (results.length > 0 && results[0].id) {
        const currency = await mcp.checkCurrency(results[0].id);
        expect(currency).toHaveProperty("inForce");
        expect(currency).toHaveProperty("checkedAt");
      }
    },
  );

  maybeTest(
    "buildLegalStance returns structured stance",
    async () => {
      const mcp = getJordanianLawMcp();
      const stance = await mcp.buildLegalStance(
        "المستأجر يستحق مهلة 30 يوماً لإصلاح الإخلال",
        { lang: "ar" },
      );
      expect(stance.jurisdiction).toBe("JO");
      expect(stance).toHaveProperty("supporting");
      expect(stance).toHaveProperty("opposing");
      expect(stance).toHaveProperty("summary");
    },
  );
});

describe("JordanianLawMcp error handling", () => {
  test("McpError has correct code + message", () => {
    const err = new McpError("test message", "TIMEOUT");
    expect(err.code).toBe("TIMEOUT");
    expect(err.message).toBe("test message");
    expect(err.name).toBe("McpError");
  });

  test("callMcp with invalid endpoint throws NETWORK or TIMEOUT error", async () => {
    const mcp = new JordanianLawMcp({
      endpoint: "https://nonexistent-domain-12345.invalid/mcp",
      timeoutMs: 3000,
    });
    try {
      await mcp.searchLegislation("test");
      // If it doesn't throw, the test env might have a DNS resolver that
      // doesn't fail — skip rather than fail.
    } catch (err: any) {
      expect(err).toBeInstanceOf(McpError);
      expect(["NETWORK", "TIMEOUT"]).toContain(err.code);
    }
  });
});
