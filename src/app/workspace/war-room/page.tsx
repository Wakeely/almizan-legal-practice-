"use client";

import { useMatters } from "@/components/providers/matters-provider";
import WarRoomModule from "@/components/war-room/war-room-module";

export default function WarRoomPage() {
  const { activeMatter } = useMatters();
  if (!activeMatter) return null;
  return <WarRoomModule activeMatter={activeMatter} />;
}