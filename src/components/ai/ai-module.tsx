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
        // Handle non-JSON error responses gracefully — the API may return an
        // HTML error page if it crashed server-side, which would throw
        // "Unexpected token '<'" on res.json(). We parse safely and show a
        // clear message instead.
        let errMsg = isRtl ? "فشل الذكاء الاصطناعي في توليد المسودة." : "Failed to generate legal draft.";
        try {
          const text = await res.text();
          // Try to parse as JSON first; if that fails, it's an HTML error page.
          if (text.startsWith('{')) {
            const errData = JSON.parse(text);
            errMsg = errData.error || errMsg;
          } else if (text.includes('<!DOCTYPE') || text.includes('<html')) {
            errMsg = isRtl
              ? "حدث خطأ في الخادم أثناء توليد المسودة. يرجى المحاولة مرة أخرى، أو التواصل مع الدعم إذا استمر الخطأ."
              : "Server error while generating the draft. Please try again, or contact support if the error persists.";
          }
        } catch {
          // res.text() or JSON.parse failed — keep the default message.
        }
        setError(errMsg);
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
    <div className="bg-card border border-border rounded-xl p-4 md:p-5 shadow-sm flex flex-col h-full gap-3.5 sm:gap-5" id="ai-copilot-module">
      {/* Module Title */}
      <div className="flex justify-between items-center border-b border-border pb-2.5 sm:pb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary fill-accent shrink-0" />
          <h3 className="text-base sm:text-lg font-bold text-foreground font-display">{t.aiCopilotTitle}</h3>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-widest text-primary bg-accent border border-primary px-2 py-0.5 rounded-full font-mono">
          {t.poweredBy}
        </span>
      </div>

      {/* Tab switcher — Ask (RAG) is the new default; Draft is the legacy
          pleading copilot. Lawyers land on the grounded Q&A first. */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl">
        <button
          type="button"
          onClick={() => setTab('ask')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            tab === 'ask'
              ? 'bg-card text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
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
              ? 'bg-card text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
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
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{t.draftTemplate}</label>
            <div className="grid grid-cols-2 gap-2">
              {templateOptions.map(tpl => (
                <button
                  key={tpl.value}
                  type="button"
                  onClick={() => setDraftType(tpl.value)}
                  className={`p-3 text-xs font-semibold rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                    isRtl ? 'text-right' : 'text-left rtl:text-right rtl:text-left'
                  } ${
                    draftType === tpl.value
                      ? 'bg-primary border-primary text-white shadow-md'
                      : 'border-border bg-background hover:bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <FileText className={`w-4 h-4 mb-2 ${draftType === tpl.value ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span>{tpl.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            {/* Header label & Voice Dictation Mic control */}
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {t.draftDirectives}
              </label>

              {/* Voice-to-Text Dictation Button */}
              <button
                type="button"
                onClick={toggleListening}
                className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                  isListening
                    ? 'bg-rose-500 text-white border-rose-600 shadow-md animate-pulse'
                    : 'bg-accent hover:bg-primary/15 text-primary border-primary'
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
                    <Mic className="w-3.5 h-3.5 text-primary" />
                    <span>{isRtl ? 'إملاء صوتي' : 'Voice Dictate'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Voice Legal Template Directives */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-1 scrollbar-none">
              <span className="text-[10px] text-muted-foreground font-bold shrink-0">{isRtl ? 'إملاء سريع:' : 'Quick Dictate:'}</span>
              {[
                { label: isRtl ? 'وقائع الدعوى' : 'Case Facts', val: isRtl ? 'وقائع القضية والمستندات' : 'Case Facts & Documents' },
                { label: isRtl ? 'شهادة الشهود' : 'Witness Statements', val: isRtl ? 'أقوال وشهادات الشهود' : 'Witness Testimony' },
                { label: isRtl ? 'الطلبات ختاماً' : 'Requested Relief', val: isRtl ? 'الطلبات الختامية والمحاكمة' : 'Final Legal Claims' }
              ].map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleInsertQuickTemplate(item.val)}
                  className="px-2 py-0.5 text-[10px] bg-muted hover:bg-foreground/10 text-muted-foreground font-medium rounded-lg border border-border shrink-0 cursor-pointer transition-colors"
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
                className={`w-full text-xs border rounded-lg p-4 bg-background focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors leading-normal ${
                  isListening ? 'border-rose-300 ring-2 ring-rose-100' : 'border-border'
                }`}
              />

              {/* Interim Transcript Live Overlay */}
              {interimTranscript && (
                <div className="mt-1 p-2 bg-accent border border-primary rounded-xl text-xs text-primary italic flex items-center gap-2">
                  <Volume2 className="w-3.5 h-3.5 text-primary shrink-0 animate-bounce" />
                  <span>"{interimTranscript}"</span>
                </div>
              )}

              {/* Clear Text Area Action */}
              {customInstructions && !isListening && (
                <button
                  type="button"
                  onClick={() => setCustomInstructions('')}
                  className="absolute top-2.5 right-2.5 p-1 bg-muted hover:bg-foreground/10 text-muted-foreground rounded-lg text-[10px] transition-colors cursor-pointer"
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
            disabled={loading || customInstructions.trim().length < 2}
            className="w-full py-3 bg-primary text-primary-foreground rounded-lg text-xs font-bold shadow-md shadow-primary/10 flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white animate-spin shrink-0" />
                <span>{isRtl ? 'جاري صياغة النص...' : 'Generating Draft...'}</span>
              </>
            ) : customInstructions.trim().length < 2 ? (
              <>
                <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300 shrink-0" />
                <span>{isRtl ? 'أدخل التوجيهات أولاً للصياغة' : 'Enter directives to draft'}</span>
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
        <div className="lg:col-span-7 flex flex-col justify-between bg-background border border-border rounded-xl p-4 md:p-5 overflow-hidden min-h-[350px]">
          {draftText ? (
            <div className="flex flex-col h-full justify-between gap-4">
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <div>
                  <span className="text-[9px] uppercase font-bold text-muted-foreground font-mono">{t.draftReady}</span>
                  <p className="text-xs font-bold text-foreground">
                    {templateOptions.find(o => o.value === draftType)?.name || draftType}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={handleCopyToClipboard}
                    className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-primary shadow-sm transition-all text-xs flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? t.copiedBtn : t.copyBtn}</span>
                  </button>
                </div>
              </div>

              {/* Text Area Mock Parchment scroll */}
              <div 
                className="flex-grow overflow-y-auto max-h-[350px] bg-card border border-border p-4 rounded-xl shadow-inner text-xs text-foreground leading-relaxed font-sans whitespace-pre-line"
                style={{ direction: isRtl ? 'rtl' : 'ltr' }}
              >
                {draftText}
              </div>

              <span className="text-[9px] text-muted-foreground text-center uppercase tracking-widest font-bold font-mono">
                {t.draftLegalNotes}
              </span>
            </div>
          ) : (
            <div className="h-full flex flex-col justify-center items-center text-center text-muted-foreground py-10 gap-2">
              <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">{t.noDraftPrompt}</p>
              <p className="text-[10px] text-muted-foreground">{isRtl ? 'جميع المستندات المصاغة تتبع البناء القانوني المعتمد في الشرق الأوسط.' : 'All drafts use formal Middle Eastern judicial structures.'}</p>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
