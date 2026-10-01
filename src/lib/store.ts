"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_BINDERS, freeColor } from "./binders";
import { setIdOfCard } from "./catalog";
import type { BinderSort, Condition, Copy, UserBinder, Variant } from "./types";

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

const newCopy = (variant: Variant, at?: Copy["at"]): Copy => ({
  id: uid(),
  variant,
  condition: "NM",
  qty: 1,
  paid: null,
  addedAt: Date.now(),
  ...(at && { at }),
});

/** Local account: the collection lives in this browser until the online accounts land. */
export interface Profile {
  name: string;
  since: number;
}

export interface Backup {
  /** "pokepocket" on saves made before the rename */
  app: "nookdex" | "pokepocket";
  version: 2 | 3;
  exportedAt: string;
  profile?: Profile | null;
  binders?: UserBinder[];
  collection: Record<string, Copy[]>;
}

/** One set binder per set of the cards owned (saves made before binders were chosen). */
function bindersFromCollection(collection: Record<string, Copy[]>): UserBinder[] {
  const ids = new Set<string>();
  Object.keys(collection).forEach((cardId) => {
    const id = setIdOfCard(cardId);
    if (id) ids.add(id);
  });
  const out: UserBinder[] = [];
  for (const setId of [...ids].slice(0, MAX_BINDERS)) out.push({ id: uid(), kind: "set", setId, color: freeColor(out) });
  return out;
}

interface State {
  profile: Profile | null;
  /** Chose to play without an account (warned: no online save, export by hand). */
  offline: boolean;
  /** Saves from before the English version: the visitor chose to go on in French. */
  frenchOk: boolean;
  /** Language picked in NookDex OS; null = the browser's (see lib/lang). */
  lang: "fr" | "en" | null;
  binders: UserBinder[];
  collection: Record<string, Copy[]>;
  sound: boolean;
  ambient: boolean;
  lampOn: boolean;
  /** sunny afternoon or rainy night, set by the window */
  daytime: boolean;
  createProfile: (name: string) => void;
  setOffline: (on: boolean) => void;
  setLang: (lang: "fr" | "en") => void;
  /** Puts a new binder at the end of the shelf, returns its id. */
  addBinder: (b: { kind: "set"; setId: string } | { kind: "free"; name: string }) => string;
  setBinderColor: (id: string, color: string) => void;
  setBinderSort: (id: string, sort: BinderSort) => void;
  /** A set binder leaves the shelf, its cards stay owned. A free binder goes with the cards it holds. */
  removeBinder: (id: string) => void;
  renameBinder: (id: string, name: string) => void;
  addCard: (cardId: string, variant: Variant) => void;
  /** Slips a new copy in a pocket of a free binder. */
  placeCard: (binderId: string, pocket: number, cardId: string, variant: Variant) => void;
  /** Removes the copies of a card kept in one place: a free binder, or its set binder (null). */
  removeCard: (cardId: string, binderId: string | null) => void;
  addCopy: (cardId: string, variant: Variant) => void;
  updateCopy: (cardId: string, copyId: string, patch: Partial<Omit<Copy, "id">>) => void;
  removeCopy: (cardId: string, copyId: string) => void;
  importBackup: (backup: Backup) => void;
  resetCollection: () => void;
  toggleSound: () => void;
  setAmbient: (on: boolean) => void;
  toggleLamp: () => void;
  toggleDaytime: () => void;
}

const filterCopies = (collection: Record<string, Copy[]>, keep: (c: Copy, cardId: string) => boolean) => {
  const next: Record<string, Copy[]> = {};
  for (const [cardId, copies] of Object.entries(collection)) {
    const left = copies.filter((c) => keep(c, cardId));
    if (left.length) next[cardId] = left;
  }
  return next;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      profile: null,
      offline: false,
      frenchOk: false,
      lang: null,
      binders: [],
      collection: {},
      sound: true,
      ambient: false,
      lampOn: true,
      daytime: true,
      createProfile: (name) => set({ profile: { name: name.trim(), since: Date.now() } }),
      setOffline: (on) => set({ offline: on }),
      setLang: (lang) => set({ lang }),
      addBinder: (b) => {
        const id = uid();
        if (get().binders.length >= MAX_BINDERS) return id;
        set((s) => ({ binders: [...s.binders, { id, color: freeColor(s.binders), ...b }] }));
        return id;
      },
      setBinderColor: (id, color) => set((s) => ({ binders: s.binders.map((b) => (b.id === id ? { ...b, color } : b)) })),
      setBinderSort: (id, sort) => set((s) => ({ binders: s.binders.map((b) => (b.id === id ? { ...b, sort } : b)) })),
      removeBinder: (id) =>
        set((s) => ({
          binders: s.binders.filter((b) => b.id !== id),
          collection: filterCopies(s.collection, (c) => c.at?.binder !== id),
        })),
      renameBinder: (id, name) =>
        set((s) => ({ binders: s.binders.map((b) => (b.id === id && b.kind === "free" ? { ...b, name } : b)) })),
      addCard: (cardId, variant) =>
        set((s) => ({ collection: { ...s.collection, [cardId]: [...(s.collection[cardId] ?? []), newCopy(variant)] } })),
      placeCard: (binderId, pocket, cardId, variant) =>
        set((s) => ({
          collection: {
            ...s.collection,
            [cardId]: [...(s.collection[cardId] ?? []), newCopy(variant, { binder: binderId, pocket })],
          },
        })),
      removeCard: (cardId, binderId) =>
        set((s) => ({
          collection: filterCopies(s.collection, (c, id) => id !== cardId || (c.at?.binder ?? null) !== binderId),
        })),
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
        set((s) => ({ collection: filterCopies(s.collection, (c, id) => id !== cardId || c.id !== copyId) })),
      importBackup: (backup) =>
        set((s) => ({
          collection: backup.collection,
          binders: backup.binders?.length ? backup.binders : bindersFromCollection(backup.collection),
          profile: backup.profile ?? s.profile,
        })),
      resetCollection: () => set({ collection: {} }),
      toggleSound: () => set((s) => ({ sound: !s.sound })),
      setAmbient: (on) => set({ ambient: on }),
      toggleLamp: () => set((s) => ({ lampOn: !s.lampOn })),
      toggleDaytime: () => set((s) => ({ daytime: !s.daytime })),
    }),
    {
      // storage key from the PokéPocket days: kept, so nobody loses their collection
      name: "pokepocket:v1",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      // Ambient music never auto-starts on reload (browsers block autoplay anyway).
      partialize: (s) => ({ profile: s.profile, offline: s.offline, frenchOk: s.frenchOk, lang: s.lang, binders: s.binders, collection: s.collection, sound: s.sound, lampOn: s.lampOn, daytime: s.daytime }),
      migrate: (persisted, version) => {
        const s = persisted as { collection?: Record<string, Copy[]>; binders?: UserBinder[] } & Record<string, unknown>;
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
        if (version < 3) {
          // v3: the player picks their binders. Keep one for each set already started.
          s.binders = bindersFromCollection(s.collection ?? {});
          s.profile = null;
        }
        return s as unknown as State;
      },
    },
  ),
);

export function makeBackup(s: Pick<State, "profile" | "binders" | "collection">): Backup {
  return { app: "nookdex", version: 3, exportedAt: new Date().toISOString(), profile: s.profile, binders: s.binders, collection: s.collection };
}

export function isBackup(x: unknown): x is Backup {
  const b = x as Backup;
  return !!b && (b.app === "nookdex" || b.app === "pokepocket") && typeof b.collection === "object" && b.collection !== null;
}

/** Copies of a card kept in its own set binder (not slipped in a free binder). */
export const looseCopies = (copies: Copy[] | undefined) => copies?.filter((c) => !c.at) ?? [];
