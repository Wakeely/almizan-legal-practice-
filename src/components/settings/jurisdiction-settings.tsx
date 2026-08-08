'use client';

// =============================================================================
// JurisdictionSettings — organization-level default jurisdiction picker.
// -----------------------------------------------------------------------------
// Renders a card on the /workspace/billing page (alongside ByokSettings) that
// lets the Managing Partner pick the firm's primary country. The selection:
//   • Updates Organization.jurisdiction via PUT /api/organization/jurisdiction
//   • Drives the default jurisdiction on every new matter intake form
//   • Feeds the country-specific legal context into every AI system prompt
//
// Bilingual + RTL-aware. Read-only for non-managing-partners (they see the
// current jurisdiction + its court system / procedural rules / arbitration
// rules, but no Save button).
// =============================================================================

import React, { useEffect, useState } from 'react';
import { Globe, Save, Loader2, Check, AlertCircle, Building2 } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import {
  JURISDICTION_LIST,
  JURISDICTIONS,
  type JurisdictionInfo,
} from '@/lib/jurisdictions';
import { cn } from '@/lib/utils';

interface OrgJurisdictionResponse {
  organization: {
    id: string;
    name: string;
    rawJurisdiction: string;
    jurisdictionCode: string;
    isCanonical: boolean;
  };
  current: JurisdictionInfo;
  catalog: JurisdictionInfo[];
}

interface UserProfileLite {
  role?: string;
}

export default function JurisdictionSettings({ user }: { user?: UserProfileLite | null }) {
  const { isRtl, t } = useLanguage();
  const [data, setData] = useState<OrgJurisdictionResponse | null>(null);
  const [selected, setSelected] = useState<JurisdictionCode | ''>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Pull the role from the auth provider if the caller didn't pass it.
  // We avoid importing useAuth here so this card can be reused on pages that
  // don't sit inside the AuthProvider subtree (none today, but defensive).
  const isManagingPartner = user?.role === 'Managing Partner';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/organization/jurisdiction');
      if (!res.ok) throw new Error('Failed to load jurisdiction');
      const d = (await res.json()) as OrgJurisdictionResponse;
      setData(d);
      setSelected(d.current.code);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load jurisdiction');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setNotice('');
    setError('');
    try {
      const res = await fetch('/api/organization/jurisdiction', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jurisdiction: selected }),
      });
      if (!res.ok) {
        const body = await res.json().catch((): null => null);
        throw new Error(body?.error ?? 'Failed to save jurisdiction');
      }
      const d = (await res.json()) as OrgJurisdictionResponse;
      setData(d);
      setSelected(d.current.code);
      setNotice(t.jurisdictionSettingsSaved);
    } catch (e: any) {
      setError(e?.message ?? t.jurisdictionSettingsError);
    } finally {
      setSaving(false);
    }
  };

  const currentInfo = data?.current ?? null;
  const showLegacyWarning = data && !data.organization.isCanonical;

  return (
    <div className="rounded-xl border bg-card p-5 md:p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-1">
        <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
          <Globe className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {t.jurisdictionSettingsTitle}
          </h2>
          <p className="text-sm text-slate-500 max-w-2xl">
            {t.jurisdictionSettingsDesc}
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <Check className="h-4 w-4" /> {notice}
        </div>
      )}

      {showLegacyWarning && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {isRtl
              ? `القيمة الحالية "${data!.organization.rawJurisdiction}" قيمة قديمة. سيتم تحديثها إلى الصيغة المعيارية "${JURISDICTIONS[data!.current.code].labelBilingual}" عند الحفظ.`
              : `Current value "${data!.organization.rawJurisdiction}" is a legacy label. Saving will normalize it to "${JURISDICTIONS[data!.current.code].labelBilingual}".`}
          </span>
        </div>
      )}

      {/* Read-only jurisdiction summary */}
      {currentInfo && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <SummaryRow
            label={t.jurisdictionSettingsCurrent}
            value={isRtl ? currentInfo.labelAr : currentInfo.labelEn}
            icon={<Globe className="h-3.5 w-3.5" />}
          />
          <SummaryRow
            label={t.jurisdictionSettingsCourt}
            value={isRtl ? currentInfo.courtSystemAr : currentInfo.courtSystemEn}
            icon={<Building2 className="h-3.5 w-3.5" />}
          />
          <SummaryRow
            label={t.jurisdictionSettingsProcedure}
            value={isRtl ? currentInfo.proceduralRulesetAr : currentInfo.proceduralRulesetEn}
          />
          <SummaryRow
            label={t.jurisdictionSettingsArbitration}
            value={isRtl ? currentInfo.arbitrationRulesAr : currentInfo.arbitrationRulesEn}
          />
          <SummaryRow
            label={t.jurisdictionSettingsLanguage}
            value={
              currentInfo.languageOfProceedings === 'ar'
                ? t.jurisdictionLanguageAr
                : currentInfo.languageOfProceedings === 'en'
                  ? t.jurisdictionLanguageEn
                  : t.jurisdictionLanguageArEn
            }
          />
        </div>
      )}

      {/* Picker — visible to everyone; Save button gated to Managing Partner */}
      <div className="mt-5">
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          {t.jurisdictionSettingsCurrent}
        </label>
        <div className="flex flex-wrap items-stretch gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value as JurisdictionCode)}
            disabled={loading || saving}
            className="flex-1 min-w-[220px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none disabled:opacity-60"
          >
            {loading && <option value="">…</option>}
            {JURISDICTION_LIST.map((info) => (
              <option key={info.code} value={info.code}>
                {isRtl ? info.labelAr : info.labelEn}
                {' — '}
                {isRtl ? info.labelEn : info.labelAr}
              </option>
            ))}
          </select>
          {isManagingPartner && (
            <button
              onClick={handleSave}
              disabled={loading || saving || !selected || selected === data?.current.code}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? t.jurisdictionSettingsSaving : t.jurisdictionSettingsSave}
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {t.jurisdictionSettingsHelperOrg}
        </p>
        {!isManagingPartner && (
          <p className="mt-2 text-xs text-amber-700">
            {isRtl
              ? 'يمكن للشريك الإداري فقط تعديل هذا الإعداد.'
              : 'Only the Managing Partner can change this setting.'}
          </p>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

type JurisdictionCode = keyof typeof JURISDICTIONS;

function SummaryRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-slate-800 leading-snug">{value}</div>
    </div>
  );
}
