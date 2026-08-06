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
  { id: "overview", labelAr: "نظرة عامة", labelEn: "Overview", icon: BarChart3 },
  { id: "matter", labelAr: "القضايا والمهام", labelEn: "Matters & Tasks", icon: Briefcase },
  { id: "documents", labelAr: "المستندات", labelEn: "Documents", icon: FileText },
  { id: "calendar", labelAr: "التقويم", labelEn: "Calendar", icon: Calendar },
  { id: "ai", labelAr: "مساعد الذكاء", labelEn: "AI Assistant", icon: Sparkles },
  { id: "warroom", labelAr: "غرفة العمليات", labelEn: "War Room", icon: Sword },
  { id: "billing", labelAr: "الفواتير", labelEn: "Billing", icon: Receipt },
  { id: "investigation", labelAr: "التحقيق", labelEn: "Investigation", icon: Search },
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
