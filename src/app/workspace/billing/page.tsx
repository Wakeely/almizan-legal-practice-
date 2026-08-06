"use client";

import { useMatters } from "@/components/providers/matters-provider";
import BillingModule from "@/components/billing/billing-module";
import ByokSettings from "@/components/ai/byok-settings";

export default function BillingPage() {
  const { activeMatter, refresh } = useMatters();
  // AI key management is org-level and independent of the selected matter, so
  // it renders even when no active matter is selected.
  return (
    <div className="space-y-6">
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