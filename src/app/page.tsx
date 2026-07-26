"use client";

// =============================================================================
// Al Mizan Legal Practice — single-page app entry (state-driven)
// -----------------------------------------------------------------------------
// The fullstack-dev sandbox only exposes the `/` route to the user. The
// reference Vite app is also a single-page app driven by `useState`, so this
// is a faithful architectural port.
//
// Flow:
//   landing  → user clicks "Launch Workspace" or "Client Portal"
//   auth     → AuthModal opens (sign-in / sign-up / forgot-password)
//   authed   → workspace renders:
//               Row 1: AnalyticsModule         (Turn 2)
//               Row 2: MattersModule + TasksModule (Turn 2)
//               Row 3-4: DocumentsModule, BillingModule, CalendarModule,
//                        AiModule, WarRoomModule, ClientPortal (Turns 3-5)
// =============================================================================

import React, { useState, useCallback, useEffect } from "react";
import LandingPage from "@/components/landing/landing-page";
import AuthModal from "@/components/auth/auth-modal";
import Header from "@/components/header/header";
import AnalyticsModule from "@/components/analytics/analytics-module";
import MattersModule from "@/components/matters/matters-module";
import TasksModule from "@/components/tasks/tasks-module";
import DocumentsModule from "@/components/documents/documents-module";
import BillingModule from "@/components/billing/billing-module";
import CalendarModule from "@/components/calendar/calendar-module";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/components/providers/language-provider";
import type { Matter } from "@/lib/types";
import { RefreshCw, Lock, AlertTriangle, FolderOpen, Sparkles } from "lucide-react";

type View = "landing" | "workspace";

export default function Page() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { t, isRtl } = useLanguage();

  const [view, setView] = useState<View>("landing");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [mode, setMode] = useState<"Lawyer" | "Client">("Lawyer");

  // Workspace state
  const [matters, setMatters] = useState<Matter[]>([]);
  const [activeMatterId, setActiveMatterId] = useState<string>("");
  const [mattersLoading, setMattersLoading] = useState(true);
  const [activeMobileTab, setActiveMobileTab] = useState<"all" | "analytics" | "tasks" | "docs" | "ai">("all");

  const fetchMatters = useCallback(async () => {
    setMattersLoading(true);
    try {
      const res = await fetch("/api/matters", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setMatters(data);
        if (data.length > 0 && !activeMatterId) {
          setActiveMatterId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch matters:", err);
    } finally {
      setMattersLoading(false);
    }
  }, [activeMatterId]);

  // Listen for mobile-tab-changed events emitted by MobileBottomNav
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setActiveMobileTab(detail);
    };
    window.addEventListener("mobile-tab-changed", handler);
    return () => window.removeEventListener("mobile-tab-changed", handler);
  }, []);

  // ----- LANDING VIEW -----
  if (view === "landing" && !isAuthenticated) {
    return (
      <>
        <LandingPage
          onEnterWorkspace={() => {
            if (isAuthenticated) {
              setMode("Lawyer");
              setView("workspace");
            } else {
              setAuthMode("signin");
              setAuthOpen(true);
            }
          }}
          onEnterClientPortal={() => {
            if (isAuthenticated) {
              setMode("Client");
              setView("workspace");
            } else {
              setAuthMode("signin");
              setAuthOpen(true);
            }
          }}
        />
        <AuthModal
          isOpen={authOpen}
          onClose={() => setAuthOpen(false)}
          initialMode={authMode}
          onSuccess={() => {
            setMode("Lawyer");
            setView("workspace");
          }}
        />
      </>
    );
  }

  // ----- LOADING VIEW -----
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

  // ----- AUTH REQUIRED VIEW -----
  if (!isAuthenticated) {
    return (
      <>
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 bg-background">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-center">
            <Lock className="w-8 h-8" />
          </div>
          <div className="text-center max-w-md">
            <h2 className="text-xl font-extrabold">
              {isRtl ? "يجب تسجيل الدخول للوصول لبيئة العمل" : "Authentication required"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isRtl
                ? "يرجى تسجيل الدخول أو إنشاء حساب للمتابعة إلى مساحة عمل الميزان."
                : "Please sign in or create an account to access the Al Mizan workspace."}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setAuthMode("signin"); setAuthOpen(true); }}
              className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow hover:opacity-90 transition cursor-pointer"
            >
              {isRtl ? "تسجيل الدخول" : "Sign In"}
            </button>
            <button
              onClick={() => { setAuthMode("signup"); setAuthOpen(true); }}
              className="px-5 py-2.5 bg-secondary text-secondary-foreground font-bold text-xs rounded-xl border border-border hover:bg-accent transition cursor-pointer"
            >
              {isRtl ? "إنشاء حساب" : "Register"}
            </button>
          </div>
        </div>
        <AuthModal
          isOpen={authOpen}
          onClose={() => setAuthOpen(false)}
          initialMode={authMode}
          onSuccess={() => setView("workspace")}
        />
      </>
    );
  }

  // ----- WORKSPACE VIEW -----
  // Fetch matters on first workspace entry
  if (view === "workspace" && matters.length === 0 && !mattersLoading) {
    fetchMatters();
  }

  const handleNewMatterCreated = (newMatter: Matter) => {
    setMatters((prev) => [...prev, newMatter]);
    setActiveMatterId(newMatter.id);
  };

  const handleMatterUpdated = (updated: Matter) => {
    setMatters((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  const handleRefreshMatter = () => {
    fetchMatters();
  };

  const activeMatter = matters.find((m) => m.id === activeMatterId);

  return (
    <div className="app-theme-wrapper min-h-screen p-2 sm:p-4 md:p-8 pb-24 lg:pb-8 text-foreground flex flex-col">
      {/* Header with profile widget, matter selector, mode toggle */}
      <Header
        currentMode={mode}
        onModeChange={(m) => setMode(m)}
        matters={matters}
        activeMatterId={activeMatterId}
        onActiveMatterChange={(id) => setActiveMatterId(id)}
        onNewMatterCreated={handleNewMatterCreated}
        onShowLandingPage={() => setView("landing")}
      />

      {/* Main Panel Controller */}
      {activeMatter ? (
        <main className="flex-grow flex flex-col gap-3 sm:gap-4 md:gap-8 mt-4">
          {mode === "Lawyer" ? (
            <div className="flex flex-col gap-3 sm:gap-4 md:gap-6" id="lawyer-workspace">
              {/* Row 1: Analytics */}
              <div id="analytics-module" className={activeMobileTab !== "all" && activeMobileTab !== "analytics" ? "hidden lg:block" : "block"}>
                <AnalyticsModule activeMatter={activeMatter} />
              </div>

              {/* Row 2: Matter details + Kanban */}
              <div id="tasks-module" className={activeMobileTab !== "all" && activeMobileTab !== "tasks" ? "hidden lg:block" : "block"}>
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4 md:gap-6">
                  <div className="xl:col-span-4">
                    <MattersModule activeMatter={activeMatter} onMatterUpdated={handleMatterUpdated} />
                  </div>
                  <div className="xl:col-span-8">
                    <TasksModule matterId={activeMatter.id} matters={matters} />
                  </div>
                </div>
              </div>

              {/* Row 3: Documents + Billing */}
              <div id="documents-module" className={activeMobileTab !== "all" && activeMobileTab !== "docs" ? "hidden lg:block" : "block"}>
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4 md:gap-6">
                  <div className="xl:col-span-6">
                    <DocumentsModule
                      matterId={activeMatter.id}
                      onRefreshExpenses={handleRefreshMatter}
                    />
                  </div>
                  <div className="xl:col-span-6">
                    <BillingModule
                      activeMatter={activeMatter}
                      onRefreshMatter={handleRefreshMatter}
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Calendar (includes Court Rules Calculator + Print Preview) */}
              <div id="calendar-module" className={activeMobileTab !== "all" && activeMobileTab !== "calendar" ? "hidden lg:block" : "block"}>
                <CalendarModule matterId={activeMatter.id} matters={matters} />
              </div>

              {/* Row 5: AI Copilot + War Room — Turn 4 placeholder */}
              <ComingSoonRow
                tabId="ai"
                activeTab={activeMobileTab}
                icon={<Sparkles className="w-5 h-5" />}
                title={isRtl ? "المساعد القانوني وغرفة المحاكمة" : "AI Copilot & War Room"}
                turnNumber={4}
                isRtl={isRtl}
              />
            </div>
          ) : (
            /* CLIENT PORTAL — Turn 4 */
            <div className="flex-grow bg-card border border-border rounded-3xl p-12 text-center shadow-sm flex flex-col items-center justify-center gap-4">
              <FolderOpen className="w-16 h-16 text-muted-foreground/40 animate-pulse" />
              <h3 className="text-xl font-bold">
                {isRtl ? "بوابة الموكل" : "Client Portal"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                {isRtl
                  ? "بوابة الموكل الآمنة ستتوفر في المرحلة القادمة من خطة التطوير."
                  : "The secure Client Portal ships in Turn 4 of the rollout plan."}
              </p>
            </div>
          )}
        </main>
      ) : (
        <div className="flex-grow bg-card border border-border rounded-3xl p-12 text-center shadow-sm flex flex-col items-center justify-center gap-4 mt-4">
          <FolderOpen className="w-16 h-16 text-muted-foreground/40 animate-pulse" />
          <h3 className="text-xl font-bold">
            {isRtl ? "لا توجد قضية مفتوحة" : "No Case Files Open"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            {isRtl
              ? "يرجى قيد ملف قضية جديد أو تحديد نزاع تجاري نشط من القائمة العلوية للبدء."
              : "Create an intake file or select an active matter from the header dropdown to begin."}
          </p>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-8 pt-6 border-t border-border flex flex-col md:flex-row justify-between items-center text-[10px] text-muted-foreground uppercase tracking-widest gap-3">
        <span>AL MIZAN LEGAL PRACTICE © 2026</span>
        <span className="text-center">BILINGUAL • MULTI-TENANT • RTL-READY</span>
        <span>v0.2.0 — PHASE 2</span>
      </footer>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ComingSoonRow — placeholder card for modules shipping in later turns
// -----------------------------------------------------------------------------
function ComingSoonRow({
  tabId,
  activeTab,
  icon,
  title,
  turnNumber,
  isRtl,
}: {
  tabId: "docs" | "calendar" | "ai";
  activeTab: string;
  icon: React.ReactNode;
  title: string;
  turnNumber: number;
  isRtl: boolean;
}) {
  const hidden = activeTab !== "all" && activeTab !== tabId;
  if (hidden) return null;
  return (
    <div className="bg-card/60 border border-dashed border-border rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-grow">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-base font-extrabold">{title}</h3>
          <span className="text-[10px] font-bold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
            {isRtl ? `المرحلة ${turnNumber}` : `Turn ${turnNumber}`}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {isRtl
            ? "هذه الوحدة قيد التطوير وستتوفر في المرحلة القادمة من خطة الإصدار."
            : "This module is under active development and ships in the next phase of the rollout plan."}
        </p>
      </div>
      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
    </div>
  );
}
