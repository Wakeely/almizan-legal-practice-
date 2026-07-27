'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, Search, Sparkles, AlertCircle, Quote, CheckCircle2, 
  Upload, Filter, Bookmark, User, Clock, ChevronRight, HelpCircle, 
  Tag, RefreshCw, X, ShieldAlert, ArrowUpRight
} from 'lucide-react';
import { DepositionTranscript, TranscriptPage } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';
import { translateStaticText } from '@/lib/i18n';

interface DepositionIndexerModuleProps {
  matterId: string;
}

export default function DepositionIndexerModule({ matterId }: DepositionIndexerModuleProps) {
  const { isRtl } = useLanguage();
  const [transcripts, setTranscripts] = useState<DepositionTranscript[]>([]);
  const [activeTranscript, setActiveTranscript] = useState<DepositionTranscript | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [aiSearching, setAiSearching] = useState<boolean>(false);
  
  // AI Results
  const [aiResults, setAiResults] = useState<{
    matches: Array<{
      pageNumber: number;
      lineNumber: string;
      quote: string;
      relevanceExplanation: string;
      isAdmission: boolean;
    }>;
    keyAdmissionsSummary: string;
    suggestedCrossExamQuestions: string[];
  } | null>(null);

  // New Transcript Upload Modal
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [newWitnessName, setNewWitnessName] = useState<string>('');
  const [newWitnessRole, setNewWitnessRole] = useState<string>('');
  const [newDeponentParty, setNewDeponentParty] = useState<'Fact Witness' | 'Expert Witness' | 'Adverse Party' | 'Client Corporate Representative'>('Adverse Party');
  const [newDepoDate, setNewDepoDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [rawTranscriptText, setRawTranscriptText] = useState<string>('');

  const fetchTranscripts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/matters/${matterId}/transcripts`);
      if (res.ok) {
        const data: DepositionTranscript[] = await res.json();
        setTranscripts(data);
        if (data.length > 0 && !activeTranscript) {
          setActiveTranscript(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load deposition transcripts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTranscripts();
  }, [matterId]);

  const handleAiSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeTranscript) return;

    setAiSearching(true);
    try {
      const res = await fetch('/api/ai/transcript-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matterId,
          transcriptId: activeTranscript.id,
          query: searchQuery,
          lang: isRtl ? 'ar' : 'en'
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAiResults(data);
      }
    } catch (err) {
      console.error("AI transcript search failed:", err);
    } finally {
      setAiSearching(false);
    }
  };

  const handleCreateTranscript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWitnessName || !rawTranscriptText) return;

    // Split text into mock pages by double newlines or 15-line chunks
    const lines = rawTranscriptText.split('\n').filter(l => l.trim().length > 0);
    const pages: TranscriptPage[] = [];
    let pageNum = 1;
    let currentChunk: string[] = [];

    lines.forEach((line, idx) => {
      currentChunk.push(line);
      if (currentChunk.length >= 12 || idx === lines.length - 1) {
        pages.push({
          pageNumber: pageNum,
          lineNumber: `${(pageNum - 1) * 12 + 1}-${pageNum * 12}`,
          timestamp: `${9 + Math.floor(pageNum / 2)}:${(pageNum * 15) % 60 === 0 ? '00' : '30'} AM`,
          speaker: `Q (Counsel) / A (${newWitnessName})`,
          text: currentChunk.join('\n'),
          isKeyAdmission: currentChunk.some(l => l.toLowerCase().includes('admit') || l.toLowerCase().includes('correct') || l.toLowerCase().includes('no notice') || l.toLowerCase().includes('نعم') || l.toLowerCase().includes('صحيح')),
          tags: ['Deposition Entry']
        });
        pageNum++;
        currentChunk = [];
      }
    });

    try {
      const res = await fetch('/api/transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matterId,
          witnessName: newWitnessName,
          witnessRole: newWitnessRole || (isRtl ? 'شاهد حقيقة' : 'Fact Witness'),
          depositionDate: newDepoDate,
          deponentParty: newDeponentParty,
          keyAdmissionsSummary: isRtl ? 'تم رفع التفريغ وتجهيز خريطة الاعترافات بواسطة جيمي' : 'Transcript ingested and indexed for admission quotes',
          pages
        })
      });

      if (res.ok) {
        const created: DepositionTranscript = await res.json();
        setTranscripts(prev => [created, ...prev]);
        setActiveTranscript(created);
        setShowUploadModal(false);
        setNewWitnessName('');
        setNewWitnessRole('');
        setRawTranscriptText('');
      }
    } catch (err) {
      console.error("Failed to upload deposition transcript:", err);
    }
  };

  const scrollToPage = (pageNum: number) => {
    const el = document.getElementById(`transcript-page-${pageNum}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col gap-5">
      
      {/* Module Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800 shrink-0">
            <Quote className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 font-display">
                {isRtl ? 'فهرس ومحلل تفريغ الشهادات القضائية' : 'Deposition Transcript Indexer & Admission Engine'}
              </h3>
              <span className="px-2.5 py-0.5 bg-teal-100/80 text-teal-900 border border-teal-300/80 text-[10px] font-bold rounded-full">
                AI Gemini Indexing
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {isRtl 
                ? 'فهرسة الاستجواب الشفهي، استخراج الاعترافات الحاكمة، وصياغة أسئلة المناقشة أمام المحكمة' 
                : 'Semantic indexing of oral testimony, quote extraction, and AI cross-examination generator'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          {isRtl ? 'رفع تفريغ جلسة شهادة جديدة' : 'Ingest Deposition Transcript'}
        </button>
      </div>

      {/* Transcript Selector & Search Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left: Deponent Witnesses List (4 cols) */}
        <div className="lg:col-span-4 bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex flex-col gap-2">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-teal-700" />
            {isRtl ? 'فهرس جلسات الاستجواب المسجلة' : 'Indexed Deponent Transcripts'}
          </label>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
              {isRtl ? 'جاري تحميل الشهادات...' : 'Loading transcripts...'}
            </div>
          ) : transcripts.length === 0 ? (
            <div className="p-4 bg-white rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500 space-y-2">
              <p>{isRtl ? 'لا يوجد تفريغ شهادات مرفوع حالياً.' : 'No deposition transcripts indexed yet.'}</p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="text-teal-800 font-bold underline cursor-pointer text-xs"
              >
                {isRtl ? 'اضغط لرفع أول نص شهادة' : 'Upload First Deposition'}
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar">
              {transcripts.map((t) => {
                const isActive = activeTranscript?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setActiveTranscript(t);
                      setAiResults(null);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isActive
                        ? 'bg-teal-900 text-white border-teal-950 shadow-md'
                        : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs truncate">{t.witnessName}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isActive 
                          ? 'bg-teal-800 text-teal-100 border border-teal-700' 
                          : 'bg-amber-100 text-amber-900 border border-amber-200'
                      }`}>
                        {t.deponentParty}
                      </span>
                    </div>

                    <p className={`text-[11px] truncate ${isActive ? 'text-teal-200' : 'text-slate-500'}`}>
                      {t.witnessRole}
                    </p>

                    <div className={`flex items-center justify-between text-[10px] mt-1 pt-1.5 border-t ${
                      isActive ? 'border-teal-800 text-teal-300' : 'border-slate-100 text-slate-400'
                    }`}>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {t.depositionDate}
                      </span>
                      <span>{t.pagesCount} {isRtl ? 'صفحات مفهرسة' : 'Pages Indexed'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: AI Search Bar & Copilot Query (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          
          <form onSubmit={handleAiSearch} className="bg-gradient-to-r from-teal-950 via-teal-900 to-teal-950 border border-teal-800 rounded-2xl p-4 shadow-md text-white flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-300 animate-pulse" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-teal-100">
                  {isRtl ? 'مساعد البحث الجنائي الذكي في محضر الشهادة' : 'AI Semantic Transcript Query & Admission Extractor'}
                </span>
              </div>
              {activeTranscript && (
                <span className="text-[11px] text-teal-200 font-mono bg-teal-800/80 px-2.5 py-0.5 rounded-full border border-teal-700">
                  {activeTranscript.witnessName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 bg-slate-950/80 border border-teal-700/80 rounded-xl p-1.5 focus-within:border-teal-400 transition-colors">
              <Search className="w-4 h-4 text-teal-400 ml-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isRtl 
                  ? 'ابحث عن نقطة محددة (مثال: إغلاق البوابة، إخطار القوة القاهرة، قيمة الأضرار)...' 
                  : 'Search witness statements (e.g., gate closure, lack of notice, damages log)...'}
                className="w-full bg-transparent text-xs text-white placeholder-teal-200/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={aiSearching || !activeTranscript}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                {aiSearching ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    {isRtl ? 'جاري التحليل...' : 'Analyzing...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    {isRtl ? 'استخراج الاعترافات' : 'Run AI Analysis'}
                  </>
                )}
              </button>
            </div>
            
            <p className="text-[11px] text-teal-200/80 font-medium">
              {isRtl 
                ? 'يقوم جيمي بمسح نص الجلسة بالكامل، مطابقة الحجج، وتحديد الصفحات والأسطر التي تشكل إقراراً قضائياً ضاراً بالخصم.' 
                : 'Gemini scans the full transcript to anchor page & line quotes, isolate admissions against interest, and format trial questions.'}
            </p>
          </form>

          {/* AI Search Results Panel */}
          {aiResults && (
            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 space-y-4 animate-in fade-in text-slate-800">
              <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                  {isRtl ? 'نتائج التحليل الذكي واستخراج الاعترافات القضائية:' : 'AI Transcript Extraction & Key Admissions:'}
                </div>
                <button
                  onClick={() => setAiResults(null)}
                  className="text-amber-700 hover:text-amber-950 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Key Admissions Executive Summary */}
              {aiResults.keyAdmissionsSummary && (
                <div className="p-3 bg-white rounded-xl border border-amber-300 text-xs text-amber-950 leading-relaxed font-semibold shadow-xs">
                  <strong>{isRtl ? 'ملخص الإقرارات الحاكمة:' : 'Admissions Executive Summary:'} </strong>
                  {aiResults.keyAdmissionsSummary}
                </div>
              )}

              {/* Quoted Matches Grid */}
              <div className="space-y-2">
                <h5 className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                  {isRtl ? 'الاقتباسات المفصلة مع مرجعية الصفحة والسطر:' : 'Extracted Direct Quotes with Page/Line Anchors:'}
                </h5>
                <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto custom-scrollbar">
                  {aiResults.matches && aiResults.matches.map((m, idx) => (
                    <div 
                      key={idx}
                      className="p-3 bg-white border border-amber-200 rounded-xl hover:border-amber-400 transition-all text-xs flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => scrollToPage(m.pageNumber)}
                          className="px-2 py-0.5 bg-teal-100 text-teal-900 font-mono font-extrabold rounded text-[10px] hover:bg-teal-200 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {isRtl ? `ص ${m.pageNumber}، أسطر ${m.lineNumber}` : `Pg ${m.pageNumber}, Lines ${m.lineNumber}`}
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                        {m.isAdmission && (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 font-extrabold text-[10px] rounded-full">
                            🚨 {isRtl ? 'إقرار قضائي ضار' : 'Key Admission'}
                          </span>
                        )}
                      </div>

                      <blockquote className="italic border-l-2 border-amber-500 pl-2 text-slate-800 font-serif bg-slate-50/80 p-1.5 rounded">
                        "{m.quote}"
                      </blockquote>

                      <p className="text-[11px] text-slate-600 font-medium">
                        <strong>{isRtl ? 'الأهمية الإجرائية:' : 'Trial Significance:'}</strong> {m.relevanceExplanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested Cross Exam Questions */}
              {aiResults.suggestedCrossExamQuestions && aiResults.suggestedCrossExamQuestions.length > 0 && (
                <div className="pt-2 border-t border-amber-200/80">
                  <h5 className="text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-2">
                    {isRtl ? 'أسئلة المناقشة المقترحة أمام هيئة المحكمة / التحكيم:' : 'Suggested Trial Cross-Examination Questions:'}
                  </h5>
                  <ul className="space-y-1.5">
                    {aiResults.suggestedCrossExamQuestions.map((q, idx) => (
                      <li key={idx} className="text-xs bg-white p-2 rounded-lg border border-amber-200 flex items-start gap-2 font-medium">
                        <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Transcript Page-by-Page View Container */}
      {activeTranscript ? (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-800" />
              <h4 className="text-sm font-extrabold text-slate-900 font-display">
                {isRtl ? `النص التفصيلي لاستجواب: ${activeTranscript.witnessName}` : `Full Transcript View: ${activeTranscript.witnessName}`}
              </h4>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {activeTranscript.pages.length} {isRtl ? 'صفحات' : 'Pages'} • {isRtl ? 'مؤرخة:' : 'Dated:'} {activeTranscript.depositionDate}
            </span>
          </div>

          <div className="space-y-4 max-h-[450px] overflow-y-auto custom-scrollbar p-1">
            {activeTranscript.pages.map((p) => (
              <div 
                id={`transcript-page-${p.pageNumber}`}
                key={p.pageNumber}
                className={`p-4 rounded-2xl border transition-all ${
                  p.isKeyAdmission 
                    ? 'bg-amber-50/80 border-amber-300 shadow-sm' 
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Page Header Anchor */}
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200/60 text-xs">
                  <div className="flex items-center gap-2 font-mono font-bold text-slate-700">
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[11px]">
                      {isRtl ? `صفحة ${p.pageNumber}` : `Page ${p.pageNumber}`}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span>{isRtl ? `الأسطر: ${p.lineNumber}` : `Lines: ${p.lineNumber}`}</span>
                    {p.timestamp && (
                      <>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500 text-[11px]">{p.timestamp}</span>
                      </>
                    )}
                  </div>

                  {p.isKeyAdmission && (
                    <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 font-extrabold text-[10px] rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {isRtl ? 'إقرار جوهري' : 'Key Admission'}
                    </span>
                  )}
                </div>

                {/* Speaker Line */}
                <div className="text-xs font-bold text-teal-900 mb-1 font-mono">
                  {p.speaker}
                </div>

                {/* Text Body */}
                <pre className="text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed font-normal bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  {p.text}
                </pre>

                {/* Tags */}
                {p.tags && p.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-slate-100">
                    <Tag className="w-3 h-3 text-slate-400" />
                    {p.tags.map((tg, i) => (
                      <span key={i} className="text-[10px] font-semibold bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded-full">
                        #{tg}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Upload Deposition Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
            
            <div className="p-4 sm:p-5 border-b border-teal-100 bg-teal-50/80 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-800">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 font-display">
                    {isRtl ? 'إدخال تفريغ استجواب جديد' : 'Ingest Deposition Transcript'}
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    {isRtl ? 'أدخل بيانات الشاهد ونص محضر الاستجواب للفهرسة القضائية' : 'Input witness metadata and verbatim deposition text for AI analysis'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTranscript} className="p-5 sm:p-6 space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isRtl ? 'اسم الشاهد المستجوب:' : 'Deponent Witness Name:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newWitnessName}
                    onChange={(e) => setNewWitnessName(e.target.value)}
                    placeholder={isRtl ? 'مثال: المهندس خالد أحمد' : 'e.g. Capt. Rashid Al-Nuaimi'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isRtl ? 'المسمى الوظيفي / الدور:' : 'Witness Role / Title:'}
                  </label>
                  <input
                    type="text"
                    value={newWitnessRole}
                    onChange={(e) => setNewWitnessRole(e.target.value)}
                    placeholder={isRtl ? 'مثال: مدير العمليات الميدانية' : 'e.g. Chief Operating Officer'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isRtl ? 'صفة الشاهد:' : 'Deponent Classification:'}
                  </label>
                  <select
                    value={newDeponentParty}
                    onChange={(e: any) => setNewDeponentParty(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-teal-600"
                  >
                    <option value="Adverse Party">{isRtl ? 'الخصم المستجوب (Adverse Party)' : 'Adverse Party'}</option>
                    <option value="Fact Witness">{isRtl ? 'شاهد واقعة (Fact Witness)' : 'Fact Witness'}</option>
                    <option value="Expert Witness">{isRtl ? 'شاهد خبرة فنية (Expert Witness)' : 'Expert Witness'}</option>
                    <option value="Client Corporate Representative">{isRtl ? 'ممثل موكل الشركة (Client Corporate Rep)' : 'Client Corporate Representative'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isRtl ? 'تاريخ جلسة الاستجواب:' : 'Deposition Date:'}
                  </label>
                  <input
                    type="date"
                    value={newDepoDate}
                    onChange={(e) => setNewDepoDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isRtl ? 'نص محضر الاستجواب الشفهي:' : 'Verbatim Transcript Text:'}
                </label>
                <textarea
                  rows={6}
                  required
                  value={rawTranscriptText}
                  onChange={(e) => setRawTranscriptText(e.target.value)}
                  placeholder={isRtl 
                    ? 'ألصق نص أسئلة وأجوبة الاستجواب هنا...\nس: هل تم إخطار الطرف الآخر بإغلاق البوابة؟\nج: لم يتم إرسال إخطار كتابي قبل الساعة الثانية ظهراً.' 
                    : 'Paste transcript Q&A text here...\nQ: Did you give advance notice?\nA: No written notice was sent prior to 2:00 PM.'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-teal-600 font-mono leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-800 text-white rounded-xl text-xs font-bold hover:bg-teal-900 transition-colors cursor-pointer shadow-sm"
                >
                  {isRtl ? 'فهرسة وتخزين المحضر' : 'Save & Index Transcript'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
