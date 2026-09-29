"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Condition, Copy, Variant } from "./types";

export const CONDITIONS: Condition[] = ["MT", "NM", "EX", "GD", "LP", "PL", "PO"];

export const CONDITION_LABEL: Record<Condition, string> = {
  MT: "Mint",
  NM: "Near Mint",
  EX: "Excellent",
  GD: "Good",
  LP: "Light Played",
  PL: "Played",
  PO: "Poor",
};

const uid = () => Math.random().toString(36).slice(2, 10);

const newCopy = (variant: Variant): Copy => ({
  id: uid(),
  variant,
  condition: "NM",
  qty: 1,
  paid: null,
  addedAt: Date.now(),
});

export interface Backup {
  app: "pokepocket";
  version: 2;
  exportedAt: string;
  collection: Record<string, Copy[]>;
}

interface State {
  collection: Record<string, Copy[]>;
  sound: boolean;
  ambient: boolean;
  lampOn: boolean;
  addCard: (cardId: string, variant: Variant) => void;
  removeCard: (cardId: string) => void;
  addCopy: (cardId: string, variant: Variant) => void;
  updateCopy: (cardId: string, copyId: string, patch: Partial<Omit<Copy, "id">>) => void;
  removeCopy: (cardId: string, copyId: string) => void;
  importBackup: (backup: Backup) => void;
  resetCollection: () => void;
  toggleSound: () => void;
  setAmbient: (on: boolean) => void;
  toggleLamp: () => void;
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      collection: {},
      sound: true,
      ambient: false,
      lampOn: true,
      addCard: (cardId, variant) => set((s) => ({ collection: { ...s.collection, [cardId]: [newCopy(variant)] } })),
      removeCard: (cardId) =>
        set((s) => {
          const next = { ...s.collection };
          delete next[cardId];
          return { collection: next };
        }),
      addCopy: (cardId, variant) =>
        set((s) => ({
          collection: { ...s.collection, [cardId]: [...(s.collection[cardId] ?? []), newCopy(variant)] },
        })),
      updateCopy: (cardId, copyId, patch) =>
        set((s) => ({
          collection: {
            ...s.collection,
            [cardId]: (s.collection[cardId] ?? []).map((c) => (c.id === copyId ? { ...c, ...patch } : c)),
          },
        })),
      removeCopy: (cardId, copyId) =>
        set((s) => {
          const left = (s.collection[cardId] ?? []).filter((c) => c.id !== copyId);
          const next = { ...s.collection };
          if (left.length) next[cardId] = left;
          else delete next[cardId];
          return { collection: next };
        }),
      importBackup: (backup) => set({ collection: backup.collection }),
      resetCollection: () => set({ collection: {} }),
      toggleSound: () => set((s) => ({ sound: !s.sound })),
      setAmbient: (on) => set({ ambient: on }),
      toggleLamp: () => set((s) => ({ lampOn: !s.lampOn })),
    }),
    {
      name: "pokepocket:v1",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // Ambient music never auto-starts on reload (browsers block autoplay anyway).
      partialize: (s) => ({ collection: s.collection, sound: s.sound, lampOn: s.lampOn }),
      migrate: (persisted, version) => {
        const s = persisted as { collection?: Record<string, Copy[]> } & Record<string, unknown>;
        if (version < 2) {
          // v1 had a per-card "custom price"; v2 tracks what each copy was paid instead.
          delete s.customPrices;
          for (const copies of Object.values(s.collection ?? {})) {
            copies.forEach((c) => {
              c.paid ??= null;
              c.addedAt ??= Date.now();
            });
          }
        }
        return s as unknown as State;
      },
    },
  ),
);

export function makeBackup(collection: Record<string, Copy[]>): Backup {
  return { app: "pokepocket", version: 2, exportedAt: new Date().toISOString(), collection };
}

export function isBackup(x: unknown): x is Backup {
  const b = x as Backup;
  return !!b && b.app === "pokepocket" && typeof b.collection === "object" && b.collection !== null;
}
