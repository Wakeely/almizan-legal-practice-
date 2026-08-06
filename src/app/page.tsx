"use client";

// =============================================================================
// Al Mizan Legal Practice — landing entry.
// -----------------------------------------------------------------------------
// This file is intentionally thin: the app is now route-based.
//   • Lawyer workspace  → /workspace/...  (real App Router routes)
//   • Client portal     → /client-portal/...
// Authenticated users are redirected straight into the workspace; unauthenticated
// users see the landing page and can sign in / register.
// =============================================================================

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LandingPage from "@/components/landing/landing-page";
import AuthModal from "@/components/auth/auth-modal";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/components/providers/language-provider";
import { RefreshCw } from "lucide-react";

export default function Page() {
  const { loading, isAuthenticated } = useAuth();
  const { isRtl } = useLanguage();
  const router = useRouter();

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot">("signin");

  // Redirect authenticated users into the lawyer workspace.
  useEffect(() => {
    if (isAuthenticated) router.replace("/workspace/overview");
  }, [isAuthenticated, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">
          {isRtl ? "جاري تحضير ملفات الميزان..." : "Initializing Al Mizan..."}
        </p>
      </div>
    );
  }

  if (isAuthenticated) return null; // redirecting

  return (
    <>
      <LandingPage
        onEnterWorkspace={() => {
          setAuthMode("signin");
          setAuthOpen(true);
        }}
        onEnterClientPortal={() => {
          setAuthMode("signin");
          setAuthOpen(true);
        }}
      />
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
        onSuccess={() => router.replace("/workspace/overview")}
      />
    </>
  );
}
