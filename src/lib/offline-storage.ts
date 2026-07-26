// =============================================================================
// offlineStorage — STUB (in-memory)
// -----------------------------------------------------------------------------
// The reference UI uses IndexedDB for offline access during court sessions.
// This stub provides the same API surface but uses in-memory Map storage so
// the workspace modules compile and run in Turn 2. The REAL IndexedDB-backed
// implementation ships in Turn 5 (offline resilience feature).
// =============================================================================

export const STORES = {
  MATTERS: "matters",
  TASKS: "tasks",
  DOCUMENTS: "documents",
  TIME_ENTRIES: "time_entries",
  INVOICES: "invoices",
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

// In-memory cache: storeName → Map<matterId, items[]>
const memoryCache: Map<StoreName, Map<string, unknown[]>> = new Map();

function getStoreMap(store: StoreName): Map<string, unknown[]> {
  if (!memoryCache.has(store)) memoryCache.set(store, new Map());
  return memoryCache.get(store)!;
}

/**
 * Save items to the offline store, keyed by their `matterId` field.
 * If a single item is passed (not an array), wraps it in an array.
 */
export async function saveItemsToOfflineStore<T extends { matterId?: string; id?: string }>(
  store: StoreName,
  items: T | T[],
): Promise<void> {
  const arr = Array.isArray(items) ? items : [items];
  const storeMap = getStoreMap(store);
  for (const item of arr) {
    const matterId = (item as any).matterId ?? "__global__";
    const existing = storeMap.get(matterId) ?? [];
    // Merge by id (replace if exists, append otherwise)
    const idx = existing.findIndex((e) => (e as any).id === (item as any).id);
    if (idx >= 0) existing[idx] = item;
    else existing.push(item);
    storeMap.set(matterId, existing);
  }
}

/**
 * Retrieve all items for a given matterId from the offline store.
 */
export async function getByMatterIdFromOfflineStore<T>(
  store: StoreName,
  matterId: string,
): Promise<T[]> {
  const storeMap = getStoreMap(store);
  return (storeMap.get(matterId) ?? []) as T[];
}

/**
 * Retrieve ALL items across all matterIds from the offline store.
 */
export async function getAllFromOfflineStore<T>(store: StoreName): Promise<T[]> {
  const storeMap = getStoreMap(store);
  const all: T[] = [];
  for (const items of storeMap.values()) all.push(...(items as T[]));
  return all;
}

/**
 * Clear all items from a given store (testing / cache reset).
 */
export async function clearOfflineStore(store: StoreName): Promise<void> {
  memoryCache.set(store, new Map());
}
