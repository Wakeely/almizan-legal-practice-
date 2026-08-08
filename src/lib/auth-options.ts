// =============================================================================
// Al Mizan — NextAuth configuration
// -----------------------------------------------------------------------------
// SECURITY:
// - JWT session strategy with HttpOnly + Secure + SameSite=Lax cookies.
// - Credentials provider verifies password via bcrypt.
// - JWT callback injects FULL identity (id, email, name, org, role) into token.
// - Session callback exposes complete identity to client — no stale data.
// - NEXTAUTH_SECRET must be set in env (validated at boot).
// - NEXTAUTH_URL is auto-detected in dev; set explicitly in prod.
//
// IDENTITY FIX (v2):
// - authorize() returns COMPLETE identity object (email, name, id, org, role)
// - jwt() binds ALL fields on sign-in, preserves them on token refresh
// - session() exposes ALL identity fields to client
// - Rejects soft-deleted users (deletedAt != null)
// - Logs authenticated identity for diagnostics
// =============================================================================

import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validation/auth";

const SECRET = process.env.NEXTAUTH_SECRET;
if (!SECRET) {
  throw new Error(
    "[auth] FATAL: NEXTAUTH_SECRET is not set. Authentication cannot operate securely. Set a strong random secret (openssl rand -base64 32)."
  );
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    // 30-minute access token, refresh handled by NextAuth on activity
    maxAge: 60 * 30,
  },
  jwt: {
    secret: SECRET,
  },
  cookies: {
    sessionToken: {
      name: `almizan.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: `almizan.callback-url`,
      options: { sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
    },
    csrfToken: {
      name: `almizan.csrf-token`,
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
    },
  },
  providers: [
    Credentials({
      name: "Al Mizan",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials) return null;
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: { organization: true },
        });
        if (!user || !user.organization) return null;

        // ── Soft-delete gate ──────────────────────────────────────────────
        // Reject users who have been soft-deleted. Their session must not revive.
        if (user.deletedAt) {
          console.log(`[auth] Login rejected: user ${user.id} is soft-deleted`);
          return null;
        }

        // ── Suspended-org gate (PRD v0.3 §7) ──────────────────────────────
        // Reject logins for users whose organization is not 'active'. This
        // complements the runtime gate in requireUser() (src/lib/org.ts) which
        // catches sessions issued BEFORE the org was suspended.
        //
        // The Organization.status column is added in migration 0001. The select
        // below is defensive: if the column doesn't exist yet (pre-migration),
        // the optional chaining returns undefined and we treat it as active.
        const orgStatus = (user.organization as any)?.status;
        if (orgStatus && orgStatus !== "active") {
          console.log(
            `[auth] Login rejected: org ${user.organizationId} status=${orgStatus}`,
          );
          return null;
        }

        // ── Email verification gate ──────────────────────────────────────
        // Users MUST verify their email before they can log in.
        // Returning null here causes NextAuth to reject the login with a
        // generic error — the client then shows "verify your email" guidance.
        if (!user.emailVerified) {
          console.log(`[auth] Login rejected: email not verified for ${user.email}`);
          return null;
        }

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        // ── Diagnostic log (identity proof) ───────────────────────────────
        console.log(
          `[auth] authorize success: email=${user.email} userId=${user.id} ` +
          `orgId=${user.organizationId} role=${user.role}`
        );

        // Return COMPLETE identity — all fields needed for JWT binding
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: user.organizationId,
          role: user.role,
          primaryMatterId: user.primaryMatterId, // PRD v0.6 §5.1 — client matter scoping
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On FIRST sign-in (user object present): bind ALL identity fields
      if (user) {
        const u = user as any;
        token.sub = u.id;                    // JWT standard subject = user ID
        token.userId = u.id;                 // Explicit userId for easy access
        token.email = u.email;               // Bind email for mismatch detection
        token.name = u.name;                 // Bind display name
        token.organizationId = u.organizationId; // Multi-tenant isolation
        token.role = u.role;                 // Authorization context
        token.primaryMatterId = u.primaryMatterId ?? null; // Client matter scoping
      }

      // SAFETY: Ensure userId is never undefined if sub exists
      // This can happen if a stale token lacks our custom fields
      token.userId = token.userId ?? token.sub;

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const su = session.user as any;
        // Expose COMPLETE identity from JWT to client
        su.id = token.userId ?? token.sub;   // User's database ID
        su.email = token.email;              // For email-mismatch guard in auth-provider
        su.name = token.name;                // Display name
        su.organizationId = token.organizationId; // Multi-tenant scope
        su.role = token.role;                // Role-based UI/authorization
        su.primaryMatterId = token.primaryMatterId; // Client matter scoping
      }
      return session;
    },
  },
  events: {
    // Fires after NextAuth successfully authenticates a user (Credentials provider).
    // This is the ONLY reliable place to audit logins — the client-side signIn()
    // helper posts to /api/auth/callback/credentials, bypassing any custom route.
    async signIn({ user, account }) {
      try {
        const { db } = await import("@/lib/db");
        const u = user as any;
        const orgId = u.organizationId;
        if (!orgId || !u.id) return;
        await db.auditLog.create({
          data: {
            organizationId: orgId,
            userId: u.id,
            action: "auth.login",
            entity: "user",
            entityId: u.id,
            details: JSON.stringify({ provider: account?.provider ?? "credentials", email: u.email }),
          },
        });
      } catch (err) {
        console.error("[audit] failed to write auth.login:", err);
      }
    },
    // Fires before NextAuth destroys the session. The session is still
    // readable here, so we can audit the logout.
    async signOut() {
      try {
        const { getSessionUser } = await import("@/lib/session");
        const session = await getSessionUser();
        if (!session) return;
        const { db } = await import("@/lib/db");
        await db.auditLog.create({
          data: {
            organizationId: session.organizationId,
            userId: session.id,
            action: "auth.logout",
            entity: "user",
            entityId: session.id,
          },
        });
      } catch (err) {
        console.error("[audit] failed to write auth.logout:", err);
      }
    },
  },
  pages: {
    // We don't use NextAuth's built-in pages — the AuthModal component handles UI.
    signIn: "/",
  },
};
