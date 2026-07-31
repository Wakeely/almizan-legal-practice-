// =============================================================================
// Al Mizan Legal Practice — IndexedDB offline storage (real implementation)
// -----------------------------------------------------------------------------
// Provides courtroom offline resilience: when the device loses connectivity
// (e.g. inside court basements, elevators, transit), the user can continue
// viewing and editing matters/documents/tasks/time entries/invoices/calendar.
//
// Layer 1 (read cache) — STORES.MATTERS / TASKS / DOCUMENTS / TIME_ENTRIES /
// INVOICES / CALENDAR_EVENTS. Each module already does read-fallback +
// write-back on successful online fetch.
//
// Layer 2 (mutation queue) — STORES.PENDING_MUTATIONS. When offline, mutating
// fetches are enqueued and flushed in order on reconnect. See
// src/lib/offline-fetch.ts for the wrapper.
//
// All helpers are SSR-safe (guarded against `typeof window === "undefined"`).
// =============================================================================

export const STORES = {
  MATTERS: "matters",
  TASKS: "tasks",
  DOCUMENTS: "documents",
  TIME_ENTRIES: "time_entries",
  INVOICES: "invoices",
  CALENDAR_EVENTS: "calendar_events",
  PENDING_MUTATIONS: "pending_mutations",
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

// IndexedDB database name + version.
// Version 2 adds CALENDAR_EVENTS + PENDING_MUTATIONS stores.
const DB_NAME = "almizan-offline-cache";
const DB_VERSION = 2;

/**
 * Shape of a queued offline mutation. Stored in PENDING_MUTATIONS and flushed
 * in order by `flushPendingMutations()` when connectivity returns.
 */
export interface PendingMutation {
  /** uuid generated at enqueue time. Used as the IndexedDB key. */
  id: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** epoch ms — used for last-write-wins conflict resolution on flush. */
  timestamp: number;
  /** optional context to help reconcile the optimistic UI after flush. */
  matterId?: string;
  resourceType?: string;
  resourceId?: string;
  /**
   * After a permanent 4xx failure, the mutation is marked `failed` and no
   * longer retried automatically. UI may surface it to the user.
   */
  failed?: boolean;
  failReason?: string;
}

// Lazy-init the DB — only available in browser, not server-side
let _dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(
      new Error("IndexedDB not available (server-side or unsupported browser)"),
    );
  }
  if (!_dbPromise) {
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        // Create one object store per STORES entry, keyed by id.
        // Use matterId as an index so getByMatterIdFromOfflineStore is fast.
        for (const storeName of Object.values(STORES)) {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: "id" });
            store.createIndex("matterId", "matterId", { unique: false });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return _dbPromise;
}

function tx<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return getDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

/**
 * Save items to the offline store, keyed by id (with matterId indexed).
 * If a single item is passed (not an array), wraps it in an array.
 * Replaces existing items with the same id (upsert behavior).
 */
export async function saveItemsToOfflineStore<
  T extends { id: string; matterId?: string },
>(store: StoreName, items: T | T[]): Promise<void> {
  // Guard against server-side rendering
  if (typeof window === "undefined" || !("indexedDB" in window)) return;

  const arr = Array.isArray(items) ? items : [items];
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(store, "readwrite");
    const objectStore = transaction.objectStore(store);
    for (const item of arr) {
      objectStore.put(item);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Retrieve all items for a given matterId from the offline store.
 */
export async function getByMatterIdFromOfflineStore<T>(
  store: StoreName,
  matterId: string,
): Promise<T[]> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return [];

  try {
    const db = await getDb();
    return await new Promise<T[]>((resolve, reject) => {
      const transaction = db.transaction(store, "readonly");
      const objectStore = transaction.objectStore(store);
      const index = objectStore.index("matterId");
      const request = index.getAll(matterId);
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

/**
 * Retrieve ALL items across all matterIds from the offline store.
 */
export async function getAllFromOfflineStore<T>(
  store: StoreName,
): Promise<T[]> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return [];

  try {
    return await tx<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
  } catch {
    return [];
  }
}

/**
 * Clear all items from a given store (testing / cache reset).
 */
export async function clearOfflineStore(store: StoreName): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;

  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, "readwrite");
      const objectStore = transaction.objectStore(store);
      objectStore.clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // ignore — fail silently on offline errors
  }
}

/**
 * Delete a single item by id from a store. Used after a mutation confirms or
 * to remove stale cache entries.
 */
export async function deleteFromOfflineStore(
  store: StoreName,
  id: string,
): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  try {
    await tx(store, "readwrite", (s) => s.delete(id));
  } catch {
    // ignore
  }
}

// =============================================================================
// PENDING_MUTATIONS — offline write queue
// =============================================================================

/**
 * Append a mutation to the pending queue. Called by the offline-aware fetch
 * wrapper when the device is offline or the network request fails.
 */
export async function enqueueMutation(
  mutation: PendingMutation,
): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  await saveItemsToOfflineStore(STORES.PENDING_MUTATIONS, mutation);
  // Notify any listeners (SyncStatusIndicator, banner flush, etc.)
  try {
    window.dispatchEvent(
      new CustomEvent("almizan:pending-mutations-changed", {
        detail: { type: "enqueue", id: mutation.id },
      }),
    );
  } catch {
    /* ignore */
  }
}

/**
 * Return all pending mutations in enqueue order (oldest first).
 * Failed mutations are excluded by default.
 */
export async function getPendingMutations(
  includeFailed = false,
): Promise<PendingMutation[]> {
  const all = await getAllFromOfflineStore<PendingMutation>(
    STORES.PENDING_MUTATIONS,
  );
  const filtered = includeFailed
    ? all
    : all.filter((m) => !m.failed);
  return filtered.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Remove a mutation from the queue after it has been successfully flushed.
 */
export async function removeMutation(id: string): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  await deleteFromOfflineStore(STORES.PENDING_MUTATIONS, id);
  try {
    window.dispatchEvent(
      new CustomEvent("almizan:pending-mutations-changed", {
        detail: { type: "remove", id },
      }),
    );
  } catch {
    /* ignore */
  }
}

/**
 * Mark a mutation as permanently failed (e.g. 4xx response) instead of
 * removing it, so the user can be notified that a queued change did not sync.
 */
export async function markMutationFailed(
  id: string,
  reason: string,
): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  const all = await getAllFromOfflineStore<PendingMutation>(
    STORES.PENDING_MUTATIONS,
  );
  const target = all.find((m) => m.id === id);
  if (!target) return;
  await saveItemsToOfflineStore(STORES.PENDING_MUTATIONS, {
    ...target,
    failed: true,
    failReason: reason,
  });
  try {
    window.dispatchEvent(
      new CustomEvent("almizan:pending-mutations-changed", {
        detail: { type: "fail", id },
      }),
    );
  } catch {
    /* ignore */
  }
}

/**
 * Clear the entire pending queue (testing / "discard all changes" UI action).
 */
export async function clearPendingMutations(): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  await clearOfflineStore(STORES.PENDING_MUTATIONS);
  try {
    window.dispatchEvent(
      new CustomEvent("almizan:pending-mutations-changed", {
        detail: { type: "clear" },
      }),
    );
  } catch {
    /* ignore */
  }
}

/**
 * Count pending mutations without loading all of them (for the status badge).
 */
export async function countPendingMutations(): Promise<number> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return 0;
  try {
    const all = await getAllFromOfflineStore<PendingMutation>(
      STORES.PENDING_MUTATIONS,
    );
    return all.filter((m) => !m.failed).length;
  } catch {
    return 0;
  }
}
