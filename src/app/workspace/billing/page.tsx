"use client";

import { useMatters } from "@/components/providers/matters-provider";
import BillingModule from "@/components/billing/billing-module";

export default function BillingPage() {
  const { activeMatter, refresh } = useMatters();
  if (!activeMatter) return null;
  return <BillingModule activeMatter={activeMatter} onRefreshMatter={refresh} />;
}