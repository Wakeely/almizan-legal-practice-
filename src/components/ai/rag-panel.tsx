'use client';

// =============================================================================
// Al Mizan — RAG panel (grounded legal Q&A with citations)
// -----------------------------------------------------------------------------
// This is the lawyer-facing UI for /api/ai/rag. It posts a question + matterId
// and renders the answer with source chips. Each chip expands to show the
// excerpt and (where available) a deep-link to the source document or
// transcript page.
//
// Design principles (from the product spec):
//   - Grounded or refuse: badge shows "Grounded — N sources" or "No sources
//     found". Never silently returns an ungrounded answer.
//   - Citations are mandatory: every source chip shows type + name + article
//     number / page number + excerpt.
//   - Disclaimer is always visible.
//   - Arabic + English: all strings from i18n, RTL-aware.
// =============================================================================

import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  Send,
  Search,
  FileText,
  Scale,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Database,
} from 'lucide-react';
import { Matter } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';

// Mirror of src/lib/rag/types.ts Citation / RagAnswer shapes.
// Duplicated here to avoid pulling server-only types into the client bundle.
interface Citation {
  type: 'statute' | 'document' | 'transcript';
  lawName?: string;
  lawType?: string;
  articleNumber?: string;
  title?: string;
  year?: number;
  sourceUrl?: string;
  documentId?: string;
  documentName?: string;
  transcriptId?: string;
  pageNumber?: number;
  chunkIndex?: number;
  excerpt: string;
  chunkId?: string;
  confidence?: number;
}

interface RagAnswer {
  answer: string;
  sources: Citation[];
  grounded: boolean;
  noSources: boolean;
  matterHits: number;
  corpusHits: number;
  disclaimer: string;
  lang: 'ar' | 'en';
  _stub: boolean;
  _textFallback: boolean;
}

interface RagPanelProps {
  activeMatter: Matter;
}

export default function RagPanel({ activeMatter }: RagPanelProps) {
  const { t, isRtl } = useLanguage();
  const [question, setQuestion] = useState('');
  const [includeMatter, setIncludeMatter] = useState(true);
  const [includeCorpus, setIncludeCorpus] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [expandedSource, setExpandedSource] = useState<number | null>(null);

  const handleAsk = async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setExpandedSource(null);
    try {
      const res = await fetch('/api/ai/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matterId: activeMatter.id,
          question: question.trim(),
          lang: isRtl ? 'ar' : 'en',
          includeMatter,
          includeCorpus,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: t.ragErrorGeneric }));
        throw new Error(errData.error || t.ragErrorGeneric);
      }
      const data: RagAnswer = await res.json();
      setAnswer(data);
    } catch (err: any) {
      setError(err.message || t.ragErrorGeneric);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleAsk();
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Subtitle — honesty about corpus limits */}
      <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
        <BookOpen className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
        <span>{t.ragSubtitle}</span>
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-2">
        <ToggleChip
          active={includeMatter}
          onClick={() => setIncludeMatter((v) => !v)}
          icon={<FileText className="w-3.5 h-3.5" />}
          label={t.ragToggleMatter}
        />
        <ToggleChip
          active={includeCorpus}
          onClick={() => setIncludeCorpus((v) => !v)}
          icon={<Scale className="w-3.5 h-3.5" />}
          label={t.ragToggleCorpus}
        />
      </div>

      {/* Question input */}
      <div className="relative">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.ragPlaceholder}
          rows={3}
          className="w-full text-sm border border-slate-200 rounded-2xl p-4 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-100 leading-normal resize-none"
          dir={isRtl ? 'rtl' : 'ltr'}
        />
        <div className="absolute bottom-3 right-3 text-[10px] text-slate-400 font-mono">
          ⌘+↵
        </div>
      </div>

      {/* Ask button */}
      <button
        onClick={handleAsk}
        disabled={loading || !question.trim() || (!includeMatter && !includeCorpus)}
        className="w-full py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 shadow-md shadow-indigo-100 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            <span>{t.ragThinking}</span>
          </>
        ) : (
          <>
            <Search className="w-4 h-4 shrink-0" />
            <span>{t.ragAskBtn}</span>
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-xs p-3 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Answer */}
      {answer && (
        <div className="flex flex-col gap-3 overflow-y-auto flex-grow pr-1">
          {/* Status badge row */}
          <div className="flex flex-wrap items-center gap-2">
            {answer.noSources ? (
              <Badge variant="warn">
                <XCircle className="w-3.5 h-3.5" />
                <span>{t.ragNoSources}</span>
              </Badge>
            ) : answer.grounded ? (
              <Badge variant="good">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t.ragGrounded.replace('{n}', String(answer.sources.length))}</span>
              </Badge>
            ) : (
              <Badge variant="warn">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{t.ragUngrounded}</span>
              </Badge>
            )}
            {answer.matterHits > 0 && (
              <Badge variant="neutral">
                <Database className="w-3 h-3" />
                <span>{t.ragMatterHits.replace('{n}', String(answer.matterHits))}</span>
              </Badge>
            )}
            {answer.corpusHits > 0 && (
              <Badge variant="neutral">
                <Scale className="w-3 h-3" />
                <span>{t.ragCorpusHits.replace('{n}', String(answer.corpusHits))}</span>
              </Badge>
            )}
            {answer._textFallback && (
              <Badge variant="warn">
                <AlertTriangle className="w-3 h-3" />
                <span>{t.ragTextFallback}</span>
              </Badge>
            )}
          </div>

          {/* Answer text */}
          <div
            className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-white border border-slate-200 rounded-2xl p-4"
            dir={answer.lang === 'ar' ? 'rtl' : 'ltr'}
          >
            {answer.answer || (isRtl ? '—' : '—')}
          </div>

          {/* Sources */}
          {answer.sources.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <Sparkles className="w-3 h-3" />
                <span>{t.ragSourcesTitle} ({answer.sources.length})</span>
              </div>
              {answer.sources.map((src, i) => (
                <SourceChip
                  key={i}
                  index={i}
                  citation={src}
                  expanded={expandedSource === i}
                  onToggle={() => setExpandedSource(expandedSource === i ? null : i)}
                  t={t}
                  isRtl={isRtl}
                />
              ))}
            </div>
          )}

          {/* Disclaimer */}
          <div className="text-[10px] text-slate-400 italic border-t border-slate-100 pt-2 mt-1">
            {answer.disclaimer}
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function ToggleChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
        active
          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Badge({
  variant,
  children,
}: {
  variant: 'good' | 'warn' | 'neutral';
  children: React.ReactNode;
}) {
  const styles = {
    good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warn: 'bg-amber-50 text-amber-700 border-amber-200',
    neutral: 'bg-slate-50 text-slate-600 border-slate-200',
  }[variant];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${styles}`}
    >
      {children}
    </span>
  );
}

function SourceChip({
  index,
  citation,
  expanded,
  onToggle,
  t,
  isRtl,
}: {
  index: number;
  citation: Citation;
  expanded: boolean;
  onToggle: () => void;
  t: any;
  isRtl: boolean;
}) {
  const typeLabel =
    citation.type === 'statute'
      ? t.ragSourceStatute
      : citation.type === 'transcript'
        ? t.ragSourceTranscript
        : t.ragSourceDocument;

  const TypeIcon =
    citation.type === 'statute'
      ? Scale
      : citation.type === 'transcript'
        ? MessageSquare
        : FileText;

  // Primary citation label.
  let primary: string;
  if (citation.type === 'statute') {
    primary = `${citation.lawName ?? ''} — م${citation.articleNumber ?? '?'}`;
    if (citation.title) primary += ` (${citation.title})`;
  } else if (citation.type === 'transcript') {
    primary = `${citation.documentName ?? t.ragSourceTranscript} — ${isRtl ? 'ص' : 'p'}.${citation.pageNumber ?? '?'}`;
  } else {
    primary = citation.documentName ?? t.ragSourceDocument;
    if (citation.chunkIndex !== undefined) primary += ` · #${citation.chunkIndex}`;
  }

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 p-2.5 text-xs hover:bg-slate-50 transition-colors cursor-pointer text-left"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center gap-2 min-w-0 flex-grow">
          <TypeIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-wide shrink-0">
            {typeLabel}
          </span>
          <span className="font-semibold text-slate-700 truncate">{primary}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-2.5 pb-2.5 pt-0">
          <div
            className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-lg p-2.5 whitespace-pre-wrap"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {citation.excerpt}
          </div>
          {citation.sourceUrl && (
            <a
              href={citation.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              <BookOpen className="w-3 h-3" />
              <span>{isRtl ? 'المصدر الرسمي' : 'Official source'}</span>
            </a>
          )}
          {/* Deep link to document / transcript (best-effort — the matter
              workspace is the destination, not a specific page anchor, because
              the existing UI doesn't expose deep links to individual pages.) */}
          {citation.type !== 'statute' && (citation.documentId || citation.transcriptId) && (
            <span className="inline-flex items-center gap-1 mt-1.5 ml-2 text-[10px] text-slate-400">
              <FileText className="w-3 h-3" />
              <span>{isRtl ? 'متاح في ملفات القضية' : 'Available in matter files'}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
