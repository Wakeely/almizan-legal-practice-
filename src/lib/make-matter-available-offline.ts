"use client";

// =============================================================================
// Al Mizan — make-matter-available-offline helper
// -----------------------------------------------------------------------------
// Triggered by the "Make this matter available offline" button. Fetches and
// caches all of a matter's data (tasks, documents, time entries, invoices,
// calendar events) so the user can keep working with zero connectivity.
//
// Caching strategy:
//   1. matter itself is already cached by page.tsx fetchMatters().
//   2. For each sub-resource, call the existing API; on success, write the
//      response into the matching STORES.* via saveItemsToOfflineStore.
//   3. Optionally pre-fetch document binaries (Phase 4.14) into a separate
//      Cache API bucket keyed by document id. Off by default; the UI passes
//      `includeBinaries: true` only after user consent.
// =============================================================================

import {
  STORES,
  saveItemsToOfflineStore,
} from "@/lib/offline-storage";

export interface MakeAvailableOfflineProgress {
  step: string;
  done: number;
  total: number;
}

export interface MakeAvailableOfflineResult {
  ok: boolean;
  matterId: string;
  counts: {
    tasks: number;
    documents: number;
    timeEntries: number;
    invoices: number;
    calendarEvents: number;
    binaries?: number;
  };
  error?: string;
}

const TOTAL_STEPS = 5;

/**
 * Fetch + cache all sub-resources for a matter so it is fully usable offline.
 * Returns progress via the optional onProgress callback.
 */
export async function makeMatterAvailableOffline(
  matterId: string,
  options?: {
    includeBinaries?: boolean;
    onProgress?: (p: MakeAvailableOfflineProgress) => void;
  },
): Promise<MakeAvailableOfflineResult> {
  const counts: MakeAvailableOfflineResult["counts"] = {
    tasks: 0,
    documents: 0,
    timeEntries: 0,
    invoices: 0,
    calendarEvents: 0,
  };

  const report = (
    step: string,
    done: number,
  ) => {
    options?.onProgress?.({ step, done, total: TOTAL_STEPS });
  };

  try {
    // 1. Tasks
    report("tasks", 0);
    try {
      const res = await fetch(`/api/matters/${matterId}/tasks`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          await saveItemsToOfflineStore(STORES.TASKS, data);
          counts.tasks = data.length;
        }
      }
    } catch {
      /* ignore — partial cache is still useful */
    }

    // 2. Documents (metadata)
    report("documents", 1);
    let documents: { id: string; matterId?: string }[] = [];
    try {
      const res = await fetch(`/api/matters/${matterId}/documents`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          documents = data;
          if (data.length > 0) {
            await saveItemsToOfflineStore(STORES.DOCUMENTS, data);
            counts.documents = data.length;
          }
        }
      }
    } catch {
      /* ignore */
    }

    // 3. Billing (time entries + invoices)
    report("billing", 2);
    try {
      const res = await fetch(`/api/matters/${matterId}/billing`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.timeEntries && Array.isArray(data.timeEntries) && data.timeEntries.length > 0) {
          await saveItemsToOfflineStore(STORES.TIME_ENTRIES, data.timeEntries);
          counts.timeEntries = data.timeEntries.length;
        }
        if (data.invoices && Array.isArray(data.invoices) && data.invoices.length > 0) {
          await saveItemsToOfflineStore(STORES.INVOICES, data.invoices);
          counts.invoices = data.invoices.length;
        }
      }
    } catch {
      /* ignore */
    }

    // 4. Calendar events
    report("calendar", 3);
    try {
      const res = await fetch(`/api/matters/${matterId}/calendar`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          await saveItemsToOfflineStore(STORES.CALENDAR_EVENTS, data);
          counts.calendarEvents = data.length;
        }
      }
    } catch {
      /* ignore */
    }

    // 5. (Optional) Document binaries via Cache API.
    if (options?.includeBinaries && documents.length > 0) {
      report("binaries", 4);
      try {
        const binCache = await caches.open("almizan-doc-blobs-v1");
        let binCount = 0;
        for (const doc of documents) {
          try {
            const fileRes = await fetch(`/api/documents/${doc.id}/file`, {
              credentials: "same-origin",
            });
            if (fileRes.ok) {
              await binCache.put(`/api/documents/${doc.id}/file`, fileRes.clone());
              binCount++;
            }
          } catch {
            /* skip individual failures */
          }
        }
        counts.binaries = binCount;
      } catch {
        /* ignore — metadata cache still useful */
      }
    } else {
      report("done", 4);
    }

    return { ok: true, matterId, counts };
  } catch (err) {
    return {
      ok: false,
      matterId,
      counts,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Check whether a document binary is cached for offline use (Cache API).
 * Used by DocumentsModule to render a "cached" badge.
 */
export async function isDocumentBinaryCached(docId: string): Promise<boolean> {
  if (typeof window === "undefined" || !("caches" in window)) return false;
  try {
    const cache = await caches.open("almizan-doc-blobs-v1");
    const res = await cache.match(`/api/documents/${docId}/file`);
    return !!res;
  } catch {
    return false;
  }
}

/**
 * Try to read a cached document binary. Returns null if not cached.
 */
export async function getCachedDocumentBlob(
  docId: string,
): Promise<Blob | null> {
  if (typeof window === "undefined" || !("caches" in window)) return null;
  try {
    const cache = await caches.open("almizan-doc-blobs-v1");
    const res = await cache.match(`/api/documents/${docId}/file`);
    if (!res) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/**
 * Cache a document binary after a successful online download (so subsequent
 * offline opens work without re-fetching).
 */
export async function cacheDocumentBlob(
  docId: string,
  blob: Blob,
): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;
  try {
    const cache = await caches.open("almizan-doc-blobs-v1");
    const res = new Response(blob);
    await cache.put(`/api/documents/${docId}/file`, res);
  } catch {
    /* ignore */
  }
}
