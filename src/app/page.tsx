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
import AiModule from "@/components/ai/ai-module";
import WarRoomModule from "@/components/war-room/war-room-module";
import ClientPortal from "@/components/client-portal/client-portal";
import OfflineBanner from "@/components/offline/offline-banner";
import SyncStatusIndicator from "@/components/offline/sync-status-indicator";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/components/providers/language-provider";
import type { Matter } from "@/lib/types";
import {
  saveItemsToOfflineStore,
  getAllFromOfflineStore,
  STORES,
} from "@/lib/offline-storage";
import { RefreshCw, Lock, FolderOpen } from "lucide-react";

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
      // Offline fast-path: if we already know we're offline, skip the network
      // round-trip and go straight to IndexedDB.
      const isOffline =
        typeof navigator !== "undefined" && navigator.onLine === false;

      if (!isOffline) {
        try {
          const res = await fetch("/api/matters", { cache: "no-store" });
          if (res.ok) {
            const data: Matter[] = await res.json();
            setMatters(data);
            // Phase 1.1: write-back to IndexedDB so the cache is populated
            // for offline refresh.
            if (data.length > 0) {
              await saveItemsToOfflineStore(STORES.MATTERS, data);
              // Only set active matter if none is currently selected
              setActiveMatterId((prev) => prev || data[0].id);
            }
            return;
          }
        } catch (err) {
          // Network failed mid-request — fall through to offline cache.
          console.warn("Matters fetch failed; falling back to offline cache:", err);
        }
      }

      // Offline fallback: read all cached matters from IndexedDB.
      const cached = await getAllFromOfflineStore<Matter>(STORES.MATTERS);
      if (cached && cached.length > 0) {
        setMatters(cached);
        setActiveMatterId((prev) => prev || cached[0].id);
      } else {
        // No cache + offline → empty state.
        setMatters([]);
      }
    } catch (err) {
      console.error("Failed to fetch matters:", err);
    } finally {
      setMattersLoading(false);
    }
  }, []);

  // Listen for mobile-tab-changed events emitted by MobileBottomNav
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setActiveMobileTab(detail);
    };
    window.addEventListener("mobile-tab-changed", handler);
    return () => window.removeEventListener("mobile-tab-changed", handler);
  }, []);

  // Auto-enter workspace + fetch matters when authenticated (handles page refresh)
  useEffect(() => {
    if (isAuthenticated && view === "landing") {
      setView("workspace");
    }
  }, [isAuthenticated, view]);

  // Fetch matters when workspace view is active
  useEffect(() => {
    if (view === "workspace" && isAuthenticated) {
      fetchMatters();
    }
  }, [view, isAuthenticated, fetchMatters]);

  // After the offline queue flushes on reconnect, refresh matters so the UI
  // reflects server-side state (e.g. a matter created offline is now persisted).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      if (view === "workspace" && isAuthenticated) {
        fetchMatters();
      }
    };
    window.addEventListener("almizan:sync-complete", handler);
    return () =>
      window.removeEventListener("almizan:sync-complete", handler);
  }, [view, isAuthenticated, fetchMatters]);

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
    <>
    <OfflineBanner />
    <div className="app-theme-wrapper min-h-screen p-2 sm:p-4 md:p-8 pb-24 lg:pb-8 text-foreground flex flex-col overflow-x-hidden">
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
              <div id="calendar-module" className={activeMobileTab !== "all" ? "hidden lg:block" : "block"}>
                <CalendarModule matterId={activeMatter.id} matters={matters} />
              </div>

              {/* Row 5: AI Copilot + War Room (Turn 4) */}
              <div id="ai-module" className={activeMobileTab !== "all" && activeMobileTab !== "ai" ? "hidden lg:block" : "block"}>
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4 md:gap-6">
                  <div className="xl:col-span-6">
                    <WarRoomModule activeMatter={activeMatter} />
                  </div>
                  <div className="xl:col-span-6">
                    <AiModule activeMatter={activeMatter} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* CLIENT PORTAL — server-filtered view (only visibleToClient records exposed) */
            <ClientPortal activeMatter={activeMatter} onRefreshMatter={handleRefreshMatter} />
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
        <div className="flex items-center gap-3">
          <SyncStatusIndicator />
          <span>v0.5.0 — OFFLINE COURTROOM</span>
        </div>
      </footer>
    </div>
    </>
  );
}
