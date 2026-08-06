import {
  BarChart3,
  Briefcase,
  FileText,
  Calendar,
  Sparkles,
  Sword,
  Receipt,
  Search,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  SINGLE SOURCE OF TRUTH for the main workspace navigation.          */
/*                                                                     */
/*  Desktop sidebar, mobile bottom nav, and the mobile "More" drawer   */
/*  all derive from NAV_ITEMS / NAV_SECTIONS below, so every feature   */
/*  stays reachable everywhere and the lists cannot drift apart.       */
/* ------------------------------------------------------------------ */

export type WorkspaceView =
  | "overview"
  | "matter"
  | "documents"
  | "calendar"
  | "ai"
  | "warroom"
  | "billing"
  | "investigation";

export interface NavItem {
  id: WorkspaceView;
  labelAr: string;
  labelEn: string;
  icon: LucideIcon;
  /** Real App Router path for this view (e.g. "/workspace/matters"). */
  href: string;
}

/** Base path for the lawyer workspace route group. */
export const WORKSPACE_BASE = "/workspace";

/** Maps each WorkspaceView to its URL path segment (drives real routes). */
export const VIEW_PATHS: Readonly<Record<WorkspaceView, string>> = {
  overview: "overview",
  matter: "matters",
  documents: "documents",
  calendar: "calendar",
  ai: "ai",
  warroom: "war-room",
  billing: "billing",
  investigation: "investigation",
};

/** Inverse lookup: path segment → WorkspaceView (for highlighting the nav). */
export const VIEW_BY_PATH: Readonly<Record<string, WorkspaceView>> = Object.fromEntries(
  (Object.entries(VIEW_PATHS) as [WorkspaceView, string][]).map(([view, path]) => [path, view])
);

/**
 * Build a real workspace URL for a view, optionally carrying the active matter.
 * This is the single canonical way to navigate between workspace views.
 */
export function workspaceHref(view: WorkspaceView, matterId?: string): string {
  const base = `${WORKSPACE_BASE}/${VIEW_PATHS[view]}`;
  return matterId ? `${base}?matter=${encodeURIComponent(matterId)}` : base;
}

/**
 * Migrate a legacy hash URL (#view/matterId/mode) to a real App Router path so
 * old bookmarks and shared links keep working. Returns null when the hash does
 * not describe a valid workspace view (e.g. no hash at all).
 */
export function legacyHashToPath(hash: string): string | null {
  if (!hash || hash === "#") return null;
  const parts = hash.replace("#", "").split("/");
  const rawView = parts[0] as WorkspaceView;
  const matterId = parts[1] || "";
  const mode = parts[2] || "Lawyer";

  if (!WORKSPACE_VIEWS.includes(rawView)) return null;

  if (mode === "Client") {
    return matterId ? `/client-portal/matters/${matterId}` : "/client-portal";
  }
  return workspaceHref(rawView, matterId || undefined);
}

export interface NavSection {
  id: string;
  labelAr: string;
  labelEn: string;
  itemIds: WorkspaceView[];
}

/** Every valid workspace view key (used for URL hash validation too). */
export const WORKSPACE_VIEWS: WorkspaceView[] = [
  "overview",
  "matter",
  "documents",
  "calendar",
  "ai",
  "warroom",
  "billing",
  "investigation",
];

/** The canonical list of main navigation items. */
export const NAV_ITEMS: NavItem[] = [
  { id: "overview", labelAr: "نظرة عامة", labelEn: "Overview", icon: BarChart3, href: `${WORKSPACE_BASE}/overview` },
  { id: "matter", labelAr: "القضايا والمهام", labelEn: "Matters & Tasks", icon: Briefcase, href: `${WORKSPACE_BASE}/matters` },
  { id: "documents", labelAr: "المستندات", labelEn: "Documents", icon: FileText, href: `${WORKSPACE_BASE}/documents` },
  { id: "calendar", labelAr: "التقويم", labelEn: "Calendar", icon: Calendar, href: `${WORKSPACE_BASE}/calendar` },
  { id: "ai", labelAr: "مساعد الذكاء", labelEn: "AI Assistant", icon: Sparkles, href: `${WORKSPACE_BASE}/ai` },
  { id: "warroom", labelAr: "غرفة العمليات", labelEn: "War Room", icon: Sword, href: `${WORKSPACE_BASE}/war-room` },
  { id: "billing", labelAr: "الفواتير", labelEn: "Billing", icon: Receipt, href: `${WORKSPACE_BASE}/billing` },
  { id: "investigation", labelAr: "التحقيق", labelEn: "Investigation", icon: Search, href: `${WORKSPACE_BASE}/investigation` },
];

/** Grouped sections used by the desktop sidebar (items referenced by id). */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: "core",
    labelAr: "الرئيسية",
    labelEn: "Core",
    itemIds: ["overview", "matter"],
  },
  {
    id: "documents",
    labelAr: "المستندات",
    labelEn: "Documents",
    itemIds: ["documents"],
  },
  {
    id: "deadlines",
    labelAr: "المواعيد والتقويم",
    labelEn: "Calendar & Deadlines",
    itemIds: ["calendar"],
  },
  {
    id: "intelligence",
    labelAr: "الذكاء الاصطناعي والتحليل",
    labelEn: "AI & Analysis",
    itemIds: ["ai", "warroom", "investigation"],
  },
  {
    id: "financial",
    labelAr: "المالية",
    labelEn: "Financial",
    itemIds: ["billing"],
  },
];

/** Resolve a single nav item by id (throws on unknown ids to surface drift early). */
export function getNavItem(id: WorkspaceView): NavItem {
  const item = NAV_ITEMS.find((i) => i.id === id);
  if (!item) throw new Error(`Unknown navigation item: ${id}`);
  return item;
}
