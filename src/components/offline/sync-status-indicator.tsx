"use client";

// =============================================================================
// Al Mizan — SyncStatusIndicator
// -----------------------------------------------------------------------------
// Small badge rendered in the footer (or header) that shows:
//   • "N pending changes • Last synced HH:MM"   (online, idle)
//   • "N pending changes • Never synced"        (online, never synced)
//   • "Syncing…"                                 (during flush)
//   • "Offline • N pending"                      (offline)
//   • "Sync now" button                          (online, pending > 0, idle)
//
// Reads state from useOfflineSync. Calls window.__almizanFlushOffline (set by
// the hook) to trigger a manual flush.
// =============================================================================

import React, { useMemo } from "react";
import { RefreshCw, CloudOff, Cloud, CheckCircle2, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import { useOfflineSync } from "@/hooks/use-offline-sync";

function formatTime(ts: number | null, locale: string): string {
  if (ts == null) return "";
  try {
    return new Date(ts).toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return new Date(ts).toISOString().slice(11, 16);
  }
}

export default function SyncStatusIndicator() {
  const { t, isRtl, language } = useLanguage();
  const { isOnline, isSyncing, pendingCount, lastSyncedAt, lastError } =
    useOfflineSync();

  const locale = useMemo(() => {
    // navigator may be undefined during SSR.
    if (typeof navigator !== "undefined") return navigator.language;
    return language === "ar" ? "ar" : "en";
  }, [language]);

  const handleSyncNow = () => {
    const w = window as unknown as { __almizanFlushOffline?: () => void };
    if (typeof w.__almizanFlushOffline === "function") {
      w.__almizanFlushOffline();
    }
  };

  const lastSyncedLabel =
    lastSyncedAt == null
      ? t.offlineNeverSynced
      : `${t.offlineLastSynced} ${formatTime(lastSyncedAt, locale)}`;

  // Compact visual: icon + short text. RTL-aware.
  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
      title={
        !isOnline
          ? `${t.offlineModeActive} • ${pendingCount} ${t.offlinePendingChanges}`
          : isSyncing
            ? t.syncingOfflineData
            : `${pendingCount} ${t.offlinePendingChanges} • ${lastSyncedLabel}`
      }
    >
      {isSyncing ? (
        <RefreshCw className="w-3 h-3 animate-spin text-primary" />
      ) : !isOnline ? (
        <CloudOff className="w-3 h-3 text-amber-500" />
      ) : lastError ? (
        <AlertTriangle className="w-3 h-3 text-red-500" />
      ) : pendingCount > 0 ? (
        <RefreshCw className="w-3 h-3 text-primary" />
      ) : (
        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
      )}

      {!isOnline ? (
        <span>{t.offlineMode}</span>
      ) : isSyncing ? (
        <span>{t.syncingOfflineData}</span>
      ) : (
        <span>
          {pendingCount} {t.offlinePendingChanges}
        </span>
      )}

      {/* Separator + last-synced (hidden on very small screens) */}
      <span className="hidden sm:inline text-muted-foreground/60">•</span>
      <span className="hidden sm:inline">{lastSyncedLabel}</span>

      {isOnline && !isSyncing && pendingCount > 0 && (
        <button
          type="button"
          onClick={handleSyncNow}
          className="ml-1 px-2 py-0.5 rounded-md bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold transition-colors cursor-pointer"
        >
          {t.offlineSyncNow}
        </button>
      )}
    </div>
  );
}
