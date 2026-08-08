// =============================================================================
// Al Mizan — Client Representative API bypass regression test
// -----------------------------------------------------------------------------
// Addendum v0.9 §4 (Testing):
//   Confirms that a Client Representative cannot reach staff-only /api/*
//   routes directly (must get 404, not data), while still being able to
//   reach the legitimate client-portal paths for their own matter.
//
// Run:
//   bun test tests/middleware/client-portal-bypass.test.ts
//
// Why mock next-auth/jwt?
//   The middleware reads the role straight off the JWT via getToken() to
//   avoid a DB call (Edge runtime can't use Prisma). To test the role-based
//   branch without spinning up a real auth flow + database, we stub
//   `next-auth/jwt.getToken` per-case to return a token with the role we
//   want to exercise.
// =============================================================================

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { NextRequest } from "next/server";

// ── Token scenarios we exercise ──────────────────────────────────────────────
// Shape matches what auth-options.ts jwt() callback places on the JWT:
//   token.role, token.userId, token.sub, token.email, token.organizationId,
//   token.primaryMatterId.
type FakeToken = {
  role?: string;
  userId?: string;
  sub?: string;
  email?: string;
  organizationId?: string;
  primaryMatterId?: string | null;
} | null;

let currentToken: FakeToken = null;

// ── Mock next-auth/jwt before importing the middleware ─────────────────────
// bun:test's mock.module replaces the module's exports for any code that
// imports it AFTER the mock is registered. The middleware imports
// `getToken` from `next-auth/jwt`, so we replace it with a stub that
// returns whatever `currentToken` is set to for the current test case.
mock.module("next-auth/jwt", () => ({
  getToken: async () => currentToken,
}));

// Import the middleware AFTER registering the mock so it picks up the stub.
// Dynamic import is required because mock.module is async.
const { middleware, config } = await import("@/middleware");

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeReq(pathname: string, method = "GET"): NextRequest {
  const url = `http://localhost:3000${pathname}`;
  return new NextRequest(url, { method });
}

async function statusOf(res: Response): Promise<{ status: number; body: any }> {
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

const CLIENT_REP_TOKEN: NonNullable<FakeToken> = {
  role: "Client Representative",
  userId: "user_client_1",
  sub: "user_client_1",
  email: "client@example.com",
  organizationId: "org_1",
  primaryMatterId: "matter_1",
};

const MANAGING_PARTNER_TOKEN: NonNullable<FakeToken> = {
  role: "Managing Partner",
  userId: "user_partner_1",
  sub: "user_partner_1",
  email: "partner@example.com",
  organizationId: "org_1",
  primaryMatterId: null,
};

beforeEach(() => {
  currentToken = null;
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe("middleware: Client Representative API bypass (Addendum v0.9)", () => {
  describe("blocked routes — Client Representative receives 404, not data", () => {
    test("GET /api/matters → 404", async () => {
      currentToken = CLIENT_REP_TOKEN;
      const res = await middleware(makeReq("/api/matters"));
      const { status, body } = await statusOf(res);
      expect(status).toBe(404);
      expect(body).toEqual({ error: "Not found" });
    });

    test("GET /api/documents → 404", async () => {
      currentToken = CLIENT_REP_TOKEN;
      const res = await middleware(makeReq("/api/documents"));
      const { status, body } = await statusOf(res);
      expect(status).toBe(404);
      expect(body).toEqual({ error: "Not found" });
    });

    test("GET /api/invoices → 404", async () => {
      currentToken = CLIENT_REP_TOKEN;
      const res = await middleware(makeReq("/api/invoices"));
      const { status, body } = await statusOf(res);
      expect(status).toBe(404);
      expect(body).toEqual({ error: "Not found" });
    });

    test("GET /api/tasks → 404", async () => {
      currentToken = CLIENT_REP_TOKEN;
      const res = await middleware(makeReq("/api/tasks"));
      const { status, body } = await statusOf(res);
      expect(status).toBe(404);
      expect(body).toEqual({ error: "Not found" });
    });

    test("GET /api/matters/[id] (single matter) → 404 (no partial leak)", async () => {
      currentToken = CLIENT_REP_TOKEN;
      const res = await middleware(makeReq("/api/matters/some-matter-id"));
      const { status, body } = await statusOf(res);
      expect(status).toBe(404);
      expect(body).toEqual({ error: "Not found" });
    });

    test("GET /api/platform-admin/audit-log → 404 (must not reach platform-admin)", async () => {
      currentToken = CLIENT_REP_TOKEN;
      const res = await middleware(makeReq("/api/platform-admin/audit-log"));
      const { status } = await statusOf(res);
      expect(status).toBe(404);
    });

    test("GET /api/ai/summarize → 404 (AI routes are staff-only)", async () => {
      currentToken = CLIENT_REP_TOKEN;
      const res = await middleware(makeReq("/api/ai/summarize"));
      const { status } = await statusOf(res);
      expect(status).toBe(404);
    });

    test("404 (not 403) — does not confirm route existence to a prober", async () => {
      currentToken = CLIENT_REP_TOKEN;
      const res = await middleware(makeReq("/api/matters"));
      expect(res.status).toBe(404);
      expect(res.status).not.toBe(403);
    });
  });

  describe("allowed routes — Client Representative legitimate paths still work", () => {
    test("GET /api/client-portal/matters/matter_1/documents → passes through", async () => {
      currentToken = CLIENT_REP_TOKEN;
      const res = await middleware(makeReq("/api/client-portal/matters/matter_1/documents"));
      // Pass-through = NextResponse.next() → status 200, empty body
      expect(res.status).toBe(200);
    });

    test("GET /api/client-portal/matters/matter_1/invoices → passes through", async () => {
      currentToken = CLIENT_REP_TOKEN;
      const res = await middleware(makeReq("/api/client-portal/matters/matter_1/invoices"));
      expect(res.status).toBe(200);
    });

    test("GET /api/client-portal/matters/matter_1/timeline → passes through", async () => {
      currentToken = CLIENT_REP_TOKEN;
      const res = await middleware(makeReq("/api/client-portal/matters/matter_1/timeline"));
      expect(res.status).toBe(200);
    });

    test("GET /api/auth/me → passes through (account-level, own profile)", async () => {
      currentToken = CLIENT_REP_TOKEN;
      const res = await middleware(makeReq("/api/auth/me"));
      expect(res.status).toBe(200);
    });

    test("POST /api/auth/logout → passes through (account-level)", async () => {
      currentToken = CLIENT_REP_TOKEN;
      const res = await middleware(makeReq("/api/auth/logout", "POST"));
      expect(res.status).toBe(200);
    });

    test("GET /api/invitations/accept?token=... → passes through", async () => {
      currentToken = CLIENT_REP_TOKEN;
      const res = await middleware(makeReq("/api/invitations/accept?token=abc"));
      expect(res.status).toBe(200);
    });
  });

  describe("non-client roles fall through to existing per-route auth", () => {
    test("Managing Partner calling GET /api/matters → passes through (not blocked here)", async () => {
      currentToken = MANAGING_PARTNER_TOKEN;
      const res = await middleware(makeReq("/api/matters"));
      expect(res.status).toBe(200);
    });

    test("Unauthenticated request to GET /api/matters → passes through (route returns 401)", async () => {
      currentToken = null;
      const res = await middleware(makeReq("/api/matters"));
      expect(res.status).toBe(200); // middleware passes; route itself returns 401
    });
  });

  describe("non-API routes are not gated by this middleware", () => {
    test("GET /workspace/matters → passes through (page route, not /api/* )", async () => {
      currentToken = CLIENT_REP_TOKEN;
      const res = await middleware(makeReq("/workspace/matters"));
      expect(res.status).toBe(200);
    });

    test("GET /_next/static/whatever → passes through", async () => {
      currentToken = CLIENT_REP_TOKEN;
      const res = await middleware(makeReq("/_next/static/chunks/main.js"));
      expect(res.status).toBe(200);
    });
  });

  describe("config.matcher", () => {
    test("matches every /api/* path", () => {
      // The matcher is a single string, documented Next.js syntax for
      // "match every /api/* path". The constant exists and is the expected
      // string.
      expect(config.matcher).toBe("/api/:path*");
    });
  });
});
