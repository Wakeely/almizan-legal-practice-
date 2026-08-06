"use client";

// =============================================================================
// WorkspaceShell — the layout chrome for the /workspace route group.
// Handles auth gating, the matters provider, and renders the desktop sidebar,
// mobile bottom nav, header, footer, and the new-matter modal around each view
// page. The active view is derived from the real URL path (single source of
// truth stays in @/lib/navigation).
// =============================================================================

import React, { useEffect, useCallback, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { RefreshCw, Lock } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/components/providers/language-provider";
import { MattersProvider, useMatters } from "@/components/providers/matters-provider";
import Header from "@/components/header/header";
import WorkspaceSidebar from "@/components/workspace/workspace-sidebar";
import MobileBottomNav from "@/components/mobile/mobile-bottom-nav";
import OfflineBanner from "@/components/offline/offline-banner";
import SyncStatusIndicator from "@/components/offline/sync-status-indicator";
import NewMatterModal from "@/components/workspace/new-matter-modal";
import HashRedirect from "@/components/workspace/hash-redirect";
import PromoBanner from "@/components/workspace/promo-banner";
import {
  WORKSPACE_BASE,
  VIEW_BY_PATH,
  workspaceHref,
  type WorkspaceView,
  WORKSPACE_VIEWS,
} from "@/lib/navigation";
import {
  WorkspaceLoading,
  WorkspaceEmpty,
  WorkspaceMatterPicker,
} from "@/components/workspace/workspace-status";

function AuthScreen({ lock }: { lock: boolean }) {
  const { isRtl } = useLanguage();
  if (!lock) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">
          {isRtl ? "جاري تحضير ملفات الميزان..." : "Initializing Al Mizan..."}
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

/** Derive the active WorkspaceView from the real pathname. */
function viewFromPath(pathname: string): WorkspaceView {
  const segment = pathname.replace(new RegExp(`^${WORKSPACE_BASE}`), "").split("/").filter(Boolean)[0];
  if (segment && segment in VIEW_BY_PATH) return VIEW_BY_PATH[segment];
  return "overview";
}

export default function WorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, isAuthenticated } = useAuth();
  const router = useRouter();

  // Read the ?matter= id from the URL client-side (the shell is client-only
  // anyway, and Next 16 layouts no longer receive searchParams). Deferred so
  // the state update is not a synchronous setState within the effect body.
  const [matterId, setMatterId] = useState<string>("");
  useEffect(() => {
    const t = setTimeout(() => {
      const q = new URLSearchParams(window.location.search).get("matter");
      if (q) setMatterId(q);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Gate on auth: redirect to the landing page when signed out.
  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/");
  }, [loading, isAuthenticated, router]);

  if (loading) return <AuthScreen lock={false} />;
  if (!isAuthenticated) return <AuthScreen lock={true} />;

  return (
    <MattersProvider initialMatterId={matterId}>
      <ShellInner>{children}</ShellInner>
    </MattersProvider>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const {
    matters,
    activeMatter,
    activeMatterId,
    setActiveMatterId,
    mattersLoading,
    refresh,
    updateMatter,
  } = useMatters();

  const activeView = viewFromPath(pathname);

  // Keep the ?matter= query param in sync with the active matter selection so
  // every view is deep-linkable for the current case.
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!activeMatterId || !activeMatter) return;
    if (!syncedRef.current) {
      syncedRef.current = true;
      return; // first run — URL already reflects the initial selection
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("matter") === activeMatterId) return;
    params.set("matter", activeMatterId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeMatterId, activeMatter, pathname, router]);

  const navigateToView = useCallback(
    (view: WorkspaceView) => {
      router.push(workspaceHref(view, activeMatterId));
    },
    [router, activeMatterId]
  );

  const handleModeChange = (mode: "Lawyer" | "Client") => {
    if (mode === "Client") {
      router.push(activeMatterId ? `/client-portal/matters/${activeMatterId}` : "/client-portal");
    }
  };

  const handleMatterChange = useCallback(
    (id: string) => {
      setActiveMatterId(id);
    },
    [setActiveMatterId]
  );

  // Route triage quick-actions / global-search results to the right view.
  useEffect(() => {
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
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string | undefined;
      if (!detail) return;
      const view = tabMap[detail];
      if (view && WORKSPACE_VIEWS.includes(view)) navigateToView(view);
    };
    window.addEventListener("mobile-tab-changed", handler);
    return () => window.removeEventListener("mobile-tab-changed", handler);
  }, [navigateToView]);

  return (
    <>
      <HashRedirect />
      <OfflineBanner />
      <div className="app-theme-wrapper min-h-screen text-foreground flex flex-col overflow-hidden">
        {activeMatter && (
          <MobileBottomNav
            currentMode="Lawyer"
            onModeChange={handleModeChange}
            activeView={activeView}
            onViewChange={navigateToView}
            unreadNotificationsCount={0}
            onOpenNotifications={() => {}}
            onOpenSearch={() => window.dispatchEvent(new CustomEvent("open-search-modal"))}
            onOpenNewMatterModal={() => window.dispatchEvent(new CustomEvent("open-new-matter-modal"))}
            matters={matters}
            activeMatterId={activeMatterId}
            onActiveMatterChange={handleMatterChange}
          />
        )}

        <Header
          currentMode="Lawyer"
          onModeChange={handleModeChange}
          matters={matters}
          activeMatterId={activeMatterId}
          onActiveMatterChange={handleMatterChange}
          onNewMatterCreated={() => {}}
          onShowLandingPage={() => router.push("/")}
        />

        <div className="flex flex-1 overflow-hidden">
          <WorkspaceSidebar
            activeView={activeView}
            onViewChange={navigateToView}
            matters={matters}
            activeMatterId={activeMatterId}
            onActiveMatterChange={handleMatterChange}
            user={user}
            onLogout={logout}
            currentMode="Lawyer"
            onModeChange={handleModeChange}
          />

          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
            <div className="max-w-7xl mx-auto page-enter" key={activeView}>
              <PromoBanner />
              {mattersLoading && !activeMatter ? (
                <div className="flex-1 flex items-center justify-center p-8">
                  <WorkspaceLoading />
                </div>
              ) : !mattersLoading && matters.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-8">
                  <WorkspaceEmpty />
                </div>
              ) : !mattersLoading && !activeMatter ? (
                <div className="flex-1 flex items-center justify-center p-8">
                  <WorkspaceMatterPicker matters={matters} onSelect={handleMatterChange} />
                </div>
              ) : (
                children
              )}
            </div>
          </main>
        </div>

        {/* Footer — hidden on mobile when bottom nav is active */}
        <footer className="border-t border-border px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center text-[10px] text-muted-foreground uppercase tracking-widest gap-2">
          <span>AL MIZAN LEGAL PRACTICE © 2026</span>
          <span className="text-center">BILINGUAL • MULTI-TENANT • RTL-READY</span>
          <div className="flex items-center gap-3">
            <SyncStatusIndicator />
            <span>v0.7.0</span>
          </div>
        </footer>
      </div>
      <NewMatterModal />
    </>
  );
}