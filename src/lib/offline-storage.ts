// =============================================================================
// Al Mizan Legal Practice — IndexedDB offline storage (real implementation)
// -----------------------------------------------------------------------------
// Provides courtroom offline resilience: when the device loses connectivity
// (e.g. inside court basements, elevators, transit), the user can continue
// viewing and editing matters/documents/tasks/time entries/invoices.
// All data is automatically cached locally via IndexedDB.
//
// API surface is identical to the previous in-memory stub so all callers
// (TasksModule, DocumentsModule, BillingModule, CalendarModule,
// GlobalSearchModal) work without changes.
// =============================================================================

export const STORES = {
  MATTERS: "matters",
  TASKS: "tasks",
  DOCUMENTS: "documents",
  TIME_ENTRIES: "time_entries",
  INVOICES: "invoices",
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

// IndexedDB database name + version
const DB_NAME = "almizan-offline-cache";
const DB_VERSION = 1;

// Lazy-init the DB — only available in browser, not server-side
let _dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB not available (server-side or unsupported browser)"));
  }
  if (!_dbPromise) {
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        // Create one object store per STORES entry, keyed by id
        // Use matterId as an index so getByMatterIdFromOfflineStore is fast
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
  return getDb().then((db) => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}

/**
 * Save items to the offline store, keyed by id (with matterId indexed).
 * If a single item is passed (not an array), wraps it in an array.
 * Replaces existing items with the same id (upsert behavior).
 */
export async function saveItemsToOfflineStore<T extends { id: string; matterId?: string }>(
  store: StoreName,
  items: T | T[],
): Promise<void> {
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
export async function getAllFromOfflineStore<T>(store: StoreName): Promise<T[]> {
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
