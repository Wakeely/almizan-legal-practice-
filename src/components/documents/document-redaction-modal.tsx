'use client';

import React, { useState } from 'react';
import { Shield, Scissors, Eye, EyeOff, Sparkles, Check, Download, Save, Trash2, X, FileText, AlertTriangle, Lock, RefreshCw, ZoomIn, ZoomOut, Scale } from 'lucide-react';
import { Document } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';
import { translateStaticText } from '@/lib/i18n';

interface RedactionBox {
  id: string;
  textSnippet: string;
  reason: 'PII' | 'Financial' | 'Privileged' | 'TradeSecret';
  pageNumber: number;
  top: number; // percentage
  left: number; // percentage
  width: number; // percentage
  height: number; // percentage
}

interface DocumentRedactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
  onSaveRedactedDocument: (redactedDoc: Partial<Document>) => void;
}

export default function DocumentRedactionModal({
  isOpen,
  onClose,
  document,
  onSaveRedactedDocument
}: DocumentRedactionModalProps) {
  const { t, isRtl } = useLanguage();
  const [redactions, setRedactions] = useState<RedactionBox[]>([]);
  const [mode, setMode] = useState<'draft' | 'burn'>('draft');
  const [selectedReason, setSelectedReason] = useState<'PII' | 'Financial' | 'Privileged' | 'TradeSecret'>('Privileged');
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(100);

  if (!isOpen || !document) return null;

  // Sample Legal Text Blocks for Document Canvas Preview
  const sampleDocumentLines = [
    { page: 1, text: isRtl ? "جمهورية مصر العربية / المملكة الأردنية الهاشمية / دولة الإمارات العربية المتحدة" : "UNITED ARAB EMIRATES / HASHEMITE KINGDOM OF JORDAN — LEGAL DOCKET" },
    { page: 1, text: isRtl ? "محكمة دبي التجارية — لائحة دعوى تجارية رقم 2026/1049" : "DUBAI COMMERCIAL COURT — STATEMENT OF CLAIM CASE NO. 2026/1049" },
    { page: 1, text: isRtl ? `طرف الدعوى الأول (المدعي): ${document.uploadedBy.split('(')[0]} بالوكالة عن الموكل ${document.visibleToClient ? 'طارق الطاير' : 'السيد/ طارق عبد الله الطاير (رقم الهوية: 784-1988-3920192-1)'}` : `PLAINTIFF: Tariq Abdullah Al-Tayer (National ID CPR: 784-1988-3920192-1, Resident Address: Villa 14, Palm Jumeirah)` },
    { page: 1, text: isRtl ? "طرف الدعوى الثاني (المدعى عليه): هيئة الموانئ العالمية (المستشار القانوني: بيكر آند ماكنزي الشرق الأوسط)" : "DEFENDANT: Global Port Authority (Opposing Counsel: Baker & McKenzie Middle East)" },
    { page: 1, text: "------------------------------------------------------------------------------------------------" },
    { page: 1, text: isRtl ? "البند 14.2 (شرط التعويض المالي الجزائي والمستحقات المشروطة):" : "CLAUSE 14.2 (LIQUIDATED DAMAGES & FINANCIAL LIABILITIES):" },
    { page: 1, text: isRtl ? "يتعهد الطرف الثاني بدفع مبلغ تعويض قدره 15,000 دينار أردني عن كل يوم تأخير في إخلاء الحاويات، وتحويل المستحقات لحساب الأيبان المصرفي رقم AE830330000001294821001 بمصرف أبوظبي الإسلامي." : "The Defendant agrees to pay 15,000 JOD per calendar day of operational delay. All penalty payments shall be wired directly to IBAN AE830330000001294821001 at Abu Dhabi Islamic Bank." },
    { page: 1, text: isRtl ? "البند 18.1 (سرية الاتصالات الاستشارية والمحاضر المباشرة):" : "CLAUSE 18.1 (ATTORNEY-CLIENT PRIVILEGED COMMUNICATIONS & STRATEGY):" },
    { page: 1, text: isRtl ? "تعتبر جميع المراسلات المتبادلة بين الشريك المسئول وليد الغربلي والمحامية فرح الصباح سرية للغاية ومشمولة بالحماية القانونية ضد الإفصاح للمحكمة." : "All strategy notes exchanged between Senior Partner Walid Al-Gharaballi and Associate Farah Al-Sabah regarding early settlement limits are strictly confidential attorney-client privilege." },
    { page: 2, text: isRtl ? "الملاحق والشهادات (شهادة الشاهد السرية):" : "EXHIBITS & WITNESS TESTIMONY:" },
    { page: 2, text: isRtl ? "أدلى الشاهد خليل ناصر إبراهيم (رقم الهاتف: +971509823101) بشهادته بخصوص تعمد غلق بوابات الميناء بتاريخ 3 يوليو 2026." : "Witness Witness Khalil Nasser Ibrahim (Mobile: +971509823101) testified regarding deliberate gate closures on July 3, 2026." }
  ];

  // Auto-Redact AI Presets Handler
  const handleAutoRedactAI = (type: 'PII' | 'Financial' | 'Privileged' | 'All') => {
    let newItems: RedactionBox[] = [];

    if (type === 'PII' || type === 'All') {
      newItems.push({
        id: `r-pii-1`,
        textSnippet: isRtl ? 'رقم الهوية: 784-1988-3920192-1' : 'National ID CPR: 784-1988-3920192-1',
        reason: 'PII',
        pageNumber: 1,
        top: 24,
        left: 30,
        width: 45,
        height: 4
      });
      newItems.push({
        id: `r-pii-2`,
        textSnippet: isRtl ? 'الشاهد خليل ناصر إبراهيم (+971509823101)' : 'Witness Khalil Nasser Ibrahim (Mobile: +971509823101)',
        reason: 'PII',
        pageNumber: 2,
        top: 82,
        left: 20,
        width: 55,
        height: 5
      });
    }

    if (type === 'Financial' || type === 'All') {
      newItems.push({
        id: `r-fin-1`,
        textSnippet: isRtl ? '15,000 دينار أردني • IBAN AE830330000001294821001' : '15,000 JOD • IBAN AE830330000001294821001',
        reason: 'Financial',
        pageNumber: 1,
        top: 52,
        left: 15,
        width: 65,
        height: 5
      });
    }

    if (type === 'Privileged' || type === 'All') {
      newItems.push({
        id: `r-priv-1`,
        textSnippet: isRtl ? 'المراسلات بين الشريك وليد الغربلي والمحامية فرح الصباح' : 'Strategy notes exchanged between Partner Walid and Associate Farah',
        reason: 'Privileged',
        pageNumber: 1,
        top: 72,
        left: 10,
        width: 80,
        height: 6
      });
    }

    // Deduplicate
    setRedactions(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const filtered = newItems.filter(n => !existingIds.has(n.id));
      return [...prev, ...filtered];
    });

    setSuccessToast(
      isRtl
        ? `تم العثور على ${newItems.length} بيانات سرية وتنقيحها تلقائياً بواسطة خوارزمية جيمي`
        : `Auto-detected and redacted ${newItems.length} sensitive items via Gemini AI`
    );
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleAddManualRedaction = (snippet: string, top: number, left: number) => {
    const newBox: RedactionBox = {
      id: `r-${Date.now()}`,
      textSnippet: snippet,
      reason: selectedReason,
      pageNumber: 1,
      top,
      left,
      width: 40,
      height: 4.5
    };
    setRedactions(prev => [...prev, newBox]);
  };

  const handleRemoveRedaction = (id: string) => {
    setRedactions(prev => prev.filter(r => r.id !== id));
  };

  const handleSaveAndApply = async () => {
    setSaving(true);
    try {
      const redactedDocData: Partial<Document> = {
        name: document.name.includes('_REDACTED') ? document.name : document.name.replace(/\.[^/.]+$/, "") + "_REDACTED.pdf",
        isRedacted: true,
        redactionCount: redactions.length,
        version: document.version + 1,
        aiSummary: isRtl
          ? `نسخة منقحة رسمياً من المستند (${document.name}). تم طمس وإخفاء ${redactions.length} من البيانات الشخصية والمستحقات المباشرة والبنود السرية.`
          : `Officially redacted version of ${document.name}. Obscured ${redactions.length} privileged PII, financial, and attorney-client clauses.`
      };

      await onSaveRedactedDocument(redactedDocData);

      setSuccessToast(isRtl ? 'تم حفظ النسخة المنقحة بنجاح في مستودع القضية!' : 'Redacted document version saved to matter repository!');
      setTimeout(() => {
        setSuccessToast(null);
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getReasonLabel = (reason: RedactionBox['reason']) => {
    switch (reason) {
      case 'PII': return isRtl ? 'بيانات شخصية (PII)' : 'PII & ID';
      case 'Financial': return isRtl ? 'مبالغ مالية وسرية' : 'Financial / IBAN';
      case 'Privileged': return isRtl ? 'سرية المحامي والموكل' : 'Atty-Client Privilege';
      case 'TradeSecret': return isRtl ? 'سر تجاري ممتلك' : 'Trade Secret';
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-foreground/85 backdrop-blur-md flex flex-col justify-between items-center p-2 sm:p-4 md:p-6 overflow-hidden no-print animate-in fade-in duration-200">
      
      {/* Modal Control Bar (Header) */}
      <div className="w-full max-w-6xl bg-gradient-to-r from-teal-950 via-teal-900 to-teal-950 border border-teal-800 text-white rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-800/80 border border-teal-600/60 flex items-center justify-center text-teal-200 shrink-0">
            <Scissors className="w-5 h-5 text-teal-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-white font-display">
                {isRtl ? 'أداة تنقيح وطمس المستندات السرية' : 'Document Redaction & Blackout Canvas'}
              </h3>
              <span className="px-2.5 py-0.5 bg-rose-950/80 text-rose-200 border border-rose-500/40 text-[10px] font-mono font-extrabold rounded-full flex items-center gap-1">
                <Shield className="w-3 h-3 text-rose-300" />
                {redactions.length} {isRtl ? 'منطقة مطكوسة' : 'Redaction Blocks'}
              </span>
            </div>
            <p className="text-xs text-teal-100/90 font-medium">
              {translateStaticText(document.name, isRtl)} • {isRtl ? 'تحديد وإخفاء الهويات والمبالغ المالية قبل الإفصاح القضائي' : 'Obscure PII, financial figures, and attorney privileged notes prior to discovery filing'}
            </p>
          </div>
        </div>

        {/* Action Controls & Preset AI Redact Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* AI Auto-Redact Button Group */}
          <div className="flex items-center gap-1 bg-foreground p-1 rounded-xl border border-border text-xs">
            <span className="text-[10px] text-muted-foreground font-bold px-1.5 uppercase hidden xl:inline">
              <Sparkles className="w-3 h-3 text-amber-400 inline me-1" />
              {isRtl ? 'تنقيح ذكي:' : 'AI Presets:'}
            </span>
            <button
              type="button"
              onClick={() => handleAutoRedactAI('PII')}
              className="px-2 py-1 bg-foreground hover:bg-foreground/80 text-muted-foreground rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              title={isRtl ? 'طمس أرقام الهويات والجوازات والهواتف' : 'Redact National IDs, Passports & Phone numbers'}
            >
              🛡️ {isRtl ? 'الهويات' : 'PII'}
            </button>
            <button
              type="button"
              onClick={() => handleAutoRedactAI('Financial')}
              className="px-2 py-1 bg-foreground hover:bg-foreground/80 text-muted-foreground rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              title={isRtl ? 'طمس المبالغ المالية وحسابات الأيبان' : 'Redact JOD/AED amounts & IBAN numbers'}
            >
              💰 {isRtl ? 'المبالغ' : 'Financial'}
            </button>
            <button
              type="button"
              onClick={() => handleAutoRedactAI('Privileged')}
              className="px-2 py-1 bg-foreground hover:bg-foreground/80 text-muted-foreground rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              title={isRtl ? 'طمس مراسلات واستشارات المحامي السري' : 'Redact Attorney-Client strategy notes'}
            >
              ⚖️ {isRtl ? 'سرية المحامي' : 'Privileged'}
            </button>
            <button
              type="button"
              onClick={() => handleAutoRedactAI('All')}
              className="px-2.5 py-1 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer"
            >
              ⚡ {isRtl ? 'طمس شامل' : 'Redact All'}
            </button>
          </div>

          {/* Render Mode Toggle (Draft Review vs Solid Burn-In) */}
          <div className="flex items-center bg-foreground border border-border rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode('draft')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                mode === 'draft' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:text-muted-foreground'
              }`}
            >
              {isRtl ? 'معاينة المسودة' : 'Draft Mode'}
            </button>
            <button
              type="button"
              onClick={() => setMode('burn')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                mode === 'burn' ? 'bg-red-600 text-white shadow-xs' : 'text-muted-foreground hover:text-muted-foreground'
              }`}
            >
              {isRtl ? 'طمس نهائي دائم' : 'Solid Burn-In'}
            </button>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-white hover:bg-foreground rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Success Notification Toast */}
      {successToast && (
        <div className="w-full max-w-6xl my-2 bg-emerald-950 border border-emerald-500/40 text-emerald-200 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold">{successToast}</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono">Al Mizan Redaction Engine</span>
        </div>
      )}

      {/* Main Workspace: Left Side (Interactive Canvas) | Right Side (Redaction List & Reasons) */}
      <div className="w-full max-w-6xl flex-grow grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden my-2">
        
        {/* Left Hand Document Preview Canvas (2 Columns) */}
        <div className="lg:col-span-2 bg-foreground/60 border border-border rounded-2xl p-4 flex flex-col justify-between overflow-y-auto custom-scrollbar relative">
          
          {/* Zoom & Quick Manual Add Toolbar */}
          <div className="flex items-center justify-between bg-foreground/90 border border-border/80 rounded-xl px-3 py-2 text-xs text-muted-foreground mb-3 sticky top-0 z-20 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">{isRtl ? 'سبب الطمس اليدوي:' : 'Manual Reason:'}</span>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value as any)}
                className="bg-foreground border border-border text-muted-foreground text-xs rounded-lg px-2 py-1 font-bold focus:outline-none"
              >
                <option value="Privileged">{isRtl ? 'سرية المحامي والموكل' : 'Atty-Client Privilege'}</option>
                <option value="PII">{isRtl ? 'بيانات شخصية (PII)' : 'PII & ID'}</option>
                <option value="Financial">{isRtl ? 'سرية المبالغ والحسابات' : 'Financial / IBAN'}</option>
                <option value="TradeSecret">{isRtl ? 'أسرار تجارية' : 'Trade Secret'}</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomScale(prev => Math.max(80, prev - 10))}
                className="p-1 hover:bg-foreground rounded transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] font-bold">{zoomScale}%</span>
              <button
                type="button"
                onClick={() => setZoomScale(prev => Math.min(130, prev + 10))}
                className="p-1 hover:bg-foreground rounded transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Paper Canvas Container */}
          <div className="flex-grow flex justify-center items-start overflow-auto p-2">
            <div
              className="bg-white text-foreground shadow-2xl rounded-sm p-8 sm:p-10 w-full max-w-[210mm] border border-border relative transition-transform duration-200 origin-top font-serif select-text min-h-[500px]"
              style={{ transform: `scale(${zoomScale / 100})` }}
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              {/* Document Header Line */}
              <div className="border-b-2 border-slate-900 pb-3 mb-6 flex justify-between items-center text-xs font-mono">
                <span className="font-bold text-foreground">{document.name}</span>
                <span className="text-muted-foreground">{isRtl ? 'صفحة 1 من 2' : 'Page 1 of 2'}</span>
              </div>

              {/* Render Document Lines with Overlay Redaction Rectangles */}
              <div className="space-y-4 text-xs sm:text-sm leading-relaxed relative">
                {sampleDocumentLines.map((line, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleAddManualRedaction(line.text, idx * 8 + 10, 10)}
                    className="group relative cursor-crosshair hover:bg-amber-50/60 p-1 rounded transition-colors"
                    title={isRtl ? 'انقر لطمس السطر المباشر' : 'Click to apply manual blackout overlay on this line'}
                  >
                    <p className="text-foreground font-serif leading-relaxed">{line.text}</p>
                  </div>
                ))}

                {/* Render Active Redaction Box Overlays on Top of Document */}
                {redactions.map((red) => {
                  return (
                    <div
                      key={red.id}
                      style={{
                        position: 'absolute',
                        top: `${red.top}%`,
                        left: `${red.left}%`,
                        width: `${red.width}%`,
                        minHeight: '26px'
                      }}
                      className={`z-10 transition-all rounded p-1 flex items-center justify-between text-[10px] font-mono select-none ${
                        mode === 'burn'
                          ? 'bg-black text-black border border-black shadow-md'
                          : 'bg-black/90 text-amber-300 border-2 border-red-500 shadow-xl backdrop-blur-xs'
                      }`}
                    >
                      {mode === 'draft' ? (
                        <>
                          <div className="flex items-center gap-1 truncate font-bold">
                            <Lock className="w-3 h-3 text-red-400 shrink-0" />
                            <span className="truncate">[{getReasonLabel(red.reason)}]</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleRemoveRedaction(red.id); }}
                            className="p-0.5 hover:bg-red-900/60 text-red-300 rounded cursor-pointer shrink-0"
                            title={isRtl ? 'إزالة الطمس' : 'Remove Redaction'}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="text-black text-[8px] font-bold">████████████████████</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Watermark Notice */}
              <div className="mt-12 pt-4 border-t border-border text-[9px] text-muted-foreground text-center uppercase tracking-widest font-mono">
                {isRtl ? 'مستند مجهز للإفصاح القضائي • نظام وكيلي برو' : 'OFFICIAL COURT DISCOVERY REDACTION CANVAS • WAKEELY PRO LEGAL OS'}
              </div>
            </div>
          </div>
        </div>

        {/* Right Hand Sidebar: Active Redaction Inventory & Save Action Panel */}
        <div className="bg-foreground border border-border rounded-2xl p-4 flex flex-col justify-between text-white overflow-y-auto">
          <div>
            <div className="flex justify-between items-center border-b border-border pb-3 mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-display flex items-center gap-1.5">
                <Scissors className="w-4 h-4 text-red-400" />
                {isRtl ? 'قائمة المناطق المطموسة' : 'Redacted Entities Log'}
              </h4>
              <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                {redactions.length} {isRtl ? 'إخفاء' : 'Obscured'}
              </span>
            </div>

            {/* Redactions List */}
            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {redactions.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground space-y-2">
                  <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-xs font-bold">{isRtl ? 'لم يتم طمس أي بيانات بعد' : 'No redaction blocks applied yet'}</p>
                  <p className="text-[10px] text-muted-foreground max-w-[200px] mx-auto">
                    {isRtl
                      ? 'اضغط على أزرار التنقيح الذكي أعلاه أو انقر فوق أي سطر في المستند لإخفائه'
                      : 'Use AI auto-redact presets above or click any text line on the canvas to obscure'}
                  </p>
                </div>
              ) : (
                redactions.map((red) => (
                  <div
                    key={red.id}
                    className="p-2.5 bg-foreground/80 border border-border/80 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                          red.reason === 'PII' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                          red.reason === 'Financial' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                          'bg-red-500/20 text-red-300 border-red-500/30'
                        }`}>
                          {getReasonLabel(red.reason)}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-mono">P.{red.pageNumber}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate font-serif italic">
                        "{red.textSnippet}"
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveRedaction(red.id)}
                      className="p-1 text-muted-foreground hover:text-red-400 hover:bg-foreground rounded-lg transition-colors cursor-pointer shrink-0"
                      title={isRtl ? 'إلغاء هذا الطمس' : 'Remove Redaction'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action Buttons Panel */}
          <div className="border-t border-border pt-3 mt-4 space-y-2">
            <button
              type="button"
              onClick={handleSaveAndApply}
              disabled={saving || redactions.length === 0}
              className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all disabled:opacity-40 cursor-pointer"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isRtl ? 'حفظ المستند المنقح في الملف' : 'Save Redacted File to Matter'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleAutoRedactAI('All')}
              className="w-full py-2 bg-foreground hover:bg-foreground text-muted-foreground font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{isRtl ? 'إعادة التنقيح التلقائي بالكامل' : 'Re-run AI Auto Redact'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
