"use client";

// =============================================================================
// Al Mizan Legal Practice — REDESIGNED: URL-stateful, triage-first
// -----------------------------------------------------------------------------
// FIX 1: Hash-based URL state — every view/matter is bookmarkable
// FIX 3: Matter picker is THE entry point, not an afterthought
// FIX 4: Client portal is a separate layout, not a toggle
// FIX 5: Overview = triage dashboard ("3 things need you today")
// =============================================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import LandingPage from "@/components/landing/landing-page";
import AuthModal from "@/components/auth/auth-modal";
import Header from "@/components/header/header";
import WorkspaceSidebar from "@/components/workspace/workspace-sidebar";
import { type WorkspaceView, WORKSPACE_VIEWS } from "@/lib/navigation";
import AnalyticsModule from "@/components/analytics/analytics-module";
import MattersModule from "@/components/matters/matters-module";
import TasksModule from "@/components/tasks/tasks-module";
import DocumentsModule from "@/components/documents/documents-module";
import BillingModule from "@/components/billing/billing-module";
import CalendarModule from "@/components/calendar/calendar-module";
import AiModule from "@/components/ai/ai-module";
import WarRoomModule from "@/components/war-room/war-room-module";
import InvestigationModule from "@/components/investigation/investigation-module";
import ClientPortal from "@/components/client-portal/client-portal";
import OfflineBanner from "@/components/offline/offline-banner";
import SyncStatusIndicator from "@/components/offline/sync-status-indicator";
import MobileBottomNav from "@/components/mobile/mobile-bottom-nav";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/components/providers/language-provider";
import type { Matter } from "@/lib/types";
import {
  saveItemsToOfflineStore,
  getAllFromOfflineStore,
  STORES,
} from "@/lib/offline-storage";
import {
  RefreshCw, Lock, FolderOpen, Plus, ChevronRight,
  AlertTriangle, Clock, FileText, Calendar, Sparkles,
  Briefcase, BarChart3,
} from "lucide-react";

// ── Valid workspace view keys (single source of truth in @/lib/navigation) ──

type AppView = "landing" | "workspace";

// =============================================================================
// FIX 1: URL STATE — parse & sync hash to React state
// =============================================================================
function parseHash(): { view: WorkspaceView; matterId: string; mode: "Lawyer" | "Client" } {
  if (typeof window === "undefined") return { view: "overview", matterId: "", mode: "Lawyer" };
  const hash = window.location.hash.replace("#", "");
  if (!hash) return { view: "overview", matterId: "", mode: "Lawyer" };

  const parts = hash.split("/");
  const rawView = parts[0] as WorkspaceView;
  const rawMatter = parts[1] || "";
  const rawMode = (parts[2] as "Lawyer" | "Client") || "Lawyer";

  return {
    view: WORKSPACE_VIEWS.includes(rawView) ? rawView : "overview",
    matterId: rawMatter,
    mode: rawMode === "Client" ? "Client" : "Lawyer",
  };
}

function buildHash(view: WorkspaceView, matterId: string, mode: "Lawyer" | "Client"): string {
  return `#${view}/${matterId}/${mode}`;
}

// =============================================================================
// FIX 5: TRIAGE DASHBOARD — "What needs you today"
// =============================================================================
function TriageDashboard({ matter }: { matter: Matter }) {
  const { isRtl } = useLanguage();
  const today = new Date().toLocaleDateString(isRtl ? "ar-JO" : "en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const budgetUsed = matter.budget > 0
    ? Math.round((matter.expenses / matter.budget) * 100)
    : 0;
  const isBudgetAlert = budgetUsed > 85;
  const isHighRisk = matter.riskLevel === "High";
  const hasImpendingDeadline = matter.statuteDeadline && new Date(matter.statuteDeadline) < new Date(Date.now() + 14 * 86400000);

  return (
    <div className="space-y-6">
      {/* Greeting banner */}
      <div className="rounded-xl bg-primary/5 border border-primary/10 p-5">
        <h2 className="text-base font-bold mb-1">
          {isRtl ? `ملخص قضية: ${matter.title}` : `Case Summary: ${matter.title}`}
        </h2>
        <p className="text-xs text-muted-foreground">{today}</p>
      </div>

      {/* Triage cards — 3 things that need attention */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Risk & Deadlines */}
        <div className={`rounded-xl border p-5 bg-card ${
          (isHighRisk || hasImpendingDeadline) ? 'border-destructive/40' : 'border-border'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              (isHighRisk || hasImpendingDeadline)
                ? 'bg-destructive/10 text-destructive'
                : 'bg-emerald-50 text-emerald-600'
            }`}>
              {(isHighRisk || hasImpendingDeadline) ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
            </div>
            <h3 className="text-sm font-bold">
              {isRtl ? 'السلامة القضائية' : 'Case Health'}
            </h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{isRtl ? 'مستوى المخاطر' : 'Risk Level'}</span>
              <span className={`font-bold ${isHighRisk ? 'text-destructive' : 'text-emerald-600'}`}>
                {isHighRisk ? (isRtl ? 'مرتفع' : 'High') : matter.riskLevel}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{isRtl ? 'احتمالية الفوز' : 'Win Probability'}</span>
              <span className="font-bold">{matter.winProbability}%</span>
            </div>
            {matter.statuteDeadline && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{isRtl ? 'تقادم الدعوى' : 'Statute Deadline'}</span>
                <span className={`font-bold ${hasImpendingDeadline ? 'text-destructive' : ''}`}>
                  {new Date(matter.statuteDeadline).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Budget */}
        <div className={`rounded-xl border p-5 bg-card ${
          isBudgetAlert ? 'border-amber-400/50' : 'border-border'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              isBudgetAlert ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold">{isRtl ? 'الميزانية' : 'Budget'}</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{isRtl ? 'المصروف' : 'Expenses'}</span>
              <span className="font-bold">{matter.expenses.toLocaleString()} {isRtl ? 'د.أ' : 'JOD'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{isRtl ? 'المتبقي' : 'Remaining'}</span>
              <span className="font-bold">{(matter.budget - matter.expenses).toLocaleString()} {isRtl ? 'د.أ' : 'JOD'}</span>
            </div>
            {/* Budget bar */}
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isBudgetAlert ? 'bg-amber-500' : budgetUsed > 60 ? 'bg-primary' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(budgetUsed, 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground text-right">
              {budgetUsed}% {isRtl ? 'مستهلك' : 'used'}
            </div>
          </div>
        </div>

        {/* Card 3: Quick Actions */}
        <div className="rounded-xl border border-border p-5 bg-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold">{isRtl ? 'إجراءات سريعة' : 'Quick Actions'}</h3>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('mobile-tab-changed', { detail: 'docs' }))}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent/50 hover:bg-accent transition-colors cursor-pointer text-left rtl:text-right"
            >
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold flex-1">
                {isRtl ? 'رفع مستند جديد' : 'Upload Document'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground rtl:rotate-180" />
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('mobile-tab-changed', { detail: 'tasks' }))}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent/50 hover:bg-accent transition-colors cursor-pointer text-left rtl:text-right"
            >
              <Briefcase className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold flex-1">
                {isRtl ? 'إدارة المهام' : 'Manage Tasks'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground rtl:rotate-180" />
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('mobile-tab-changed', { detail: 'calendar' }))}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent/50 hover:bg-accent transition-colors cursor-pointer text-left rtl:text-right"
            >
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold flex-1">
                {isRtl ? 'عرض التقويم' : 'View Calendar'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// CheckCircle icon (used in triage)
// =============================================================================
function CheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================
export default function Page() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { t, isRtl } = useLanguage();

  const [view, setView] = useState<AppView>("landing");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [mode, setMode] = useState<"Lawyer" | "Client">("Lawyer");

  const [matters, setMatters] = useState<Matter[]>([]);
  const [activeMatterId, setActiveMatterId] = useState<string>("");
  const [mattersLoading, setMattersLoading] = useState(true);
  const [activeView, setActiveView] = useState<WorkspaceView>("overview");

  // FIX 1: Track if state was restored from URL
  const urlRestored = useRef(false);

  const fetchMatters = useCallback(async () => {
    setMattersLoading(true);
    try {
      const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (!isOffline) {
        try {
          const res = await fetch("/api/matters", { cache: "no-store" });
          if (res.ok) {
            const raw = await res.json();
            const data: Matter[] = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
            setMatters(data);
            if (data.length > 0) {
              await saveItemsToOfflineStore(STORES.MATTERS, data);
              // Only auto-select if no URL state
              if (!urlRestored.current) {
                setActiveMatterId((prev) => prev || data[0].id);
              }
            }
            return;
          }
        } catch (err) {
          console.warn("Matters fetch failed; falling back to offline cache:", err);
        }
      }
      const cached = await getAllFromOfflineStore<Matter>(STORES.MATTERS);
      if (cached && cached.length > 0) {
        setMatters(cached);
        if (!urlRestored.current) {
          setActiveMatterId((prev) => prev || cached[0].id);
        }
      } else {
        setMatters([]);
      }
    } catch (err) {
      console.error("Failed to fetch matters:", err);
    } finally {
      setMattersLoading(false);
    }
  }, []);

  // ── FIX 1: Sync URL hash ↔ React state ──
  // Write hash whenever state changes (but not during initial URL restore)
  useEffect(() => {
    if (view !== "workspace" || !activeMatterId) return;
    if (urlRestored.current) {
      window.history.replaceState(null, "", buildHash(activeView, activeMatterId, mode));
    }
  }, [activeView, activeMatterId, mode, view]);

  // Read hash on mount and on popstate (back/forward)
  useEffect(() => {
    if (view !== "workspace") return;

    const applyUrlState = () => {
      const { view: urlView, matterId, mode: urlMode } = parseHash();
      if (urlView) setActiveView(urlView);
      if (matterId) setActiveMatterId(matterId);
      if (urlMode) setMode(urlMode);
      urlRestored.current = true;
    };

    // Initial restore
    if (!urlRestored.current) applyUrlState();

    // Back/forward navigation
    const handlePopState = () => applyUrlState();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [view]);

  // Mobile tab events (used by triage quick actions + global search results)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string | undefined;
      if (!detail) return;
      // Map legacy/alias tab names to the unified workspace views. Every
      // view id is also accepted directly so mobile + desktop stay in sync.
      const tabMap: Record<string, WorkspaceView> = {
        all: "overview",
        analytics: "overview",
        overview: "overview",
        tasks: "matter",
        matter: "matter",
        docs: "documents",
        documents: "documents",
        calendar: "calendar",
        ai: "ai",
        warroom: "warroom",
        billing: "billing",
        investigation: "investigation",
      };
      setActiveView(tabMap[detail] ?? "overview");
    };
    window.addEventListener("mobile-tab-changed", handler);
    return () => window.removeEventListener("mobile-tab-changed", handler);
  }, []);

  // Auto-enter workspace when authenticated
  useEffect(() => {
    if (isAuthenticated && view === "landing") {
      setView("workspace");
    }
  }, [isAuthenticated, view]);

  // Fetch matters when workspace is active
  useEffect(() => {
    if (view === "workspace" && isAuthenticated) {
      fetchMatters();
    }
  }, [view, isAuthenticated, fetchMatters]);

  // Refresh matters after offline sync
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      if (view === "workspace" && isAuthenticated) fetchMatters();
    };
    window.addEventListener("almizan:sync-complete", handler);
    return () => window.removeEventListener("almizan:sync-complete", handler);
  }, [view, isAuthenticated, fetchMatters]);

  // ----- LANDING VIEW -----
  if (view === "landing" && !isAuthenticated) {
    return (
      <>
        <LandingPage
          onEnterWorkspace={() => {
            if (isAuthenticated) { setMode("Lawyer"); setView("workspace"); }
            else { setAuthMode("signin"); setAuthOpen(true); }
          }}
          onEnterClientPortal={() => {
            if (isAuthenticated) { setMode("Client"); setView("workspace"); }
            else { setAuthMode("signin"); setAuthOpen(true); }
          }}
        />
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode}
          onSuccess={() => { setMode("Lawyer"); setView("workspace"); }} />
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
            <h2 className="text-xl font-extrabold">{isRtl ? "يجب تسجيل الدخول" : "Authentication required"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isRtl ? "يرجى تسجيل الدخول أو إنشاء حساب." : "Please sign in or create an account."}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setAuthMode("signin"); setAuthOpen(true); }}
              className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow hover:opacity-90 transition cursor-pointer">
              {isRtl ? "تسجيل الدخول" : "Sign In"}
            </button>
            <button onClick={() => { setAuthMode("signup"); setAuthOpen(true); }}
              className="px-5 py-2.5 bg-secondary text-secondary-foreground font-bold text-xs rounded-xl border border-border hover:bg-accent transition cursor-pointer">
              {isRtl ? "إنشاء حساب" : "Register"}
            </button>
          </div>
        </div>
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode}
          onSuccess={() => setView("workspace")} />
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
  const handleRefreshMatter = () => fetchMatters();

  const activeMatter = matters.find((m) => m.id === activeMatterId);

  // FIX 4: Client mode → completely different layout, no sidebar
  const isClientMode = mode === "Client";

  // FIX 3: If no matter selected, show matter picker as THE entry point
  if (!activeMatter && matters.length > 0 && !mattersLoading) {
    // Auto-select first matter (shouldn't happen, but safety net)
    setActiveMatterId(matters[0].id);
  }

  return (
    <>
      <OfflineBanner />
      <div className="app-theme-wrapper min-h-screen text-foreground flex flex-col overflow-hidden">

        {/* ── MOBILE BOTTOM NAV (hidden on desktop, sidebar handles desktop) ── */}
        {view === "workspace" && !isClientMode && activeMatter && (
          <MobileBottomNav
            currentMode={mode}
            onModeChange={setMode}
            activeView={activeView}
            onViewChange={setActiveView}
            unreadNotificationsCount={0}
            onOpenNotifications={() => {}}
            onOpenSearch={() => window.dispatchEvent(new CustomEvent('open-search-modal'))}
            onOpenNewMatterModal={() => window.dispatchEvent(new CustomEvent('open-new-matter-modal'))}
            matters={matters}
            activeMatterId={activeMatterId}
            onActiveMatterChange={setActiveMatterId}
          />
        )}

        {/* ── TOP HEADER BAR ── */}
        <Header
          currentMode={mode}
          onModeChange={(m) => setMode(m)}
          matters={matters}
          activeMatterId={activeMatterId}
          onActiveMatterChange={(id) => setActiveMatterId(id)}
          onNewMatterCreated={handleNewMatterCreated}
          onShowLandingPage={() => setView("landing")}
        />

        {/* ── MAIN LAYOUT ── */}
        {activeMatter ? (
          isClientMode ? (
            /* ================================================================
               FIX 4: CLIENT PORTAL — full-width, no sidebar, no internal tools
               ================================================================ */
            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
              <div className="max-w-4xl mx-auto page-enter">
                {/* Client header banner */}
                <div className="flex items-center gap-3 mb-6 p-4 bg-primary/5 border border-primary/10 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-sm font-bold truncate">{activeMatter.title}</h1>
                    <p className="text-xs text-muted-foreground">{activeMatter.clientName}</p>
                  </div>
                </div>
                <ClientPortal activeMatter={activeMatter} onRefreshMatter={handleRefreshMatter} />
              </div>
            </main>
          ) : (
            /* ================================================================
               LAWYER WORKSPACE — sidebar + content
               ================================================================ */
            <div className="flex flex-1 overflow-hidden">
              <WorkspaceSidebar
                activeView={activeView}
                onViewChange={setActiveView}
                matters={matters}
                activeMatterId={activeMatterId}
                onActiveMatterChange={(id) => setActiveMatterId(id)}
                user={user}
                onLogout={logout}
                currentMode={mode}
                onModeChange={setMode}
              />

              <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
                <div className="max-w-7xl mx-auto page-enter" key={activeView}>

                  {/* FIX 5: Overview = triage dashboard, not analytics graphs */}
                  {activeView === "overview" && (
                    <>
                      <TriageDashboard matter={activeMatter} />
                      <div className="mt-6">
                        <AnalyticsModule activeMatter={activeMatter} />
                      </div>
                    </>
                  )}

                  {activeView === "matter" && (
                    <div>
                      {/* Clear page-level label: this view holds BOTH the case
                          profile AND the tasks/kanban for the active matter. */}
                      <div className="flex items-center gap-2 mb-1">
                        <Briefcase className="w-4 h-4 text-primary shrink-0" />
                        <h2 className="text-base font-bold">
                          {isRtl ? "ملف القضية والمهام" : "Case Profile & Tasks"}
                        </h2>
                      </div>
                      <p className="text-xs text-muted-foreground mb-5">
                        {isRtl
                          ? "الملف التعريفي للقضية والمهام المترتبة عليها (كانبان) في مكان واحد."
                          : "Manage the case profile and its tasks/kanban in one place."}
                      </p>
                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        <div className="xl:col-span-5">
                          <MattersModule activeMatter={activeMatter} onMatterUpdated={handleMatterUpdated} />
                        </div>
                        <div className="xl:col-span-7">
                          <TasksModule matterId={activeMatter.id} matters={matters} />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeView === "documents" && (
                    <DocumentsModule matterId={activeMatter.id} onRefreshExpenses={handleRefreshMatter} />
                  )}
                  {activeView === "calendar" && (
                    <CalendarModule matterId={activeMatter.id} matters={matters} />
                  )}
                  {activeView === "ai" && <AiModule activeMatter={activeMatter} />}
                  {activeView === "warroom" && <WarRoomModule activeMatter={activeMatter} />}
                  {activeView === "billing" && (
                    <BillingModule activeMatter={activeMatter} onRefreshMatter={handleRefreshMatter} />
                  )}
                  {activeView === "investigation" && <InvestigationModule activeMatter={activeMatter} />}
                </div>
              </main>
            </div>
          )
        ) : (
          /* ── FIX 3: MATTER SELECTOR AS ENTRY POINT ── */
          <div className="flex-1 flex items-center justify-center p-8">
            {mattersLoading ? (
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {isRtl ? "جاري تحميل القضايا..." : "Loading matters..."}
                </p>
              </div>
            ) : matters.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm max-w-md w-full">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                  <FolderOpen className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold mb-2">
                  {isRtl ? "ابدأ بأول قضية" : "Start Your First Case"}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  {isRtl
                    ? "أنشئ ملف قضية جديد لبدء العمل."
                    : "Create a new matter to get started."}
                </p>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-new-matter-modal"))}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold text-sm rounded-xl shadow hover:opacity-90 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {isRtl ? "إنشاء قضية جديدة" : "Create New Matter"}
                </button>
              </div>
            ) : (
              /* FIX 3: Matter picker grid — the FIRST thing you see, big and clear */
              <div className="w-full max-w-2xl">
                <div className="text-center mb-8">
                  <h2 className="text-xl font-bold mb-2">
                    {isRtl ? "اختر قضية للعمل عليها" : "Select a Case to Work On"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {isRtl
                      ? "اختر من قضاياك النشطة أدناه"
                      : "Pick from your active matters below"}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {matters.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setActiveMatterId(m.id)}
                      className="flex items-start gap-3 p-5 bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-accent/30 transition-all cursor-pointer text-left rtl:text-right group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{m.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{m.clientName}</div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            m.riskLevel === "High"
                              ? "bg-destructive/10 text-destructive"
                              : m.riskLevel === "Medium"
                                ? "bg-amber-50 text-amber-600"
                                : "bg-emerald-50 text-emerald-600"
                          }`}>
                            {m.riskLevel}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {m.jurisdiction}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-3 rtl:rotate-180" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── FOOTER ── (hidden on mobile when bottom nav is active) ── */}
        <footer className="border-t border-border px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center text-[10px] text-muted-foreground uppercase tracking-widest gap-2">
          <span>AL MIZAN LEGAL PRACTICE © 2026</span>
          <span className="text-center">BILINGUAL • MULTI-TENANT • RTL-READY</span>
          <div className="flex items-center gap-3">
            <SyncStatusIndicator />
            <span>v0.7.0</span>
          </div>
        </footer>
      </div>
    </>
  );
}
