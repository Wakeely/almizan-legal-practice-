'use client';

import React, { useState, useEffect } from 'react';
import { Landmark, Briefcase, TrendingUp, AlertTriangle, Scale, RefreshCw, Sparkles, CheckCircle2, Printer, FileText, Eye, DownloadCloud, Check, AlertCircle } from 'lucide-react';
import { Matter } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';
import { translateStaticText } from '@/lib/i18n';
import {
  makeMatterAvailableOffline,
  type MakeAvailableOfflineProgress,
} from '@/lib/make-matter-available-offline';
import PrintPreviewModal from '@/components/print/print-preview-modal';

interface MattersModuleProps {
  activeMatter: Matter;
  onMatterUpdated: (updated: Matter) => void;
}

interface RiskAnalysisResult {
  riskSummary: string;
  keyChallenges: string[];
  strategyRecommendations: string[];
  riskScore: number;
  winProbability: number;
}

export default function MattersModule({ activeMatter, onMatterUpdated }: MattersModuleProps) {
  const { t, isRtl } = useLanguage();
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<RiskAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);

  // --- Phase 4.12: "Make this matter available offline" ---
  const [cacheStatus, setCacheStatus] = useState<
    | { state: "idle" }
    | { state: "caching"; progress: MakeAvailableOfflineProgress | null }
    | { state: "done"; total: number }
    | { state: "failed"; error: string }
  >({ state: "idle" });

  const handleMakeAvailableOffline = async () => {
    setCacheStatus({ state: "caching", progress: null });
    const result = await makeMatterAvailableOffline(activeMatter.id, {
      includeBinaries: false, // metadata-only by default; binaries cached on download
      onProgress: (p) => setCacheStatus({ state: "caching", progress: p }),
    });
    if (result.ok) {
      const total =
        result.counts.tasks +
        result.counts.documents +
        result.counts.timeEntries +
        result.counts.invoices +
        result.counts.calendarEvents;
      setCacheStatus({ state: "done", total });
    } else {
      setCacheStatus({ state: "failed", error: result.error || "unknown" });
    }
  };

  useEffect(() => {
    const handleGlobalPrintPreview = () => {
      setShowPrintPreview(true);
    };
    window.addEventListener('open-print-preview', handleGlobalPrintPreview);
    return () => window.removeEventListener('open-print-preview', handleGlobalPrintPreview);
  }, []);

  // Reset offline-cache status when the active matter changes.
  useEffect(() => {
    setCacheStatus({ state: "idle" });
  }, [activeMatter.id]);

  const handlePrintCaseSummary = () => {
    setShowPrintPreview(true);
  };

  const handleRunAiAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/analyze-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matterId: activeMatter.id })
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
        // Sync win probability back to main app state
        onMatterUpdated({
          ...activeMatter,
          winProbability: data.winProbability
        });
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to analyze risk.");
      }
    } catch (err: any) {
      setError(err.message || "Network error occurred.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Localize risk label
  const getRiskLabel = (level: string) => {
    if (level === 'High') return isRtl ? 'مرتفع' : 'High';
    if (level === 'Medium') return isRtl ? 'متوسط' : 'Medium';
    return isRtl ? 'منخفض' : 'Low';
  };

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 shadow-sm flex flex-col h-full gap-3 sm:gap-5 no-print" id="matters-module">
        {/* Title & Metadata Header */}
      <div className="flex justify-between items-start border-b border-slate-100 pb-2.5 sm:pb-4 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <Scale className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.caseProfile}</span>
            <h3 className="text-base sm:text-lg font-bold text-slate-800 font-display leading-snug">{translateStaticText(activeMatter.title, isRtl)}</h3>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Print Courtroom Summary Button */}
          <button
            type="button"
            onClick={handlePrintCaseSummary}
            className="px-2.5 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer no-print shrink-0 border border-teal-700"
            title={isRtl ? 'طباعة ملف القضية المعتمد للمحكمة' : 'Print Official Courtroom Summary'}
          >
            <Printer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">{isRtl ? 'طباعة المحكمة' : 'Print Docket'}</span>
          </button>

          {/* Phase 4.12: "Make this matter available offline" */}
          <button
            type="button"
            onClick={handleMakeAvailableOffline}
            disabled={cacheStatus.state === "caching"}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer no-print shrink-0 border ${
              cacheStatus.state === "done"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : cacheStatus.state === "failed"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : cacheStatus.state === "caching"
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
            } disabled:opacity-70 disabled:cursor-wait`}
            title={t.offlineMakeAvailable}
          >
            {cacheStatus.state === "caching" ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : cacheStatus.state === "done" ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : cacheStatus.state === "failed" ? (
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <DownloadCloud className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="hidden sm:inline">
              {cacheStatus.state === "caching"
                ? cacheStatus.progress?.step
                  ? `${t.offlineMakeAvailableProgress} (${cacheStatus.progress.done}/${cacheStatus.progress.total})`
                  : t.offlineMakeAvailableProgress
                : cacheStatus.state === "done"
                  ? t.offlineMakeAvailableDone
                  : cacheStatus.state === "failed"
                    ? t.offlineMakeAvailableFailed
                    : t.offlineMakeAvailable}
            </span>
          </button>

          <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-bold uppercase rounded-xl tracking-wider ${
            activeMatter.riskLevel === 'High' ? 'bg-red-50 text-red-600 border border-red-100' :
            activeMatter.riskLevel === 'Medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
            'bg-emerald-50 text-emerald-600 border border-emerald-100'
          }`}>
            {getRiskLabel(activeMatter.riskLevel)} {t.riskLevel}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans bg-slate-50/50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100/60">
        {translateStaticText(activeMatter.description || '', isRtl)}
      </p>

      {/* Grid of Custom Fields (Bento-style inside component) */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <div className="bg-slate-50/30 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-100 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.jurisdiction}</span>
          <span className="text-xs font-semibold text-slate-700 mt-1 leading-normal">{translateStaticText(activeMatter.jurisdiction, isRtl)}</span>
        </div>
        
        <div className="bg-slate-50/30 p-3.5 rounded-2xl border border-slate-100 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.judge}</span>
          <span className="text-xs font-semibold text-slate-700 mt-1 leading-normal">{translateStaticText(activeMatter.judge || '', isRtl)}</span>
        </div>

        <div className="bg-slate-50/30 p-3.5 rounded-2xl border border-slate-100 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.opposingCounsel}</span>
          <span className="text-xs font-semibold text-slate-700 mt-1 leading-normal">{(activeMatter.opposingCounsel ? translateStaticText(activeMatter.opposingCounsel, isRtl) : null) || (isRtl ? 'لا يوجد خصم معلن' : 'None Declared')}</span>
        </div>

        <div className="bg-slate-50/30 p-3.5 rounded-2xl border border-slate-100 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.statuteDeadline}</span>
          <span className="text-xs font-semibold text-red-500 font-mono mt-1">{activeMatter.statuteDeadline || (isRtl ? 'غير محدد' : 'None Set')}</span>
        </div>
      </div>

      {/* Core Dynamic Stats: Budget and Success Rate */}
      <div className="grid grid-cols-2 gap-4 border-t border-b border-slate-100 py-4 my-2">
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">{t.budgetCap}</span>
          <span className="text-2xl font-bold text-slate-800 font-display mt-0.5 block">{activeMatter.budget.toLocaleString()} {isRtl ? 'د.أ' : 'JOD'}</span>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div 
              className="bg-indigo-500 h-1.5 rounded-full" 
              style={{ width: `${Math.min(100, (activeMatter.expenses / activeMatter.budget) * 100)}%` }} 
            />
          </div>
          <span className="text-[10px] font-medium text-slate-400 mt-1 block">{t.spent}: {activeMatter.expenses.toLocaleString()} {isRtl ? 'د.أ' : 'JOD'}</span>
        </div>

        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">{t.winProb}</span>
          <span className={`text-2xl font-bold font-display mt-0.5 block ${
            activeMatter.winProbability >= 70 ? 'text-emerald-500' :
            activeMatter.winProbability >= 50 ? 'text-amber-500' : 'text-red-500'
          }`}>{activeMatter.winProbability}%</span>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div 
              className={`h-1.5 rounded-full ${
                activeMatter.winProbability >= 70 ? 'bg-emerald-500' :
                activeMatter.winProbability >= 50 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${activeMatter.winProbability}%` }} 
            />
          </div>
          <span className="text-[10px] font-medium text-slate-400 mt-1 block">{t.aiStrategy}</span>
        </div>
      </div>

      {/* AI Risk Assessment Action Card */}
      <div className="bg-indigo-900 rounded-3xl p-5 text-white flex flex-col gap-3 relative overflow-hidden mt-auto">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-800/40 rounded-full blur-2xl pointer-events-none" />
        <div className="flex justify-between items-center z-10">
          <div className="flex items-center gap-1.5 text-indigo-200">
            <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
            <span className="text-xs font-bold uppercase tracking-widest">{t.sccaEngine}</span>
          </div>
          <button
            onClick={handleRunAiAnalysis}
            disabled={analyzing}
            className="px-3.5 py-1.5 bg-white text-indigo-900 rounded-xl text-xs font-bold shadow-md hover:bg-slate-50 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {analyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-900" /> : <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
            {t.analyzeBtn}
          </button>
        </div>

        <div>
          <h4 className="text-base font-bold font-display">{t.simulateTitle}</h4>
          <p className="text-xs text-indigo-100 mt-1 leading-relaxed">
            {t.simulateDesc}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-100 text-xs p-2.5 rounded-xl mt-1">
            {error}
          </div>
        )}

        {analysis && (
          <div className="bg-white/10 border border-white/15 p-4 rounded-2xl text-xs flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <span className="text-[10px] uppercase font-bold text-indigo-200 tracking-wider">{t.aiCoreFindings}</span>
              <p className="mt-1 leading-relaxed text-indigo-50">{analysis.riskSummary}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
              <div>
                <span className="text-[9px] uppercase font-bold text-indigo-200 block">{t.riskIndex}</span>
                <span className="text-base font-extrabold text-white">{analysis.riskScore}/100</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-indigo-200 block">{t.successRatio}</span>
                <span className="text-base font-extrabold text-emerald-300">{analysis.winProbability}%</span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10">
              <span className="text-[9px] uppercase font-bold text-indigo-200 block mb-1">{t.strategyDirectives}</span>
              <ul className="space-y-1 text-[11px] text-indigo-100">
                {analysis.strategyRecommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* ------------------------------------------------------------- */}
      {/* PHYSICAL COURTROOM RECORD - PRINTABLE DOCKET (A4 COURT LAYOUT) */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden print:block print-only-court-summary p-8 bg-white text-slate-900 border-2 border-slate-900 rounded-none font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Court Docket Official Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end">
          <div>
            <div className="text-xl font-black text-slate-900 uppercase tracking-tight">
              {isRtl ? 'وكيلي برو للمحاماة والاستشارات القانونية' : 'WAKEELY PRO LEGAL OPERATING SYSTEM'}
            </div>
            <div className="text-sm font-bold text-slate-700 mt-0.5">
              {isRtl ? 'ملخص ملف الدعوى المعتمد للمحكمة الموقرة' : 'OFFICIAL COURTROOM CASE FILE DOCKET & SUMMARY'}
            </div>
          </div>
          <div className="text-right rtl:text-left text-xs text-slate-600 font-mono">
            <div><strong>{isRtl ? 'التاريخ:' : 'Date:'}</strong> {new Date().toLocaleDateString()}</div>
            <div><strong>{isRtl ? 'رمز الملف:' : 'Docket ID:'}</strong> #{activeMatter.id}</div>
          </div>
        </div>

        {/* Case Primary Metadata Table */}
        <div className="mb-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 border-b border-slate-300 pb-1">
            {isRtl ? 'أولاً: بيانات ومعلومات الدعوى الأساسية' : 'I. Primary Case Identification Data'}
          </h4>
          <table className="w-full text-xs text-left rtl:text-right rtl:text-left border border-slate-800 border-collapse">
            <tbody>
              <tr className="border-b border-slate-800">
                <td className="p-2.5 font-bold bg-slate-100 border-r border-slate-800 w-1/4">{isRtl ? 'عنوان القضية' : 'Matter Title'}</td>
                <td className="p-2.5 font-bold text-slate-900">{translateStaticText(activeMatter.title, isRtl)}</td>
                <td className="p-2.5 font-bold bg-slate-100 border-r border-slate-800 border-l w-1/4">{isRtl ? 'اسم الموكل' : 'Client Name'}</td>
                <td className="p-2.5 font-bold text-slate-900">{activeMatter.clientName}</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="p-2.5 font-bold bg-slate-100 border-r border-slate-800">{isRtl ? 'المحكمة المختصة' : 'Jurisdiction Court'}</td>
                <td className="p-2.5">{translateStaticText(activeMatter.jurisdiction, isRtl)} ({activeMatter.court || 'دبي / عمان'})</td>
                <td className="p-2.5 font-bold bg-slate-100 border-r border-slate-800 border-l">{isRtl ? 'القاضي الناظر' : 'Presiding Judge'}</td>
                <td className="p-2.5">{translateStaticText(activeMatter.judge || '', isRtl)}</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="p-2.5 font-bold bg-slate-100 border-r border-slate-800">{isRtl ? 'محامي الخصم' : 'Opposing Counsel'}</td>
                <td className="p-2.5">{(activeMatter.opposingCounsel ? translateStaticText(activeMatter.opposingCounsel, isRtl) : null) || (isRtl ? 'غير محدد' : 'N/A')}</td>
                <td className="p-2.5 font-bold bg-slate-100 border-r border-slate-800 border-l">{isRtl ? 'القيد الزمني / التقادم' : 'Statute Deadline'}</td>
                <td className="p-2.5 font-mono font-bold text-slate-900">{activeMatter.statuteDeadline || (isRtl ? 'مستمر' : 'Active')}</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold bg-slate-100 border-r border-slate-800">{isRtl ? 'قيمة المطالبة / الميزانية' : 'Claim Value / Budget'}</td>
                <td className="p-2.5 font-bold font-mono">{activeMatter.budget.toLocaleString()} JOD</td>
                <td className="p-2.5 font-bold bg-slate-100 border-r border-slate-800 border-l">{isRtl ? 'مستوى المخاطرة / التوقع' : 'Risk & Win Rate'}</td>
                <td className="p-2.5 font-bold">{getRiskLabel(activeMatter.riskLevel)} ({activeMatter.winProbability}% {isRtl ? 'نسبة النجاح' : 'Win Rate'})</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Statement of Case Facts & Summary */}
        <div className="mb-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 border-b border-slate-300 pb-1">
            {isRtl ? 'ثانياً: ملخص الوقائع ومستندات الدعوى' : 'II. Case Description & Legal Claims Summary'}
          </h4>
          <div className="p-4 border border-slate-800 text-xs leading-relaxed font-serif bg-slate-50/50">
            {translateStaticText(activeMatter.description || '', isRtl)}
          </div>
        </div>

        {/* AI Directives & Strategy (if available) */}
        {analysis && (
          <div className="mb-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 border-b border-slate-300 pb-1">
              {isRtl ? 'ثالثاً: التوجيهات الاستراتيجية والتوصيات القانونية' : 'III. Certified Legal Directives & Recommendations'}
            </h4>
            <div className="p-3 border border-slate-800 text-xs leading-relaxed space-y-2">
              <p><strong>{isRtl ? 'ملخص التقييم:' : 'Risk Assessment:'}</strong> {analysis.riskSummary}</p>
              <div>
                <strong>{isRtl ? 'التوصيات الرئيسية:' : 'Strategic Steps:'}</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  {analysis.strategyRecommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Physical Courtroom Verification & Signature Block */}
        <div className="mt-12 pt-6 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-xs">
          <div className="text-center p-4 border border-dashed border-slate-400 rounded-lg">
            <div className="font-bold text-slate-800 mb-8">
              {isRtl ? 'توقيع المحامي الموكل وختم المكتب' : 'Lead Counsel Signature & Firm Seal'}
            </div>
            <div className="border-b border-slate-400 w-3/4 mx-auto mb-2" />
            <div className="text-[10px] text-slate-500">{isRtl ? 'المحامي المباشر للدعوى' : 'Advocate in Charge'}</div>
          </div>

          <div className="text-center p-4 border border-dashed border-slate-400 rounded-lg">
            <div className="font-bold text-slate-800 mb-8">
              {isRtl ? 'تأشيرة وتوقيع قلم كتاب المحكمة المختصة' : 'Court Registrar Reception & Docket Stamp'}
            </div>
            <div className="border-b border-slate-400 w-3/4 mx-auto mb-2" />
            <div className="text-[10px] text-slate-500">{isRtl ? 'سجل القضايا المعتمد' : 'Court Clerk Verification'}</div>
          </div>
        </div>

        {/* Confidentiality Notice */}
        <div className="mt-8 text-[9px] text-slate-500 text-center border-t border-slate-200 pt-3">
          {isRtl
            ? 'مستند قانوني رسمي سري مخصص للتقديم أمام الهيئات القضائية والمحاكم المختصة. جميع الحقوق محفوظة لوكيلي برو © 2026'
            : 'Confidential courtroom docket. Privileged attorney-client communication prepared for judicial presentation. Al Mizan Legal OS © 2026'}
        </div>
      </div>

      {/* Temporary Print Preview Modal Overlay */}
      <PrintPreviewModal
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        activeMatter={activeMatter}
        analysis={analysis}
      />
    </>
  );
}
