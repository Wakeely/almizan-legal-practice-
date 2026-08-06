'use client';

import React, { useState } from 'react';
import { 
  Scale, Calendar, Sparkles, AlertTriangle, Clock, CheckCircle2, 
  ArrowRight, Landmark, RefreshCw, FileText, ShieldAlert, Plus, Layers
} from 'lucide-react';
import { Matter, CourtRuleDeadline } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';

interface CourtRulesCalendaringModuleProps {
  activeMatter: Matter;
  onDeadlinesAdded: () => void;
}

export default function CourtRulesCalendaringModule({ activeMatter, onDeadlinesAdded }: CourtRulesCalendaringModuleProps) {
  const { isRtl } = useLanguage();

  const [jurisdiction, setJurisdiction] = useState<string>(
    activeMatter.jurisdiction || 'UAE Civil Procedure Law (Federal Law No. 42 / 2022)'
  );
  const [triggerEvent, setTriggerEvent] = useState<string>('Service of Summons / Statement of Claim');
  const [triggerDate, setTriggerDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [bulkAdding, setBulkAdding] = useState<boolean>(false);
  const [addedSuccessMsg, setAddedSuccessMsg] = useState<string | null>(null);

  const [results, setResults] = useState<{
    calculatedDeadlines: CourtRuleDeadline[];
    proceduralAdvice: string;
    applicableCodeRef: string;
  } | null>(null);

  const handleCalculateDeadlines = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setLoading(true);
    setAddedSuccessMsg(null);
    try {
      const res = await fetch('/api/ai/calculate-court-deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matterId: activeMatter.id,
          jurisdictionRuleset: jurisdiction,
          triggeringEvent: triggerEvent,
          triggerDate: triggerDate,
          lang: isRtl ? 'ar' : 'en'
        })
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (err) {
      console.error("Court deadlines calculation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAddToCalendar = async () => {
    if (!results || !results.calculatedDeadlines || results.calculatedDeadlines.length === 0) return;

    setBulkAdding(true);
    try {
      const res = await fetch('/api/calendar/bulk-deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matterId: activeMatter.id,
          deadlines: results.calculatedDeadlines
        })
      });

      if (res.ok) {
        setAddedSuccessMsg(
          isRtl 
            ? `تمت إتاحة وجدولة ${results.calculatedDeadlines.length} مواعيد ومودل قانونية في تقويم القضية وقائمة المهام بنجاح!` 
            : `Successfully added ${results.calculatedDeadlines.length} court deadlines to matter calendar & tasks!`
        );
        onDeadlinesAdded();
        setTimeout(() => setAddedSuccessMsg(null), 5000);
      }
    } catch (err) {
      console.error("Bulk deadlines sync failed:", err);
    } finally {
      setBulkAdding(false);
    }
  };

  return (
    <div className="bg-white border border-border rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col gap-5">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800 shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-extrabold text-foreground font-display">
                {isRtl ? 'حاسبة المواعيد والمهل الإجرائية القضائية الآلية' : 'Automated Court Rules Calendaring Engine'}
              </h3>
              <span className="px-2.5 py-0.5 bg-teal-100 text-teal-900 border border-teal-300 text-[10px] font-bold rounded-full">
                {isRtl ? 'حساب نظامي دقيق' : 'Rules Engine'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              {isRtl 
                ? 'احتساب المهل القضائية، مواعيد الطعن بالاستئناف، ومدد الإفصاح وفقاً لقوانين الإجراءات المدنية والتجارية' 
                : 'Calculate court deadlines, appeal windows, and discovery cutoffs based on regional civil procedure rules'}
            </p>
          </div>
        </div>
      </div>

      {/* Input Parameters Box */}
      <form onSubmit={handleCalculateDeadlines} className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Jurisdiction Ruleset */}
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              {isRtl ? 'نظام وقانون الإجراءات القضائية:' : 'Jurisdiction / Court Ruleset:'}
            </label>
            <select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="w-full bg-white border border-border rounded-xl p-2.5 text-xs text-foreground font-medium focus:outline-none focus:border-teal-700"
            >
              <option value="UAE Civil Procedure Law (Federal Law No. 42 / 2022)">{isRtl ? 'قانون الإجراءات المدنية الإماراتي (قانون اتحادي ٤٢ / ٢٠٢٢)' : 'UAE Civil Procedure Law (Federal Law 42/2022)'}</option>
              <option value="Saudi Arabia Commercial Courts Law (Royal Decree M/93)">{isRtl ? 'نظام المحاكم التجارية السعودي (مرسوم ملكي م/٩٣)' : 'Saudi Commercial Courts Law (Royal Decree M/93)'}</option>
              <option value="DIFC Courts Rules (RDC 2014)">{isRtl ? 'قواعد محاكم مركز دبي المالي العالمي (DIFC RDC)' : 'DIFC Courts Rules (RDC 2014)'}</option>
              <option value="ADGM Courts Civil Evidence Rules">{isRtl ? 'قواعد محاكم سوق أبوظبي العالمي (ADGM Courts)' : 'ADGM Courts Rules'}</option>
              <option value="US Federal Rules of Civil Procedure (FRCP)">{isRtl ? 'القواعد الفيدرالية للإجراءات المدنية الأمريكية (FRCP)' : 'US Federal Rules of Civil Procedure (FRCP)'}</option>
            </select>
          </div>

          {/* Triggering Procedural Event */}
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              {isRtl ? 'الحدث الإجرائي المنشئ للميعاد:' : 'Triggering Court Event:'}
            </label>
            <select
              value={triggerEvent}
              onChange={(e) => setTriggerEvent(e.target.value)}
              className="w-full bg-white border border-border rounded-xl p-2.5 text-xs text-foreground font-medium focus:outline-none focus:border-teal-700"
            >
              <option value="Service of Summons / Statement of Claim">{isRtl ? 'إعلان صحيفة الدعوى / لائحة الادعاء' : 'Service of Summons / Statement of Claim'}</option>
              <option value="Filing / Service of Statement of Defense">{isRtl ? 'إيداع المذكرة الجوابية / دفاع الخصم' : 'Service of Statement of Defense'}</option>
              <option value="Expert Report Issued by Judicial Master">{isRtl ? 'إيداع تقرير الخبير القضائي في الدعوى' : 'Expert Report Issued by Court Master'}</option>
              <option value="First Instance Judgment Pronounced">{isRtl ? 'صدور حكم أول درجة / منطوق الحكم' : 'First Instance Judgment Pronounced'}</option>
              <option value="Deposition Notice Received">{isRtl ? 'استلام إخطار استجواب الشاهد (Deposition Notice)' : 'Deposition Notice Received'}</option>
              <option value="Notice of Arbitration Under SCCA / LCIA">{isRtl ? 'قيد طلب التحكيم لدى SCCA / LCIA' : 'Notice of Arbitration Under SCCA / LCIA'}</option>
            </select>
          </div>

          {/* Trigger Date */}
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              {isRtl ? 'تاريخ وقوع الحدث (Start Date):' : 'Trigger Date:'}
            </label>
            <input
              type="date"
              value={triggerDate}
              onChange={(e) => setTriggerDate(e.target.value)}
              className="w-full bg-white border border-border rounded-xl p-2.5 text-xs text-foreground font-mono font-bold focus:outline-none focus:border-teal-700"
            />
          </div>

        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-teal-800 hover:bg-teal-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {isRtl ? 'جاري احتساب المهل النظامية...' : 'Calculating Court Rules Deadlines...'}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {isRtl ? 'احتساب المهل والمواعيد النظامية' : 'Auto-Calculate Procedural Deadlines'}
              </>
            )}
          </button>
        </div>

      </form>

      {/* Success Notification */}
      {addedSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{addedSuccessMsg}</span>
        </div>
      )}

      {/* Results View */}
      {results && (
        <div className="space-y-4 animate-in fade-in">
          
          {/* Header Advice Banner */}
          <div className="bg-gradient-to-r from-teal-950 via-teal-900 to-teal-950 border border-teal-800 text-white rounded-2xl p-4 shadow-md flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-teal-200 font-extrabold text-xs">
                <Scale className="w-4 h-4 text-teal-300" />
                {isRtl ? 'المرجعية النظامية واحتساب مدد المواعيد:' : 'Statutory Basis & Calculation Advice:'}
              </div>
              <span className="text-[10px] font-mono font-bold bg-teal-800 px-2.5 py-0.5 rounded-full text-teal-100">
                {results.applicableCodeRef || jurisdiction}
              </span>
            </div>
            <p className="text-xs text-teal-100/90 leading-relaxed font-medium">
              {results.proceduralAdvice}
            </p>
          </div>

          {/* Deadlines Timeline Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider font-display">
                {isRtl ? 'جدول المواعيد والمهل الإجرائية المستخرجة:' : 'Calculated Statutory Deadlines Schedule:'}
              </h4>
              <button
                type="button"
                onClick={handleBulkAddToCalendar}
                disabled={bulkAdding}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                {bulkAdding ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Layers className="w-3.5 h-3.5" />
                )}
                {isRtl ? 'جدولة كافة المواعيد تلقائياً في التقويم والمهام' : 'Bulk Add All Deadlines to Calendar & Tasks'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {results.calculatedDeadlines.map((d, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    d.priority === 'High' 
                      ? 'bg-rose-50/60 border-rose-200' 
                      : d.priority === 'Medium' 
                      ? 'bg-amber-50/60 border-amber-200' 
                      : 'bg-white border-border'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-foreground text-white font-mono font-extrabold text-[10px] rounded">
                        +{d.daysFromTrigger} {isRtl ? 'يوم' : 'Days'}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                        d.priority === 'High'
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}>
                        {d.priority} {isRtl ? 'أولوية' : 'Priority'}
                      </span>
                    </div>

                    <h5 className="text-xs font-extrabold text-foreground font-display">
                      {d.title}
                    </h5>

                    <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                      {d.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[11px] font-mono">
                    <span className="text-muted-foreground font-medium">
                      {isRtl ? 'النص والمادة:' : 'Ref:'} <strong className="text-foreground">{d.ruleReference}</strong>
                    </span>
                    <span className="text-teal-900 font-bold bg-teal-100/80 px-2 py-0.5 rounded">
                      {d.calculatedDate}
                    </span>
                  </div>
                </div>
              ))}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
