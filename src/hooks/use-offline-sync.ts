"use client";

// =============================================================================
// Al Mizan — useOfflineSync hook
// -----------------------------------------------------------------------------
// Centralised hook that:
//   • Tracks online/offline state via window 'online' / 'offline' events.
//   • Tracks the count of pending mutations in IndexedDB.
//   • Tracks "last synced at" timestamp in localStorage (per device).
//   • On reconnect (or visibilitychange while online), flushes the pending
//     queue via replayMutation() in order, applying last-write-wins.
//   • Dispatches CustomEvents so other components (OfflineBanner,
//     SyncStatusIndicator) can react without prop drilling.
//
// Designed to be mounted exactly once at the workspace root (see page.tsx).
// Subscribes to 'almizan:pending-mutations-changed' events emitted by
// offline-storage.ts whenever the queue changes.
// =============================================================================

import { useEffect, useRef, useState, useCallback } from "react";
import {
  getPendingMutations,
  removeMutation,
  markMutationFailed,
  countPendingMutations,
} from "@/lib/offline-storage";
import { replayMutation } from "@/lib/offline-fetch";

export interface OfflineSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: number | null;
  /** Bumped whenever a reconnect + flush completes — useful for toasts. */
  reconnectFlushedAt: number | null;
  /** Last error message if any mutation permanently failed during last flush. */
  lastError: string | null;
}

const LAST_SYNCED_KEY = "almizan:last-synced-at";

function readLastSynced(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(LAST_SYNCED_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function writeLastSynced(ts: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_SYNCED_KEY, String(ts));
  } catch {
    /* ignore */
  }
}

export function useOfflineSync(): OfflineSyncState {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [reconnectFlushedAt, setReconnectFlushedAt] = useState<number | null>(
    null,
  );
  const [lastError, setLastError] = useState<string | null>(null);

  // Guard against concurrent flushes (online event can fire multiple times).
  const flushingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const n = await countPendingMutations();
    setPendingCount(n);
  }, []);

  // Initial state from navigator + storage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine !== false);
    setLastSyncedAt(readLastSynced());
    refreshPendingCount();
  }, [refreshPendingCount]);

  // Listen to online/offline + pending-mutations-changed.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      // Fire-and-forget; flush guards against re-entry.
      void flushPending();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    const handlePendingChanged = () => {
      void refreshPendingCount();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(
      "almizan:pending-mutations-changed",
      handlePendingChanged as EventListener,
    );

    // Flush on focus / visibilitychange (laptop woke up, tab returned).
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void flushPending();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(
        "almizan:pending-mutations-changed",
        handlePendingChanged as EventListener,
      );
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush the entire pending queue in order. Public (used by the SyncStatus
  // indicator's "Sync now" button) and internal (online event).
  const flushPending = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    setIsSyncing(true);
    setLastError(null);
    try {
      const queue = await getPendingMutations(false);
      if (queue.length === 0) {
        const ts = Date.now();
        writeLastSynced(ts);
        setLastSyncedAt(ts);
        return;
      }

      let permanentFailureMsg: string | null = null;

      for (const mutation of queue) {
        try {
          const res = await replayMutation(mutation);
          if (res.ok) {
            await removeMutation(mutation.id);
          } else if (res.status >= 400 && res.status < 500) {
            // 4xx → permanent failure. Mark as failed so it doesn't loop.
            const errText = await res
              .json()
              .catch(() => ({ error: `HTTP ${res.status}` }))
              .then((d: { error?: string }) => d.error || `HTTP ${res.status}`);
            await markMutationFailed(mutation.id, errText);
            permanentFailureMsg = errText;
            // eslint-disable-next-line no-console
            console.warn(
              `[offline-sync] Mutation ${mutation.id} permanently failed:`,
              errText,
            );
          } else {
            // 5xx → leave in queue, will retry on next online event.
            // eslint-disable-next-line no-console
            console.warn(
              `[offline-sync] Mutation ${mutation.id} transient failure (HTTP ${res.status}); will retry.`,
            );
            break; // stop the flush — server is unhealthy
          }
        } catch (err) {
          // Network dropped mid-flush — stop and wait for next online event.
          // eslint-disable-next-line no-console
          console.warn(
            `[offline-sync] Network error flushing ${mutation.id}; stopping.`,
            err,
          );
          break;
        }
      }

      const ts = Date.now();
      writeLastSynced(ts);
      setLastSyncedAt(ts);
      setReconnectFlushedAt(ts);
      if (permanentFailureMsg) setLastError(permanentFailureMsg);
      await refreshPendingCount();

      // Tell the rest of the app to refresh its data from the server now
      // that we've replayed queued mutations.
      try {
        window.dispatchEvent(new CustomEvent("almizan:sync-complete"));
      } catch {
        /* ignore */
      }
    } finally {
      setIsSyncing(false);
      flushingRef.current = false;
    }
  }, [refreshPendingCount]);

  // Expose flushPending globally for ad-hoc invocation (SyncStatus "Sync now"
  // button). We don't bother with React context because the banner + indicator
  // read state through the hook return value.
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as unknown as { __almizanFlushOffline?: () => void }).__almizanFlushOffline =
      () => {
        void flushPending();
      };
  }, [flushPending]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncedAt,
    reconnectFlushedAt,
    lastError,
  };
}
