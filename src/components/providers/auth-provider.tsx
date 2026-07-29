"use client";

// =============================================================================
// AuthProvider — client-side auth context backed by NextAuth.
// -----------------------------------------------------------------------------
// SECURITY IMPROVEMENT over reference:
// The reference stored a JWT in localStorage and sent it as a Bearer header.
// This port uses NextAuth's HttpOnly + SameSite + Secure cookie session — the
// token NEVER touches JavaScript. The client only knows whether a session
// exists and who the user is.
// =============================================================================

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { UserProfile } from "@/lib/types";

export type SubscriptionTier = "Free Trial" | "Solo Practice" | "Pro Practice" | "Enterprise & Arbitration";

interface AuthContextValue {
  user: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: {
    name: string;
    email: string;
    password?: string;        // either passed as data.password OR as 2nd arg (legacy ref UI compat)
    firmName: string;
    barAssociationId?: string;
    jurisdiction: string;
    accountType: "Law Firm" | "Solo Practitioner" | "Corporate Counsel" | "Client";
  }, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  upgradeSubscription: (tier: any, billingCycle: any) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    // Use next-auth signIn to set the HttpOnly cookie — no token in JS.
    const { signIn } = await import("next-auth/react");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (!res || res.error) {
      throw new Error("Invalid email or password");
    }
    await refresh();
  }, [refresh]);

  const signup = useCallback(async (data: any, passwordArg?: string) => {
    // The reference AuthModal calls signup({ ...fields }, password) — i.e.
    // password as the SECOND argument. We accept both forms: data.password OR
    // the explicit passwordArg, for backward compatibility with the ref UI.
    const password = passwordArg ?? data.password;
    if (!password) throw new Error("Password is required");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Registration failed" }));
      throw new Error(err.error || "Registration failed");
    }
    // Auto-login after register — sets the HttpOnly cookie via NextAuth.
    await login(data.email, password);
  }, [login]);

  const logout = useCallback(async () => {
    const { signOut } = await import("next-auth/react");
    await signOut({ redirect: false });
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error("Failed to send reset code");
  }, []);

  const upgradeSubscription = useCallback(async (tier: any, billingCycle: any) => {
    const res = await fetch("/api/auth/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, billingCycle }),
    });
    if (!res.ok) return false;
    await refresh();
    return true;
  }, [refresh]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        signup,
        logout,
        resetPassword,
        upgradeSubscription,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
