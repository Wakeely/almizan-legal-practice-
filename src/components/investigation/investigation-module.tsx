'use client';

// =============================================================================
// InvestigationModule — Case Investigation Agent UI (main entry)
// -----------------------------------------------------------------------------
// Renders one of three views based on state:
//   1. PAYWALL  — when user.investigationAgentEnabled is false. Shows an
//                 upgrade CTA that opens the existing SubscriptionPaywallModal.
//   2. ROLE-GATED — when the user's role is not in INVESTIGATION_ALLOWED_ROLES
//                 (e.g. Client Representative). Shows a "not available" notice.
//   3. WORKSPACE — the actual module: start form + list + detail view +
//                 attorney review panel.
//
// Bilingual (Arabic + English) with RTL support via useLanguage().
// Uses existing shadcn/ui Card / Button / Textarea / Badge patterns from the
// rest of the app (matches MattersModule / AiModule styling).
//
// Sub-components live in investigation-subcomponents.tsx for readability.
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSearch,
  Loader2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useLanguage } from '@/components/providers/language-provider';
import SubscriptionPaywallModal from '@/components/subscription/subscription-paywall-modal';
import { INVESTIGATION_ALLOWED_ROLES } from '@/lib/agents/types';
import type { Matter } from '@/lib/types';
import {
  PaywallView,
  ListView,
  NewInvestigationForm,
  DetailView,
} from './investigation-subcomponents';

interface InvestigationListItem {
  id: string;
  title: string;
  status: string;
  verificationTier: string;
  lang: string;
  matterId: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InvestigationDetail {
  id: string;
  title: string;
  status: string;
  verificationTier: string;
  lang: string;
  matterId: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  intake: any;
  research: any;
  courtRouting: any;
  draft: any;
  citationVerifications: any[];
  factChecks: any[];
  assembly: any;
  reviews: any[];
  agentRuns: any[];
}

interface InvestigationModuleProps {
  activeMatter: Matter | null;
}

export default function InvestigationModule({ activeMatter }: InvestigationModuleProps) {
  const { user } = useAuth();
  const { isRtl, language } = useLanguage();
  const isAr = language === 'ar';

  const [showPaywall, setShowPaywall] = useState(false);
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [list, setList] = useState<InvestigationListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [detail, setDetail] = useState<InvestigationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [intakeInput, setIntakeInput] = useState('');
  const [tier, setTier] = useState<'1' | '2' | '3'>('2');
  const [lang, setLang] = useState<'ar' | 'en'>(isAr ? 'ar' : 'en');

  // ── Paywall + role gate ────────────────────────────────────────────────
  const addonEnabled = !!user?.investigationAgentEnabled;
  const roleAllowed = user
    ? (INVESTIGATION_ALLOWED_ROLES as readonly string[]).includes(user.role)
    : false;

  const fetchList = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (activeMatter) params.set('matterId', activeMatter.id);
      const res = await fetch(`/api/investigations?${params.toString()}`, { cache: 'no-store' });
      if (res.status === 402) {
        setShowPaywall(true);
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      const data = await res.json();
      setList(Array.isArray(data?.data) ? data.data : []);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load investigations');
    } finally {
      setListLoading(false);
    }
  }, [activeMatter]);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/investigations/${id}`, { cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      const data = await res.json();
      setDetail(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load investigation');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (addonEnabled && roleAllowed && view === 'list') {
      fetchList();
    }
  }, [addonEnabled, roleAllowed, view, fetchList]);

  // When entering detail view with a selectedId, fetch the detail.
  // This covers both: (a) clicking an item in the list, and (b) being
  // redirected here after starting a new investigation (handleStart sets
  // selectedId + view='detail' but doesn't call fetchDetail itself).
  useEffect(() => {
    if (view === 'detail' && selectedId) {
      fetchDetail(selectedId);
    }
  }, [view, selectedId, fetchDetail]);

  // ── Start a new investigation ──────────────────────────────────────────
  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !intakeInput.trim()) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/investigations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          intakeInput: intakeInput.trim(),
          matterId: activeMatter?.id,
          verificationTier: tier,
          lang,
        }),
      });
      if (res.status === 402) {
        setShowPaywall(true);
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      const data = await res.json();
      setSelectedId(data.id);
      setView('detail');
      setTitle('');
      setIntakeInput('');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to start investigation');
    } finally {
      setStarting(false);
    }
  };

  // ── Render: paywall ────────────────────────────────────────────────────
  if (!addonEnabled) {
    return <PaywallView isAr={isAr} onUpgrade={() => setShowPaywall(true)} />;
  }

  // ── Render: role gate ──────────────────────────────────────────────────
  if (!roleAllowed) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <Lock className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <h3 className="text-base font-bold mb-1">
          {isAr ? 'هذه الميزة غير متاحة لدورك' : 'Not available for your role'}
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          {isAr
            ? 'يتطلب وكيل تحقيق القضايا صلاحية الشريك الإداري أو المحامي الأول أو المستشار القانوني الداخلي.'
            : 'The Case Investigation Agent requires Managing Partner, Senior Associate, or In-House Counsel role.'}
        </p>
      </div>
    );
  }

  // ── Render: workspace ──────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 border border-primary/30 text-primary rounded-xl">
            <FileSearch className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold">
              {isAr ? 'وكيل تحقيق القضايا' : 'Case Investigation Agent'}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {isAr
                ? 'خط أنابيب متعدد الوكلاء مع التحقق المستقل من الاستشهادات ومراجعة المحامي.'
                : 'Multi-agent pipeline with independent citation verification + attorney review.'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {view !== 'list' && (
            <button
              onClick={() => {
                setView('list');
                setSelectedId(null);
                setDetail(null);
                fetchList();
              }}
              className="px-3 py-1.5 text-xs font-bold border border-border rounded-lg hover:bg-accent transition flex items-center gap-1.5"
            >
              {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              {isAr ? 'القائمة' : 'List'}
            </button>
          )}
          {view === 'list' && (
            <button
              onClick={() => setView('new')}
              className="px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition flex items-center gap-1.5"
            >
              <FileSearch className="w-3.5 h-3.5" />
              {isAr ? 'تحقيق جديد' : 'New Investigation'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Views */}
      {view === 'list' && (
        <ListView
          isAr={isAr}
          isRtl={isRtl}
          list={list}
          loading={listLoading}
          onOpen={(id) => {
            setSelectedId(id);
            setView('detail');
            fetchDetail(id);
          }}
          onNew={() => setView('new')}
        />
      )}

      {view === 'new' && (
        <NewInvestigationForm
          isAr={isAr}
          title={title}
          intakeInput={intakeInput}
          tier={tier}
          lang={lang}
          activeMatter={activeMatter}
          starting={starting}
          onTitle={setTitle}
          onIntake={setIntakeInput}
          onTier={setTier}
          onLang={setLang}
          onSubmit={handleStart}
        />
      )}

      {view === 'detail' && selectedId && (
        <DetailView
          isAr={isAr}
          isRtl={isRtl}
          detail={detail}
          loading={detailLoading}
          onRefresh={() => fetchDetail(selectedId)}
          onReviewed={() => fetchDetail(selectedId)}
        />
      )}

      {/* Paywall modal (only opens if API returns 402 unexpectedly) */}
      <SubscriptionPaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        restrictedFeatureName={isAr ? 'وكيل تحقيق القضايا' : 'Case Investigation Agent'}
      />
    </div>
  );
}
