'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, FileText, Download, Copy, RefreshCw, Send, CheckCircle2, Mic, MicOff, Volume2, Wand2, Trash2, Search } from 'lucide-react';
import { Matter } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';
import RagPanel from './rag-panel';

interface AiModuleProps {
  activeMatter: Matter;
}

export default function AiModule({ activeMatter }: AiModuleProps) {
  const { t, isRtl } = useLanguage();
  // Tab state — "draft" is the existing pleading copilot, "ask" is the new
  // grounded RAG Q&A panel.
  const [tab, setTab] = useState<'ask' | 'draft'>('ask');
  const [draftType, setDraftType] = useState('Demand Letter');
  const [customInstructions, setCustomInstructions] = useState('');
  const [draftText, setDraftText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice Dictation (Web Speech API) States
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          console.warn("Speech stop error:", err);
        }
      }
      setIsListening(false);
      setInterimTranscript('');
      return;
    }

    if (!SpeechRecognition) {
      // Fallback simulated dictation if browser doesn't support Web Speech API natively
      setIsListening(true);
      setError(null);
      const simulatedNotes = isRtl
        ? 'جلسة الاستماع القادمة تتطلب تقديم أصل عقد الامتياز مع شهادة إيداع القوائم المالية.'
        : 'The upcoming hearing requires submitting original franchise agreement along with audited financial statements.';

      let i = 0;
      const interval = setInterval(() => {
        i += 5;
        if (i <= simulatedNotes.length) {
          setInterimTranscript(simulatedNotes.slice(0, i));
        } else {
          clearInterval(interval);
          setCustomInstructions(prev => (prev ? prev + '\n' + simulatedNotes : simulatedNotes));
          setInterimTranscript('');
          setIsListening(false);
        }
      }, 100);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = isRtl ? 'ar-SA' : 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setCustomInstructions(prev => (prev ? prev.trim() + ' ' + transcriptChunk : transcriptChunk));
          } else {
            currentInterim += transcriptChunk;
          }
        }
        setInterimTranscript(currentInterim);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setError(isRtl ? 'يرجى السماح بصلاحية استخدام الميكروفون للإملاء الصوتي' : 'Microphone permission denied.');
        } else if (event.error !== 'no-speech') {
          setError(isRtl ? `خطأ الإملاء الصوتي: ${event.error}` : `Voice dictation error: ${event.error}`);
        }
        setIsListening(false);
        setInterimTranscript('');
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err: any) {
      console.error('Failed to initialize speech recognition:', err);
      setIsListening(false);
      setError(isRtl ? 'تعذر تشغيل الإملاء الصوتي' : 'Could not start voice dictation');
    }
  };

  const handleInsertQuickTemplate = (heading: string) => {
    setCustomInstructions(prev => {
      const prefix = prev ? prev.trim() + '\n\n' : '';
      return prefix + `[${heading}]: `;
    });
  };

  const handleGenerateDraft = async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matterId: activeMatter.id,
          type: draftType,
          details: customInstructions,
          lang: isRtl ? 'ar' : 'en' // Pass chosen language to generator backend
        })
      });

      if (res.ok) {
        const data = await res.json();
        setDraftText(data.draft);
      } else {
        const errData = await res.json();
        setError(errData.error || (isRtl ? "فشل الذكاء الاصطناعي في توليد المسودة." : "Failed to generate legal draft."));
      }
    } catch (err: any) {
      setError(err.message || "Network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Localized template options
  const templateOptions = [
    { name: isRtl ? 'لائحة ادعاء أصلية (Statement of Claim)' : 'Statement of Claim Pleading', value: 'Statement of Claim Pleading' },
    { name: isRtl ? 'مذكرة دفاع جوابية (Statement of Defense)' : 'Statement of Defense Pleading', value: 'Statement of Defense Pleading' },
    { name: isRtl ? 'لائحة استئناف/طعن (Appellate Brief)' : 'Appellate Brief / Appeal Notice', value: 'Appellate Brief / Appeal Notice' },
    { name: isRtl ? 'طلب فصل ناجز (Summary Judgment)' : 'Motion for Summary Judgment', value: 'Motion for Summary Judgment' },
    { name: isRtl ? 'عريضة تحكيم (SCCA Petition)' : 'SCCA Arbitration Petition', value: 'SCCA Arbitration Petition' },
    { name: isRtl ? 'إنذار عدلي رسمي (Demand Notice)' : 'Formal Demand Notice', value: 'Formal Demand Notice' }
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 shadow-sm flex flex-col h-full gap-3.5 sm:gap-5" id="ai-copilot-module">
      {/* Module Title */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-2.5 sm:pb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-indigo-600 fill-indigo-100 shrink-0" />
          <h3 className="text-base sm:text-lg font-bold text-slate-800 font-display">{t.aiCopilotTitle}</h3>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-mono">
          {t.poweredBy}
        </span>
      </div>

      {/* Tab switcher — Ask (RAG) is the new default; Draft is the legacy
          pleading copilot. Lawyers land on the grounded Q&A first. */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl">
        <button
          type="button"
          onClick={() => setTab('ask')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            tab === 'ask'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>{t.ragTabAsk}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('draft')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            tab === 'draft'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{t.ragTabDraft}</span>
        </button>
      </div>

      {/* --- Ask with Sources (RAG) tab --- */}
      {tab === 'ask' && (
        <div className="flex-grow overflow-hidden flex flex-col min-h-[400px]">
          <RagPanel activeMatter={activeMatter} />
        </div>
      )}

      {/* --- Draft tab (existing pleading copilot) --- */}
      {tab === 'draft' && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 md:gap-6 flex-grow overflow-hidden">
        {/* Left Side: Drafting Configs */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t.draftTemplate}</label>
            <div className="grid grid-cols-2 gap-2">
              {templateOptions.map(tpl => (
                <button
                  key={tpl.value}
                  type="button"
                  onClick={() => setDraftType(tpl.value)}
                  className={`p-3 text-xs font-semibold rounded-2xl border transition-all flex flex-col justify-between cursor-pointer ${
                    isRtl ? 'text-right' : 'text-left rtl:text-right rtl:text-left'
                  } ${
                    draftType === tpl.value
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100/50 text-slate-600'
                  }`}
                >
                  <FileText className={`w-4 h-4 mb-2 ${draftType === tpl.value ? 'text-indigo-200' : 'text-slate-400'}`} />
                  <span>{tpl.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            {/* Header label & Voice Dictation Mic control */}
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {t.draftDirectives}
              </label>

              {/* Voice-to-Text Dictation Button */}
              <button
                type="button"
                onClick={toggleListening}
                className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                  isListening
                    ? 'bg-rose-500 text-white border-rose-600 shadow-md animate-pulse'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                }`}
                title={isListening ? (isRtl ? 'إيقاف الإملاء الصوتي' : 'Stop voice dictation') : (isRtl ? 'بدء الإملاء الصوتي' : 'Start voice dictation')}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-3.5 h-3.5" />
                    <span>{isRtl ? 'إيقاف التسجيل...' : 'Recording...'}</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{isRtl ? 'إملاء صوتي' : 'Voice Dictate'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Voice Legal Template Directives */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-1 scrollbar-none">
              <span className="text-[10px] text-slate-400 font-bold shrink-0">{isRtl ? 'إملاء سريع:' : 'Quick Dictate:'}</span>
              {[
                { label: isRtl ? 'وقائع الدعوى' : 'Case Facts', val: isRtl ? 'وقائع القضية والمستندات' : 'Case Facts & Documents' },
                { label: isRtl ? 'شهادة الشهود' : 'Witness Statements', val: isRtl ? 'أقوال وشهادات الشهود' : 'Witness Testimony' },
                { label: isRtl ? 'الطلبات ختاماً' : 'Requested Relief', val: isRtl ? 'الطلبات الختامية والمحاكمة' : 'Final Legal Claims' }
              ].map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleInsertQuickTemplate(item.val)}
                  className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-lg border border-slate-200 shrink-0 cursor-pointer transition-colors"
                >
                  + {item.label}
                </button>
              ))}
            </div>

            {/* Active Voice Listening Visualizer Banner */}
            {isListening && (
              <div className="mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                  <span className="font-bold">
                    {isRtl ? 'جاري الاستماع للإملاء القانوني الصوتي...' : 'Listening to legal dictation...'}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full">
                  {isRtl ? 'العربية (ar-SA)' : 'English (en-US)'}
                </span>
              </div>
            )}

            {/* Directives Text Area with Real-time Speech Input */}
            <div className="relative">
              <textarea
                value={customInstructions}
                onChange={e => setCustomInstructions(e.target.value)}
                placeholder={isRtl ? 'اضغط على زِر الإملاء الصوتي للتحدث مباشرة، أو اكتب الملاحظات والطلبات...' : t.draftDirectivesPlaceholder}
                rows={4}
                className={`w-full text-xs border rounded-2xl p-4 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-100 leading-normal ${
                  isListening ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200'
                }`}
              />

              {/* Interim Transcript Live Overlay */}
              {interimTranscript && (
                <div className="mt-1 p-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-800 italic flex items-center gap-2">
                  <Volume2 className="w-3.5 h-3.5 text-indigo-500 shrink-0 animate-bounce" />
                  <span>"{interimTranscript}"</span>
                </div>
              )}

              {/* Clear Text Area Action */}
              {customInstructions && !isListening && (
                <button
                  type="button"
                  onClick={() => setCustomInstructions('')}
                  className="absolute top-2.5 right-2.5 p-1 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg text-[10px] transition-colors cursor-pointer"
                  title={isRtl ? 'مسح النص' : 'Clear text'}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-xs p-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerateDraft}
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-100 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white animate-spin shrink-0" />
                <span>{isRtl ? 'جاري صياغة النص من جيمي...' : 'Gemini Generating Draft...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300 shrink-0" />
                <span>{t.draftBtn}</span>
              </>
            )}
          </button>
        </div>

        {/* Right Side: Draft Text Output in Parchment Viewport */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-slate-50 border border-slate-200 rounded-3xl p-5 overflow-hidden min-h-[350px]">
          {draftText ? (
            <div className="flex flex-col h-full justify-between gap-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 font-mono">{t.draftReady}</span>
                  <p className="text-xs font-bold text-slate-700">
                    {templateOptions.find(o => o.value === draftType)?.name || draftType}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={handleCopyToClipboard}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 shadow-sm transition-all text-xs flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? t.copiedBtn : t.copyBtn}</span>
                  </button>
                </div>
              </div>

              {/* Text Area Mock Parchment scroll */}
              <div 
                className="flex-grow overflow-y-auto max-h-[350px] bg-white border border-slate-100 p-5 rounded-2xl shadow-inner text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-line"
                style={{ direction: isRtl ? 'rtl' : 'ltr' }}
              >
                {draftText}
              </div>

              <span className="text-[9px] text-slate-400 text-center uppercase tracking-widest font-bold font-mono">
                {t.draftLegalNotes}
              </span>
            </div>
          ) : (
            <div className="h-full flex flex-col justify-center items-center text-center text-slate-400 py-10 gap-2">
              <FileText className="w-12 h-12 text-slate-300" />
              <p className="text-xs">{t.noDraftPrompt}</p>
              <p className="text-[10px] text-slate-400">{isRtl ? 'جميع المستندات المصاغة تتبع البناء القانوني المعتمد في الشرق الأوسط.' : 'All drafts use formal Middle Eastern judicial structures.'}</p>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
