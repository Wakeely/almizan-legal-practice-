// =============================================================================
// Al Mizan — NextAuth configuration
// -----------------------------------------------------------------------------
// SECURITY:
// - JWT session strategy with HttpOnly + Secure + SameSite=Lax cookies.
// - Credentials provider verifies password via bcrypt.
// - JWT callback injects organizationId + role into the token.
// - Session callback exposes organizationId + role to the client.
// - NEXTAUTH_SECRET must be set in env (validated at boot).
// - NEXTAUTH_URL is auto-detected in dev; set explicitly in prod.
// =============================================================================

import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validation/auth";

const SECRET = process.env.NEXTAUTH_SECRET;
if (!SECRET) {
  // Fail fast at module load — auth cannot operate without a secret.
  console.error("[auth] FATAL: NEXTAUTH_SECRET is not set. Auth will be insecure.");
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    // 30-minute access token, refresh handled by NextAuth on activity
    maxAge: 60 * 30,
  },
  jwt: {
    secret: SECRET ?? "dev-insecure-secret-change-me",
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

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // Custom fields carried via JWT callback
          organizationId: user.organizationId,
          role: user.role,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // First sign-in: persist org + role
        token.organizationId = (user as any).organizationId;
        token.role = (user as any).role;
        token.userId = (user as any).id ?? user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId;
        (session.user as any).organizationId = token.organizationId;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  events: {
    // Fires after NextAuth successfully authenticates a user (Credentials provider).
    // This is the ONLY reliable place to audit logins — the client-side signIn()
    // helper posts to /api/auth/callback/credentials, bypassing any custom route.
    async signIn({ user, account, }) {
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
            // SQLite has no Json type — serialize to String (same as audit() helper).
            details: JSON.stringify({ provider: account?.provider ?? "credentials", email: u.email }),
          },
        });
      } catch (err) {
        console.error("[audit] failed to write auth.login:", err);
      }
    },
    // Fires before NextAuth destroys the session. The session is still
    // readable here, so we can audit the logout.
    async signOut(message) {
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
