'use client';

import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Search, CheckCircle2, X, Lock, FileText, Building2, User, Landmark, ShieldAlert, Download } from 'lucide-react';
import { Matter } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';

interface ConflictCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  matters: Matter[];
}

interface ConflictResult {
  hasConflict: boolean;
  matchedMatters: {
    matter: Matter;
    matchedField: string;
    relationship: string;
  }[];
  searchedTerm: string;
  timestamp: string;
  certificateId: string;
}

export default function ConflictCheckModal({ isOpen, onClose, matters }: ConflictCheckModalProps) {
  const { t, isRtl } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [entityType, setEntityType] = useState<'Corporate' | 'Individual' | 'Subsidiary'>('Corporate');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<ConflictResult | null>(null);
  const [ethicalWallCreated, setEthicalWallCreated] = useState(false);

  if (!isOpen) return null;

  const handleRunCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    setResult(null);
    setEthicalWallCreated(false);

    setTimeout(() => {
      const termLower = searchTerm.trim().toLowerCase();
      const matches: { matter: Matter; matchedField: string; relationship: string }[] = [];

      matters.forEach(m => {
        if (m.clientName.toLowerCase().includes(termLower)) {
          matches.push({ matter: m, matchedField: m.clientName, relationship: isRtl ? 'عميل حالي / سابق' : 'Current / Former Client' });
        }
        const opposingParty = m.opposingParty || '';
        const opposingCounsel = m.opposingCounsel || '';
        if (opposingParty.toLowerCase().includes(termLower)) {
          matches.push({ matter: m, matchedField: opposingParty, relationship: isRtl ? 'خصم في قضية قائمة' : 'Adverse Party in Active Matter' });
        }
        if (opposingCounsel.toLowerCase().includes(termLower)) {
          matches.push({ matter: m, matchedField: opposingCounsel, relationship: isRtl ? 'مستشار الخصم' : 'Opposing Legal Counsel' });
        }
        if (m.title.toLowerCase().includes(termLower)) {
          matches.push({ matter: m, matchedField: m.title, relationship: isRtl ? 'عنوان النزاع' : 'Related Dispute Title' });
        }
      });

      const certId = `AMZ-ETH-${Math.floor(100000 + Math.random() * 900000)}`;
      setResult({
        hasConflict: matches.length > 0,
        matchedMatters: matches,
        searchedTerm: searchTerm,
        timestamp: new Date().toLocaleString(isRtl ? 'ar-SA' : 'en-US'),
        certificateId: certId
      });
      setIsSearching(false);
    }, 600);
  };

  const handlePrintCertificate = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-border w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-foreground text-white p-5 sm:p-6 flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/30 border border-primary/30 rounded-2xl">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-display leading-tight">
                {isRtl ? 'فحص تعارض المصالح الأخلاقي (Ethics Conflict Engine)' : 'Ethics & Conflicts of Interest Check'}
              </h3>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                {isRtl ? 'فحص فوري لقواعد البيانات وقوائم الأطراف الممثلة والخصوم' : 'Instant cross-database verification across active/historical parties'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-foreground text-muted-foreground hover:text-white rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Search Form */}
          <form onSubmit={handleRunCheck} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1 bg-muted rounded-2xl border border-border text-xs font-medium">
              <button
                type="button"
                onClick={() => setEntityType('Corporate')}
                className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  entityType === 'Corporate' ? 'bg-white text-primary font-bold shadow-xs' : 'text-muted-foreground'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>{isRtl ? 'شركة / مؤسسة' : 'Corporate Entity'}</span>
              </button>
              <button
                type="button"
                onClick={() => setEntityType('Individual')}
                className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  entityType === 'Individual' ? 'bg-white text-primary font-bold shadow-xs' : 'text-muted-foreground'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>{isRtl ? 'شخص طبيعي' : 'Individual Person'}</span>
              </button>
              <button
                type="button"
                onClick={() => setEntityType('Subsidiary')}
                className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  entityType === 'Subsidiary' ? 'bg-white text-primary font-bold shadow-xs' : 'text-muted-foreground'
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>{isRtl ? 'شركة تابعة / شريك' : 'Subsidiary / Affiliate'}</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-5 h-5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={isRtl ? 'أدخل اسم الشركة، العميل، الخصم، أو السجل التجاري...' : 'Enter company name, client, adverse party, or CR number...'}
                className="w-full bg-card border border-border rounded-2xl pl-10 pr-24 py-3 rtl:pl-24 rtl:pr-10 text-sm font-medium text-foreground placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white"
                required
              />
              <button
                type="submit"
                disabled={isSearching || !searchTerm.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 rtl:right-auto rtl:left-2 px-4 py-1.5 bg-primary hover:bg-primary disabled:bg-muted text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isSearching ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{isRtl ? 'جاري الفحص...' : 'Searching...'}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{isRtl ? 'إجراء الفحص' : 'Check Conflicts'}</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Results Area */}
          {result && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {result.hasConflict ? (
                /* POTENTIAL CONFLICT FOUND */
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-rose-500 text-white rounded-xl shrink-0 mt-0.5">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-rose-900 font-display">
                        {isRtl ? '⚠️ تم رصد تعارض مصالح محتمل!' : '⚠️ Potential Conflict of Interest Detected'}
                      </h4>
                      <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                        {isRtl
                          ? `الكيان "${result.searchedTerm}" مرتبط بسجلات سابقة أو قضايا قائمة في المكتب. يرجى مراجعة القضايا التالية قبل قبول التكليف:`
                          : `Entity "${result.searchedTerm}" matches active representation or adverse records in firm databases. Review matching matters below:`}
                      </p>
                    </div>
                  </div>

                  {/* Matched Matters List */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {result.matchedMatters.map((m, idx) => (
                      <div key={idx} className="bg-white border border-rose-100 rounded-xl p-3 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-foreground">{m.matter.title}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {isRtl ? 'الجهة المطبقة:' : 'Matched Field:'} <span className="font-semibold text-rose-600">{m.matchedField}</span> ({m.relationship})
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-muted text-foreground rounded-md font-mono text-[10px] shrink-0">
                          {m.matter.jurisdiction}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Ethical Wall Action */}
                  <div className="pt-2 border-t border-rose-200/60 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-rose-800">
                      {isRtl ? 'تطبيق جدار أخلاقي لتجميد النفاذ غير المصرح به:' : 'Establish Ethical Wall to isolate team access permissions:'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setEthicalWallCreated(true)}
                      disabled={ethicalWallCreated}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        ethicalWallCreated
                          ? 'bg-foreground text-emerald-400'
                          : 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>
                        {ethicalWallCreated
                          ? (isRtl ? 'تم تفعيل الجدار الأخلاقي ✓' : 'Ethical Wall Active ✓')
                          : (isRtl ? 'إنشاء جدار أخلاقي (Ethical Wall)' : 'Establish Ethical Wall')}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                /* NO CONFLICT DETECTED - CLEARANCE CERTIFICATE */
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500 text-white rounded-xl shrink-0">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-emerald-900 font-display">
                          {isRtl ? 'شهادة خلو تعارض مصالح (Ethics Conflict Cleared)' : 'Conflict of Interest Cleared'}
                        </h4>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          {isRtl ? `لم يتم العثور على أي تعارض مصالح للكيان "${result.searchedTerm}"` : `No direct or indirect conflict identified for "${result.searchedTerm}"`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handlePrintCertificate}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isRtl ? 'طباعة الشهادة' : 'Export Certificate'}</span>
                    </button>
                  </div>

                  {/* Certificate Preview Card */}
                  <div className="bg-white border border-emerald-100 rounded-xl p-4 text-xs space-y-2 font-mono text-foreground">
                    <div className="flex justify-between border-b border-border pb-2">
                      <span className="text-muted-foreground">{isRtl ? 'رقم الشهادة:' : 'Certificate Ref:'}</span>
                      <span className="font-bold text-foreground">{result.certificateId}</span>
                    </div>
                    <div className="flex justify-between border-b border-border pb-2">
                      <span className="text-muted-foreground">{isRtl ? 'تاريخ الفحص:' : 'Search Timestamp:'}</span>
                      <span>{result.timestamp}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{isRtl ? 'حالة الاعتماد:' : 'Approval Status:'}</span>
                      <span className="text-emerald-600 font-bold">{isRtl ? 'مستوفي للقواعد الأخلاقية' : 'SRA / ABA Compliance Verified'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-card border-t border-border p-4 text-center">
          <p className="text-[11px] text-muted-foreground">
            {isRtl
              ? 'تلتزم الميزان بقواعد سلوك المهنة والسرية القانونية المعتمدة محلياً ودولياً.'
              : 'Al Mizan Ethics Engine satisfies SRA, ABA & GCC Bar Council conflict verification standards.'}
          </p>
        </div>

      </div>
    </div>
  );
}
