"use client";

// =============================================================================
// NewMatterModal — matter intake form. Opens in response to the
// 'open-new-matter-modal' custom event (fired by header "+", mobile nav, and
// the empty-state). Creates the matter via POST /api/matters then navigates to
// the Cases & Tasks view of the new matter.
// =============================================================================

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Scale } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import { useMatters } from "@/components/providers/matters-provider";
import { workspaceHref } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { JURISDICTION_LIST, type JurisdictionCode } from "@/lib/jurisdictions";
import type { Matter } from "@/lib/types";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors";
const labelCls = "text-xs font-semibold mb-1 block";

export default function NewMatterModal() {
  const { isRtl, t } = useLanguage();
  const router = useRouter();
  const { addMatter } = useMatters();

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    clientName: "",
    clientEmail: "",
    // Default to "" until /api/organization/jurisdiction resolves; the user
    // can still override per-matter using the dropdown.
    jurisdiction: "" as JurisdictionCode | "",
    opposingParty: "",
    opposingCounsel: "",
    judge: "",
    court: "",
    statuteOfLimitations: "",
    statuteDeadline: "",
    budget: "0",
    riskLevel: "Medium" as "High" | "Medium" | "Low",
  });

  // ── Pre-fill the matter's jurisdiction from the organization's default ──
  // Falls back to "OTHER" if the API call fails (offline, 401, etc.) so the
  // form still opens. The user can always pick a different country from the
  // dropdown — the override is a first-class UI affordance.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/organization/jurisdiction");
        if (!res.ok) return;
        const data = (await res.json()) as {
          current: { code: JurisdictionCode };
        };
        if (!cancelled && data.current?.code) {
          setForm((prev) =>
            prev.jurisdiction === "" ? { ...prev, jurisdiction: data.current.code } : prev,
          );
        }
      } catch {
        // Silent — non-blocking. The dropdown still shows "Other / Generic".
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const listener = () => setOpen(true);
    window.addEventListener("open-new-matter-modal", listener);
    return () => window.removeEventListener("open-new-matter-modal", listener);
  }, []);

  const close = () => {
    if (submitting) return;
    setOpen(false);
    setError(null);
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // Backend requires jurisdiction.min(2); canonical codes are 2-5
          // chars. The empty-string placeholder from before-org-fetch resolves
          // falls back to "OTHER" so the matter is still created.
          jurisdiction: form.jurisdiction || "OTHER",
          budget: form.budget === "" ? 0 : Number(form.budget),
          description: form.description || undefined,
          opposingParty: form.opposingParty || undefined,
          opposingCounsel: form.opposingCounsel || undefined,
          judge: form.judge || undefined,
          court: form.court || undefined,
          statuteOfLimitations: form.statuteOfLimitations || undefined,
          statuteDeadline: form.statuteDeadline || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to create matter" }));
        setError(err.error || "Failed to create matter.");
        return;
      }
      const matter: Matter = await res.json();
      addMatter(matter);
      setOpen(false);
      router.push(workspaceHref("matter", matter.id));
    } catch {
      setError(isRtl ? "حدث خطأ في الشبكة." : "A network error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">{t.newIntake}</h2>
              <p className="text-xs text-muted-foreground">
                {isRtl ? "أدخل تفاصيل القضية الجديدة" : "Enter the new matter details"}
              </p>
            </div>
          </div>
          <button onClick={close} className="p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls}>{t.matterTitle} *</label>
            <input className={inputCls} value={form.title} onChange={set("title")} />
          </div>

          <div>
            <label className={labelCls}>{t.clientName} *</label>
            <input className={inputCls} value={form.clientName} onChange={set("clientName")} />
          </div>
          <div>
            <label className={labelCls}>{t.clientEmail} *</label>
            <input type="email" className={inputCls} value={form.clientEmail} onChange={set("clientEmail")} />
          </div>
          <div>
            <label className={labelCls}>
              {t.jurisdictionMatterOverrideTitle}
              <span className="text-destructive"> *</span>
            </label>
            <select
              className={inputCls}
              value={form.jurisdiction}
              onChange={set("jurisdiction")}
            >
              {/* Placeholder while the org default is still being fetched */}
              {!form.jurisdiction && (
                <option value="">
                  {isRtl ? "جارٍ تحميل الاختصاص الافتراضي…" : "Loading default…"}
                </option>
              )}
              {JURISDICTION_LIST.map((info) => (
                <option key={info.code} value={info.code}>
                  {isRtl ? info.labelAr : info.labelEn}
                  {" — "}
                  {isRtl ? info.labelEn : info.labelAr}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-muted-foreground leading-snug">
              {t.jurisdictionMatterOverrideHelper}
            </p>
          </div>
          <div>
            <label className={labelCls}>{t.riskLevel}</label>
            <select className={inputCls} value={form.riskLevel} onChange={set("riskLevel")}>
              <option value="Low">{isRtl ? "منخفض" : "Low"}</option>
              <option value="Medium">{isRtl ? "متوسط" : "Medium"}</option>
              <option value="High">{isRtl ? "مرتفع" : "High"}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{t.opposingParty}</label>
            <input className={inputCls} value={form.opposingParty} onChange={set("opposingParty")} />
          </div>
          <div>
            <label className={labelCls}>{t.opposingCounsel}</label>
            <input className={inputCls} value={form.opposingCounsel} onChange={set("opposingCounsel")} />
          </div>
          <div>
            <label className={labelCls}>{t.judge}</label>
            <input className={inputCls} value={form.judge} onChange={set("judge")} />
          </div>
          <div>
            <label className={labelCls}>{isRtl ? "المحكمة" : "Court"}</label>
            <input className={inputCls} value={form.court} onChange={set("court")} />
          </div>
          <div>
            <label className={labelCls}>{t.budgetCap}</label>
            <input type="number" min="0" className={inputCls} value={form.budget} onChange={set("budget")} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>{isRtl ? "الوصف" : "Description"}</label>
            <textarea className={cn(inputCls, "min-h-[80px] resize-y")} value={form.description} onChange={set("description")} />
          </div>
        </div>

        {error && (
          <div className="px-5 pb-2">
            <div className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">{error}</div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button
            onClick={close}
            disabled={submitting}
            className="px-4 py-2 rounded-lg border border-border text-xs font-bold hover:bg-accent transition-colors cursor-pointer disabled:opacity-50"
          >
            {t.cancel}
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow hover:opacity-90 transition-colors cursor-pointer disabled:opacity-60"
          >
            {submitting && <Loader2Icon />}
            {isRtl ? "إنشاء القضية" : "Create Matter"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Loader2Icon() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}