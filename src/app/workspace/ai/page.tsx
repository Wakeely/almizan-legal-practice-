"use client";

import { useMatters } from "@/components/providers/matters-provider";
import AiModule from "@/components/ai/ai-module";

export default function AiPage() {
  const { activeMatter } = useMatters();
  if (!activeMatter) return null;
  return <AiModule activeMatter={activeMatter} />;
}