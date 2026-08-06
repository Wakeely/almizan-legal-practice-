"use client";

// =============================================================================
// ClientPortalShell — the layout chrome for /client-portal. Completely separate
// from the lawyer workspace: no sidebar, no internal tools — only the portal
// header (logo, language/theme, "Lawyer View" escape) around client-safe pages.
// =============================================================================

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { RefreshCw, Lock, Shield } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/components/providers/language-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { MattersProvider } from "@/components/providers/matters-provider";
import ThemeAwareLogo from "@/components/branding/theme-aware-logo";
import OfflineBanner from "@/components/offline/offline-banner";
import SyncStatusIndicator from "@/components/offline/sync-status-indicator";
import HashRedirect from "@/components/workspace/hash-redirect";
import { cn } from "@/lib/utils";

const iconBtnCls = "h-8 w-8 rounded-lg bg-accent hover:bg-accent/80 flex items-center justify-center transition-colors";

function PortalAuthScreen({ lock }: { lock: boolean }) {
  const { isRtl } = useLanguage();
  if (!lock) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">
          {isRtl ? "جاري تحضير البوابة..." : "Initializing Client Portal..."}
        </p>
      </div>
    );
  }
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 bg-background">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-center">
        <Lock className="w-8 h-8" />
      </div>
      <div className="text-center max-w-md">
        <h2 className="text-xl font-extrabold">{isRtl ? "يجب تسجيل الدخول" : "Authentication required"}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {isRtl ? "سيتم تحويلك إلى صفحة تسجيل الدخول." : "Redirecting you to sign in..."}
        </p>
      </div>
    </div>
  );
}

export default function ClientPortalShell({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/");
  }, [loading, isAuthenticated, router]);

  // Deep-linked matter id drives the shared matters provider.
  const matterId = pathname.match(/^\/client-portal\/matters\/([^/]+)/)?.[1];

  if (loading) return <PortalAuthScreen lock={false} />;
  if (!isAuthenticated) return <PortalAuthScreen lock={true} />;

  return (
    <MattersProvider initialMatterId={matterId}>
      <PortalInner>{children}</PortalInner>
    </MattersProvider>
  );
}

function PortalInner({ children }: { children: React.ReactNode }) {
  const { isRtl } = useLanguage();
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  return (
    <>
      <HashRedirect />
      <OfflineBanner />
      <div className="app-theme-wrapper min-h-screen text-foreground flex flex-col overflow-hidden">
        {/* Portal header — no internal tools, always has the lawyer escape */}
        <header className="flex items-center justify-between gap-4 bg-card border-b border-border h-14 px-4 md:px-6">
          <div className="shrink-0">
            <ThemeAwareLogo className="h-9 w-auto" alt="Al Mizan Client Portal" />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setLanguage(language === "ar" ? "en" : "ar")} className={iconBtnCls} title={isRtl ? "تغيير اللغة" : "Switch language"}>
              <span className="text-xs font-bold">{isRtl ? "EN" : "ع"}</span>
            </button>
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className={iconBtnCls} title={isRtl ? "تبديل الوضع" : "Toggle theme"}>
              <span className="text-xs font-bold">{theme === "dark" ? "☀" : "☾"}</span>
            </button>

            {/* Always-visible way back to Lawyer mode (desktop + mobile) */}
            <button
              onClick={() => router.push("/workspace/overview")}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer",
                "border-border bg-card text-foreground hover:bg-accent"
              )}
              title={isRtl ? "العودة إلى وضع المحامي" : "Back to Lawyer Mode"}
            >
              <Shield className="w-4 h-4 text-primary shrink-0" />
              <span className="whitespace-nowrap">
                {isRtl ? "وضع المحامي" : "Lawyer View"}
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
          <div className="max-w-4xl mx-auto page-enter">{children}</div>
        </main>

        <footer className="border-t border-border px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center text-[10px] text-muted-foreground uppercase tracking-widest gap-2">
          <span>AL MIZAN LEGAL PRACTICE © 2026</span>
          <span className="text-center">CLIENT PORTAL</span>
          <div className="flex items-center gap-3">
            <SyncStatusIndicator />
            <span>v0.7.0</span>
          </div>
        </footer>
      </div>
    </>
  );
}
