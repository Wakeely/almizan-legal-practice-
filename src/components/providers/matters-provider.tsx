"use client";

// =============================================================================
// MattersProvider — shared matters + active-matter state for both the lawyer
// workspace and the client portal route groups. Each shell owns its own URL
// sync (workspace writes ?matter=, client portal writes /matters/[id]); this
// provider only holds the in-memory source of truth.
// =============================================================================

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { Matter } from "@/lib/types";
import {
  saveItemsToOfflineStore,
  getAllFromOfflineStore,
  STORES,
} from "@/lib/offline-storage";

interface MattersContextValue {
  matters: Matter[];
  activeMatter: Matter | null;
  activeMatterId: string;
  setActiveMatterId: (id: string) => void;
  mattersLoading: boolean;
  refresh: () => Promise<void>;
  addMatter: (matter: Matter) => void;
  updateMatter: (matter: Matter) => void;
}

const MattersContext = createContext<MattersContextValue | undefined>(undefined);

export function MattersProvider({
  initialMatterId,
  children,
}: {
  initialMatterId?: string;
  children: React.ReactNode;
}) {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [activeMatterId, setActiveMatterIdState] = useState<string>(initialMatterId ?? "");
  const [mattersLoading, setMattersLoading] = useState(true);
  const initialMatterRef = useRef<string>(initialMatterId ?? "");

  // Adopt a new explicit matter from the URL (deep link / navigation) whenever
  // the route-provided id changes.
  useEffect(() => {
    if (initialMatterId && initialMatterId !== initialMatterRef.current) {
      initialMatterRef.current = initialMatterId;
      setActiveMatterIdState(initialMatterId);
    }
  }, [initialMatterId]);

  const refresh = useCallback(async () => {
    setMattersLoading(true);
    try {
      const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (!isOffline) {
        try {
          const res = await fetch("/api/matters", { cache: "no-store" });
          if (res.ok) {
            const raw = await res.json();
            const data: Matter[] = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
            setMatters(data);
            if (data.length > 0) {
              await saveItemsToOfflineStore(STORES.MATTERS, data);
              // Auto-select first matter only when nothing is already chosen
              // (an explicit URL matter id always wins).
              setActiveMatterIdState((prev) => prev || data[0].id);
            }
            return;
          }
        } catch (err) {
          console.warn("Matters fetch failed; falling back to offline cache:", err);
        }
      }
      const cached = await getAllFromOfflineStore<Matter>(STORES.MATTERS);
      if (cached && cached.length > 0) {
        setMatters(cached);
        setActiveMatterIdState((prev) => prev || cached[0].id);
      } else {
        setMatters([]);
      }
    } catch (err) {
      console.error("Failed to fetch matters:", err);
    } finally {
      setMattersLoading(false);
    }
  }, []);

  useEffect(() => {
    // Kick off the initial load. Deferred so the state update is not a
    // synchronous setState within the effect body (react-hooks rule).
    const t = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  // Refetch after an offline sync completes.
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("almizan:sync-complete", handler);
    return () => window.removeEventListener("almizan:sync-complete", handler);
  }, [refresh]);

  const setActiveMatterId = useCallback((id: string) => setActiveMatterIdState(id), []);

  const addMatter = useCallback((matter: Matter) => {
    setMatters((prev) => (prev.some((m) => m.id === matter.id) ? prev : [...prev, matter]));
    setActiveMatterIdState(matter.id);
  }, []);

  const updateMatter = useCallback((matter: Matter) => {
    setMatters((prev) => prev.map((m) => (m.id === matter.id ? matter : m)));
  }, []);

  const activeMatter = matters.find((m) => m.id === activeMatterId) ?? null;

  return (
    <MattersContext.Provider
      value={{
        matters,
        activeMatter,
        activeMatterId,
        setActiveMatterId,
        mattersLoading,
        refresh,
        addMatter,
        updateMatter,
      }}
    >
      {children}
    </MattersContext.Provider>
  );
}

export function useMatters() {
  const ctx = useContext(MattersContext);
  if (!ctx) throw new Error("useMatters must be used within a MattersProvider");
  return ctx;
}
