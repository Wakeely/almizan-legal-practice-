"use client";

// =============================================================================
// Triage Dashboard — "What needs you today" for the active matter.
// Shows case health, budget, and quick actions. Extracted from the old SPA
// shell so it can live on the real /workspace/overview route.
// =============================================================================

import { useLanguage } from "@/components/providers/language-provider";
import type { Matter } from "@/lib/types";
import {
  AlertTriangle,
  BarChart3,
  Sparkles,
  FileText,
  Calendar,
  Briefcase,
  ChevronRight,
} from "lucide-react";

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export default function TriageDashboard({ matter }: { matter: Matter }) {
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
