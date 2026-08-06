"use client";

// =============================================================================
// Workspace status screens — loading, empty (no matters), and the matter
// picker. Shown by the workspace shell when no active matter can be rendered.
// =============================================================================

import {
  RefreshCw,
  FolderOpen,
  Plus,
  Briefcase,
  ChevronRight,
} from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import type { Matter } from "@/lib/types";

function openNewMatter() {
  window.dispatchEvent(new CustomEvent("open-new-matter-modal"));
}

export function WorkspaceLoading() {
  const { isRtl } = useLanguage();
  return (
    <div className="flex flex-col items-center gap-3">
      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">
        {isRtl ? "جاري تحميل القضايا..." : "Loading matters..."}
      </p>
    </div>
  );
}

export function WorkspaceEmpty() {
  const { isRtl } = useLanguage();
  return (
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
        onClick={openNewMatter}
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold text-sm rounded-xl shadow hover:opacity-90 transition cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        {isRtl ? "إنشاء قضية جديدة" : "Create New Matter"}
      </button>
    </div>
  );
}

export function WorkspaceMatterPicker({
  matters,
  onSelect,
}: {
  matters: Matter[];
  onSelect: (id: string) => void;
}) {
  const { isRtl } = useLanguage();
  return (
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
            onClick={() => onSelect(m.id)}
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
  );
}