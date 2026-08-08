// =============================================================================
// Al Mizan — Edge middleware (Addendum v0.9)
// -----------------------------------------------------------------------------
// SECURITY FIX: Client Representative can bypass the client portal entirely.
//
// BACKGROUND
//   The client-portal routes (/api/client-portal/*) enforce per-matter scoping
//   via `verifyMatterMatchesClientScope` + `primaryMatterId` — that work is
//   correct and stays in place. The gap is that this scoping is ONLY applied
//   in those routes. The shared `requireUser()` gate used by every other
//   tenant API route (matters, documents, invoices, tasks, etc.) checks auth
//   and org-active status but NOT role. A Client Representative is a real
//   User row inside the firm's organization (by design — that's how invite-
//   acceptance works), so nothing stops that account from calling
//   `GET /api/matters` directly and getting back every matter in the firm.
//
// FIX STRATEGY
//   One enforcement point that can't be bypassed by a future oversight,
//   rather than per-route role checks that quietly rot as new routes are
//   added. Middleware runs on every matching request in the Edge runtime
//   before any route handler executes. The `role` is already on the JWT
//   (`auth-options.ts` jwt() callback: `token.role = u.role`), so we can
//   read it via `getToken()` with no DB call (Edge can't use Prisma).
//
// ALLOWLIST, NOT BLOCKLIST
//   New /api/* routes are staff-only BY DEFAULT. A Client Representative
//   only reaches the prefixes explicitly listed in CLIENT_ALLOWED_PREFIXES.
//   The next route someone adds is safe without anyone having to remember
//   to add a check.
//
// DEFENSE IN DEPTH
//   This layer does NOT replace `verifyMatterMatchesClientScope` and the
//   other scoping inside /api/client-portal/* — those still must stay.
//   Middleware blocks the client from ever reaching the wrong routes; the
//   client-portal routes' own scoping is what makes the ALLOWED routes safe.
//
// RESPONSE SHAPE
//   Blocked requests return 404 (not 403). A 403 confirms to a probing
//   client that the route exists and is merely forbidden; a 404 tells them
//   nothing. Mirrors the convention already used by
//   `verifyMatterMatchesClientScope` callers in the client-portal routes.
// =============================================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Paths a Client Representative is allowed to hit directly.
// Everything else under /api/* is staff-only.
//
// Audit trail (Addendum v0.9 §3):
//   • /api/client-portal/*  — scoping enforced by route handlers
//                             (verifyMatterMatchesClientScope + visibleToClient).
//   • /api/auth/*           — account-level only. Each route operates on the
//                             caller's own session/identity (login, logout,
//                             me, register, verify-email, reset-password,
//                             resend-verification, subscription).
//                             None expose cross-user or cross-firm data.
//   • /api/invitations/accept — invitation acceptance. The accepter cannot
//                             choose their own org, role, or matter — all
//                             three are fixed by the invitation record.
const CLIENT_ALLOWED_PREFIXES = [
  "/api/client-portal/",
  "/api/auth/",
  "/api/invitations/accept",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only gate /api/* — page routes have their own client-side guards and
  // don't expose privileged data server-side beyond what /api/* already
  // returns. Keeping the matcher tight avoids accidental breakage of
  // static assets, _next/*, etc.
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Read the JWT straight off the session cookie. No DB call — important
  // because Edge middleware can't use Prisma. The cookie name is customized
  // in auth-options.ts (`almizan.session-token`), so we must pass it
  // explicitly; the default `next-auth.session-token` would silently fail
  // to find the token and let every request through.
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: "almizan.session-token",
  });

  // Not logged in, or not a Client Representative — let the route's own
  // requireUser() / requireRole() handle auth as normal. We only intercept
  // here for the Client Representative role; staff roles fall through to
  // their existing per-route enforcement.
  if (!token || token.role !== "Client Representative") {
    return NextResponse.next();
  }

  // Client Representative trying to reach a staff-only API route.
  // 404 (not 403) so we don't confirm the route exists to a prober.
  const isAllowed = CLIENT_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isAllowed) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 },
    );
  }

  return NextResponse.next();
}

export const config = {
  // Match every /api/* path. Page routes, static assets, and _next/* are
  // excluded by this prefix and never enter the middleware body in a
  // way that would block them — the early `if (!pathname.startsWith("/api/"))`
  // is a secondary safety net for the rare case a future matcher change
  // widens the scope.
  matcher: "/api/:path*",
};
