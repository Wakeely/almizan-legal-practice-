"use client";

import { useMatters } from "@/components/providers/matters-provider";
import DocumentsModule from "@/components/documents/documents-module";

export default function DocumentsPage() {
  const { activeMatter, refresh } = useMatters();
  if (!activeMatter) return null;
  return <DocumentsModule matterId={activeMatter.id} onRefreshExpenses={refresh} />;
}