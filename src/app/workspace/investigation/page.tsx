"use client";

import { useMatters } from "@/components/providers/matters-provider";
import InvestigationModule from "@/components/investigation/investigation-module";

export default function InvestigationPage() {
  const { activeMatter } = useMatters();
  if (!activeMatter) return null;
  return <InvestigationModule activeMatter={activeMatter} />;
}