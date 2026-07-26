'use client';

import React, { useState } from 'react';
import { Printer, X, FileText, Check, Copy, ZoomIn, ZoomOut, ShieldCheck, Scale, Download } from 'lucide-react';
import { Matter } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';
import { translateStaticText } from '@/lib/i18n';

interface RiskAnalysisResult {
  riskSummary: string;
  keyChallenges: string[];
  strategyRecommendations: string[];
  riskScore: number;
  winProbability: number;
}

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMatter: Matter | null;
  analysis?: RiskAnalysisResult | null;
}

export default function PrintPreviewModal({
  isOpen,
  onClose,
  activeMatter,
  analysis
}: PrintPreviewModalProps) {
  const { t, isRtl } = useLanguage();
  const [zoomScale, setZoomScale] = useState<number>(100);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen || !activeMatter) return null;

  const getRiskLabel = (level: string) => {
    if (level === 'High') return isRtl ? 'مرتفع' : 'High';
    if (level === 'Medium') return isRtl ? 'متوسط' : 'Medium';
    return isRtl ? 'منخفض' : 'Low';
  };

  const handleCopySummaryText = () => {
    const textToCopy = `
${isRtl ? 'ملخص ملف الدعوى المعتمد للمحكمة - وكيلي برو' : 'OFFICIAL COURTROOM CASE FILE DOCKET & SUMMARY - WAKEELY PRO'}
==================================================
${isRtl ? 'عنوان القضية:' : 'Matter Title:'} ${translateStaticText(activeMatter.title, isRtl)}
${isRtl ? 'اسم الموكل:' : 'Client Name:'} ${activeMatter.clientName}
${isRtl ? 'المحكمة المختصة:' : 'Jurisdiction Court:'} ${translateStaticText(activeMatter.jurisdiction, isRtl)} (${activeMatter.court || 'دبي / عمان'})
${isRtl ? 'القاضي الناظر:' : 'Presiding Judge:'} ${translateStaticText(activeMatter.judge, isRtl)}
${isRtl ? 'الميزانية / القيمة:' : 'Budget / Claim Value:'} ${activeMatter.budget.toLocaleString()} JOD
${isRtl ? 'مستوى المخاطرة:' : 'Risk Level:'} ${getRiskLabel(activeMatter.riskLevel)} (${activeMatter.winProbability}% ${isRtl ? 'نسبة النجاح' : 'Win Rate'})
${isRtl ? 'القيد الزمني:' : 'Statute Deadline:'} ${activeMatter.statuteDeadline || (isRtl ? 'مستمر' : 'Active')}

${isRtl ? 'الوقائع ومستندات الدعوى:' : 'Case Description & Statement:'}
${translateStaticText(activeMatter.description, isRtl)}

${analysis ? `
${isRtl ? 'التوجيهات والتوصيات الاستراتيجية:' : 'Strategic AI Directives:'}
- ${isRtl ? 'تقييم المخاطر:' : 'Risk Summary:'} ${analysis.riskSummary}
- ${isRtl ? 'التوصيات:' : 'Recommendations:'} ${analysis.strategyRecommendations.join('; ')}
` : ''}
==================================================
${isRtl ? 'تم التصدير عبر نظام وكيلي برو القانوني' : 'Generated via Al Mizan Legal OS'}
    `.trim();

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col justify-between items-center p-2 sm:p-4 md:p-6 overflow-hidden no-print animate-in fade-in duration-200">
      
      {/* Modal Control Bar (Floating Header) */}
      <div className="w-full max-w-5xl bg-gradient-to-r from-teal-950 via-teal-900 to-teal-950 border border-teal-800 text-white rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-wrap items-center justify-between gap-3 mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-800/80 border border-teal-600/60 flex items-center justify-center text-teal-200 shrink-0">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-white font-display">
                {isRtl ? 'معاينة طباعة ملخص القضية' : 'Print Preview — Case Summary Docket'}
              </h3>
              <span className="px-2.5 py-0.5 bg-teal-800 border border-teal-600 text-teal-100 text-[10px] font-mono font-extrabold rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-teal-300" />
                {isRtl ? 'جاهز للمحكمة (A4)' : 'A4 Court Format'}
              </span>
            </div>
            <p className="text-xs text-teal-100/90 font-medium">
              {isRtl
                ? 'راجع التنسيق الرسمي لملف الدعوى قبل إصدار أمر الطباعة الورقية'
                : 'Review the formatted official docket output prior to physical courtroom printing'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Zoom Controls */}
          <div className="hidden sm:flex items-center bg-slate-800 border border-slate-700 rounded-xl p-1 text-xs text-slate-300">
            <button
              onClick={() => setZoomScale(prev => Math.max(70, prev - 10))}
              className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title={isRtl ? 'تصغير المعاينة' : 'Zoom Out'}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono font-bold text-[11px] text-slate-200">{zoomScale}%</span>
            <button
              onClick={() => setZoomScale(prev => Math.min(130, prev + 10))}
              className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title={isRtl ? 'تكبير المعاينة' : 'Zoom In'}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Copy Text Summary Button */}
          <button
            type="button"
            onClick={handleCopySummaryText}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{copied ? (isRtl ? 'تم النسخ!' : 'Copied!') : (isRtl ? 'نسخ النص' : 'Copy Text')}</span>
          </button>

          {/* Primary Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isRtl ? 'تأكيد وإصدار امر الطباعة' : 'Confirm & Print Docket'}</span>
          </button>

          {/* Close Modal Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title={isRtl ? 'إغلاق المعاينة' : 'Close Preview'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable Document Paper Canvas Container (Scrollable Preview Window) */}
      <div className="w-full flex-grow overflow-y-auto custom-scrollbar flex justify-center p-2 sm:p-6 bg-slate-900/50 rounded-2xl border border-slate-800/80">
        <div 
          className="transition-transform duration-200 origin-top my-auto"
          style={{ transform: `scale(${zoomScale / 100})` }}
        >
          {/* Authentic A4 Paper Docket Record */}
          <div 
            className="print-only-court-summary w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 p-8 sm:p-12 shadow-2xl border-2 border-slate-900 font-sans mx-auto relative select-text"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {/* Watermark Stamp Background */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
              <Scale className="w-96 h-96 text-slate-900" />
            </div>

            {/* Official Court Docket Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end gap-4 relative z-10">
              <div>
                <div className="text-xl font-black text-slate-900 uppercase tracking-tight font-display">
                  {isRtl ? 'وكيلي برو للمحاماة والاستشارات القانونية' : 'WAKEELY PRO LEGAL OPERATING SYSTEM'}
                </div>
                <div className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5">
                  {isRtl ? 'ملخص ملف الدعوى المعتمد للمحكمة الموقرة' : 'OFFICIAL COURTROOM CASE FILE DOCKET & SUMMARY'}
                </div>
              </div>
              <div className="text-right text-xs text-slate-600 font-mono shrink-0">
                <div><strong>{isRtl ? 'التاريخ:' : 'Date:'}</strong> {new Date().toLocaleDateString()}</div>
                <div><strong>{isRtl ? 'رمز الملف:' : 'Docket ID:'}</strong> #{activeMatter.id}</div>
              </div>
            </div>

            {/* Case Primary Metadata Table */}
            <div className="mb-6 relative z-10">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 border-b border-slate-300 pb-1">
                {isRtl ? 'أولاً: بيانات ومعلومات الدعوى الأساسية' : 'I. Primary Case Identification Data'}
              </h4>
              <table className="w-full text-xs text-left border border-slate-800 border-collapse">
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
                    <td className="p-2.5">{translateStaticText(activeMatter.judge, isRtl)}</td>
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
            <div className="mb-6 relative z-10">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 border-b border-slate-300 pb-1">
                {isRtl ? 'ثانياً: ملخص الوقائع ومستندات الدعوى' : 'II. Case Description & Legal Claims Summary'}
              </h4>
              <div className="p-4 border border-slate-800 text-xs leading-relaxed font-serif bg-slate-50/50">
                {translateStaticText(activeMatter.description, isRtl)}
              </div>
            </div>

            {/* AI Directives & Strategy (if available) */}
            {analysis && (
              <div className="mb-6 relative z-10">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 border-b border-slate-300 pb-1">
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
            <div className="mt-12 pt-6 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-xs relative z-10">
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
            <div className="mt-8 text-[9px] text-slate-500 text-center border-t border-slate-200 pt-3 relative z-10">
              {isRtl
                ? 'مستند قانوني رسمي سري مخصص للتقديم أمام الهيئات القضائية والمحاكم المختصة. جميع الحقوق محفوظة لوكيلي برو © 2026'
                : 'Confidential courtroom docket. Privileged attorney-client communication prepared for judicial presentation. Al Mizan Legal OS © 2026'}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Footer Note */}
      <div className="w-full max-w-5xl text-center text-[11px] text-slate-400 pt-2 shrink-0">
        {isRtl
          ? 'تنبيه: سيقوم أمر الطباعة بإخفاء واجهة التطبيق التفاعلية تلقائياً وطباعة الورقة المعتمدة فقط.'
          : 'Note: Requesting print will automatically hide app controls and output only the certified A4 courtroom document.'}
      </div>
    </div>
  );
}
