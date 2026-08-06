"use client";

// =============================================================================
// Al Mizan — OfflineBanner
// -----------------------------------------------------------------------------
// Persistent top banner shown when the device is offline OR there are queued
// mutations being synced. Mounted once at the workspace root (page.tsx).
//
// Visual states:
//   • Offline          → amber banner, t.offlineModeActive
//   • Syncing          → indigo banner, t.syncingOfflineData + spinner
//   • Just reconnected → brief toast (auto-dismiss in 3.5s) with
//                         t.onlineReconnected
//   • Online + idle    → renders nothing
//
// Reads state from useOfflineSync (no prop drilling).
// =============================================================================

import React, { useEffect, useRef, useState } from "react";
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import { useOfflineSync } from "@/hooks/use-offline-sync";

export default function OfflineBanner() {
  const { t, isRtl } = useLanguage();
  const { isOnline, isSyncing, reconnectFlushedAt, lastError } = useOfflineSync();

  // Show a brief "reconnected" toast when reconnectFlushedAt changes.
  const [showReconnectedToast, setShowReconnectedToast] = useState(false);
  const lastFlushedRef = useRef<number | null>(null);

  useEffect(() => {
    if (
      reconnectFlushedAt != null &&
      reconnectFlushedAt !== lastFlushedRef.current
    ) {
      lastFlushedRef.current = reconnectFlushedAt;
      setShowReconnectedToast(true);
      const timer = setTimeout(() => setShowReconnectedToast(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [reconnectFlushedAt]);

  // Nothing to show — don't render anything to avoid layout shifts.
  if (isOnline && !isSyncing && !showReconnectedToast && !lastError) {
    return null;
  }

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={`fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-bold shadow-md transition-transform duration-300 ${
        !isOnline
          ? "bg-amber-500 text-white"
          : isSyncing
            ? "bg-primary text-white"
            : lastError
              ? "bg-red-600 text-white"
              : "bg-emerald-600 text-white"
      }`}
      role="status"
      aria-live="polite"
    >
      {!isOnline ? (
        <>
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>{t.offlineModeActive}</span>
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
          <span>{t.syncingOfflineData}</span>
        </>
      ) : lastError ? (
        <>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            {t.offlineSyncFailed}: {lastError}
          </span>
        </>
      ) : showReconnectedToast ? (
        <>
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{t.onlineReconnected}</span>
        </>
      ) : (
        <>
          <Wifi className="w-3.5 h-3.5 shrink-0" />
          <span>{t.offlineModeActive}</span>
        </>
      )}
    </div>
  );
}
