"use client";

import { useMatters } from "@/components/providers/matters-provider";
import TriageDashboard from "@/components/workspace/triage-dashboard";
import AnalyticsModule from "@/components/analytics/analytics-module";

export default function OverviewPage() {
  const { activeMatter } = useMatters();
  if (!activeMatter) return null;
  return (
    <>
      <TriageDashboard matter={activeMatter} />
      <div className="mt-6">
        <AnalyticsModule activeMatter={activeMatter} />
      </div>
    </>
  );
}
