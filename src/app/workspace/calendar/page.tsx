"use client";

import { useMatters } from "@/components/providers/matters-provider";
import CalendarModule from "@/components/calendar/calendar-module";

export default function CalendarPage() {
  const { activeMatter, matters } = useMatters();
  if (!activeMatter) return null;
  return <CalendarModule matterId={activeMatter.id} matters={matters} />;
}