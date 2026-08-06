"use client";

import { useMatters } from "@/components/providers/matters-provider";
import { useAuth } from "@/components/providers/auth-provider";
import BillingModule from "@/components/billing/billing-module";
import ByokSettings from "@/components/ai/byok-settings";
import JurisdictionSettings from "@/components/settings/jurisdiction-settings";

export default function BillingPage() {
  const { activeMatter, refresh } = useMatters();
  const { user } = useAuth();
  // Org-level configuration (BYOK + jurisdiction) renders independently of the
  // active matter so it stays visible even when no matter is selected.
  return (
    <div className="space-y-6">
      <JurisdictionSettings user={user} />
      <ByokSettings />
      {activeMatter ? (
        <BillingModule activeMatter={activeMatter} onRefreshMatter={refresh} />
      ) : (
        <p className="text-sm text-slate-400">
          Select a matter to view billing, time entries, and invoices.
        </p>
      )}
    </div>
  );
}