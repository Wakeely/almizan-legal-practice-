'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound, Save, Trash2, Loader2, Check, ShieldAlert, Dices } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';

type Provider = 'openai' | 'xai' | 'gemini';

interface ProviderStatus {
  org: boolean;
  platform: boolean;
}

interface ActiveKey {
  provider: Provider;
  source: 'org' | 'platform';
}

interface ByokState {
  providers: Record<Provider, ProviderStatus>;
  active: ActiveKey | null;
  canManageKeys: boolean;
}

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: 'OpenAI',
  xai: 'xAI (Grok)',
  gemini: 'Google Gemini',
};

const PROVIDER_MODELS: Record<Provider, string> = {
  openai: 'GPT-4o-mini',
  xai: 'Grok-3',
  gemini: 'Gemini 2.5 Flash Lite',
};

export default function ByokSettings() {
  const { isRtl } = useLanguage();
  const [state, setState] = useState<ByokState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Editing state
  const [editing, setEditing] = useState<Provider | null>(null);
  const [keyValue, setKeyValue] = useState('');
  const [activePref, setActivePref] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/keys');
      if (!res.ok) throw new Error('Failed to load AI key status');
      const data = (await res.json()) as ByokState;
      setState(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSave = async () => {
    if (!editing || !keyValue.trim()) return;
    setSaving(true);
    setNotice('');
    setError('');
    try {
      const res = await fetch('/api/ai/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: editing, key: keyValue.trim(), setActive: activePref }),
      });
      if (!res.ok) {
        const body = await res.json().catch((): null => null);
        throw new Error(body?.error ?? 'Failed to save key');
      }
      setKeyValue('');
      setEditing(null);
      setNotice(isRtl ? 'تم حفظ المفتاح وتشفيره على الخادم.' : 'Key saved and encrypted server-side.');
      await loadStatus();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save key');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (provider: Provider) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/ai/keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const body = await res.json().catch((): null => null);
        throw new Error(body?.error ?? 'Failed to remove key');
      }
      setNotice(isRtl ? 'تمت إزالة المفتاح.' : 'Key removed.');
      await loadStatus();
    } catch (e: any) {
      setError(e.message ?? 'Failed to remove key');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-5 md:p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-1">
        <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center">
          <KeyRound className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {isRtl ? 'مفاتيح الذكاء الاصطناعي الخاصة بك (BYOK)' : 'Bring Your Own AI Key'}
          </h2>
          <p className="text-sm text-slate-500">
            {isRtl
              ? 'استخدم مفتاحك الخاص بدلًا من المفتاح الأساسي للمنصة — تُشفَّر المفاتيح على الخادم ولا تُرسَل أبدًا إلى المتصفح.'
              : 'Use your own provider key instead of the platform key. Keys are encrypted at rest and never sent to the browser.'}
          </p>
        </div>
      </div>

      {state && !state.canManageKeys && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {isRtl
              ? 'إدارة مفاتيحك الخاصة متاحة في خطة مدفوعة نشطة فقط.'
              : 'Storing your own AI keys is available on an active paid plan only.'}
          </span>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {notice && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <Check className="h-4 w-4" /> {notice}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {(Object.keys(PROVIDER_LABELS) as Provider[]).map((provider) => {
          const status = state?.providers?.[provider];
          const isActive = state?.active?.provider === provider;
          return (
            <div key={provider} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{PROVIDER_LABELS[provider]}</span>
                    {isActive && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {isRtl ? 'نشط' : 'active'}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className={`rounded px-2 py-0.5 ${status?.org ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                      {isRtl ? 'مفتاح المنظمة' : 'Org key'}: {status?.org ? (isRtl ? 'محفوظ' : 'stored') : (isRtl ? 'غير محفوظ' : 'none')}
                    </span>
                    <span className={`rounded px-2 py-0.5 ${status?.platform ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                      {isRtl ? 'مفتاح المنصة' : 'Platform'}: {status?.platform ? (isRtl ? 'متاح' : 'present') : (isRtl ? 'غير متاح' : 'none')}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-500">{PROVIDER_MODELS[provider]}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {editing === provider ? (
                    <>
                      <button
                        onClick={() => {
                          setEditing(null);
                          setKeyValue('');
                        }}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      >
                        {isRtl ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving || !keyValue.trim()}
                        className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {isRtl ? 'حفظ' : 'Save'}
                      </button>
                    </>
                  ) : (
                    <>
                      {status?.org && (
                        <button
                          onClick={() => handleRemove(provider)}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          {isRtl ? 'إزالة' : 'Remove'}
                        </button>
                      )}
                      {state?.canManageKeys && (
                        <button
                          onClick={() => {
                            setEditing(provider);
                            setKeyValue('');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <KeyRound className="h-4 w-4" />
                          {isRtl ? (status?.org ? 'استبدال' : 'إضافة') : status?.org ? 'Replace' : 'Add'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {editing === provider && (
                <div className="mt-3 space-y-2">
                  <label className="block text-xs font-medium text-slate-600">
                    {PROVIDER_LABELS[provider]} API Key
                  </label>
                  <input
                    type="password"
                    value={keyValue}
                    onChange={(e) => setKeyValue(e.target.value)}
                    placeholder="sk-..."
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={activePref}
                      onChange={(e) => setActivePref(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    {isRtl ? 'اجعله المزود المفضل لمنظمتي' : 'Make this the preferred provider for this firm'}
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        <Dices className="h-4 w-4 shrink-0" />
        <span>
          {isRtl
            ? 'عندما تحدد مزودًا مفضلًا بلا مفتاح أو ليس لديك مفتاح، يستخدم النظام مفتاح منصة Al Mizan تلقائيًا كنسخة احتياطية.'
            : 'When no org key is set (or a preferred provider has no key), Al Mizan automatically falls back to its own platform key.'}
        </span>
      </div>
    </div>
  );
}