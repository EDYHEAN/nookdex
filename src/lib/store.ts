"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_BINDERS, firstEmpty, freeColor } from "./binders";
import { setIdOfCard } from "./catalog";
import eurUsd from "@/data/eur-usd.json";
import { type Currency, keyOf, langOfKey } from "./cardLang";
import { resolveLang } from "./resolveLang";
import { mergeTrophies, unlock, useTrophyStore } from "./trophyStore";
import { mergePension, mergeWallet, usePension } from "./pensionStore";
import type { BinderGrid, BinderSort, Condition, Copy, UserBinder, Variant } from "./types";

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
  /** 4: card and set ids carry their language (lib/cardLang) */
  version: 2 | 3 | 4;
  exportedAt: string;
  profile?: Profile | null;
  /** The player's currency (purchase prices, totals); missing before v4 */
  currency?: Currency | null;
  binders?: UserBinder[];
  collection: Record<string, Copy[]>;
  /** Trophies won (id -> when): merged, never replaced, and left out of the cloud's conflict check */
  trophies?: Record<string, number>;
  /** the Nook Survivors Pension: upgrade id -> level */
  pension?: Record<string, number>;
  /** its purse (gold), and when it last changed */
  wallet?: { gold: number; at: number };
  /** The doubles ticked « à échanger » (lib/share): "card key|variant" -> how many */
  tradable?: Record<string, number>;
  /** The public list (nookdex.com/c/<slug>) and what it shows: rides the save so another device signed in updates it */
  share?: ShareSettings | null;
}

/** What the player's public list shows (NookDex OS → « Ma liste », lib/share). */
export interface ShareSettings {
  /** null until the server drew it (the list is being made) */
  slug: string | null;
  want: boolean;
  give: boolean;
  /** the set binders whose missing cards are listed (their set keys); null = all of them */
  sets: string[] | null;
  prices: boolean;
}

/** The currency of the site's language: what purchase prices were typed in before the currency was a setting. */
const siteCurrency = (lang: "fr" | "en" | null, frenchOk?: boolean): Currency => (resolveLang(lang, frenchOk) === "en" ? "USD" : "EUR");

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

/**
 * Saves from before card languages (v3 and older) hold bare TCGdex ids, read in the site's language. On the English site
 * those cards were English: they get the "en:" key. On the French site nothing changes (bare = French).
 */
function withCardLangs<T extends { binders?: UserBinder[]; collection?: Record<string, Copy[]> }>(s: T, english: boolean): T {
  if (!english) return s;
  const en = (id: string) => (langOfKey(id) === "fr" ? keyOf("en", id) : id);
  return {
    ...s,
    binders: s.binders?.map((b) => (b.kind === "set" ? { ...b, setId: en(b.setId) } : b)),
    collection: s.collection && Object.fromEntries(Object.entries(s.collection).map(([id, copies]) => [en(id), copies])),
  };
}

interface State {
  profile: Profile | null;
  /** Chose to play without an account (warned: no online save, export by hand). */
  offline: boolean;
  /** Saves from before the English version: the visitor chose to go on in French. */
  frenchOk: boolean;
  /** Language picked in NookDex OS; null = the browser's (see lib/lang). */
  lang: "fr" | "en" | null;
  /** The player's money: purchase prices are typed in it, values and gains are added up in it. null = the site's. */
  currency: Currency | null;
  binders: UserBinder[];
  collection: Record<string, Copy[]>;
  /**
   * The doubles the player offers to trade, by "card key|variant": NookDex suggests the copies beyond the first of a
   * version, the player ticks the ones really up for grabs (Johan, 2026-10-23: nothing listed until ticked).
   */
  tradable: Record<string, number>;
  share: ShareSettings | null;
  sound: boolean;
  ambient: boolean;
  lampOn: boolean;
  /** sunny afternoon or rainy night, set by the window */
  daytime: boolean;
  createProfile: (name: string) => void;
  setOffline: (on: boolean) => void;
  setLang: (lang: "fr" | "en") => void;
  /** Switches the player's money, purchase prices converted at the rate of the last price update. */
  setCurrency: (currency: Currency) => void;
  /** Puts a new binder at the end of the shelf, returns its id. */
  addBinder: (b: { kind: "set"; setId: string } | { kind: "free"; name: string; wish?: boolean; wants?: Record<string, string> }) => string;
  /** A wanted card in a wishlist's pocket (the first free one by default). */
  wishCard: (binderId: string, cardId: string, pocket?: number) => void;
  /** Takes a wanted card out of a wishlist. */
  unwish: (binderId: string, pocket: number) => void;
  /** "Got it!" on a wanted card: it becomes a copy kept in that very pocket. */
  obtainWish: (binderId: string, pocket: number, variant: Variant) => void;
  setBinderColor: (id: string, color: string) => void;
  setBinderSort: (id: string, sort: BinderSort) => void;
  setBinderGrid: (id: string, grid: BinderGrid) => void;
  /**
   * A binder leaves the shelf. Its cards go in the box on the shelf (`keep`: a free binder's copies leave their pockets,
   * a set binder's stay where they are, off the shelf) or are deleted with it.
   */
  removeBinder: (id: string, keep: boolean) => void;
  renameBinder: (id: string, name: string) => void;
  addCard: (cardId: string, variant: Variant) => void;
  /** Slips a new copy in a pocket of a free binder. */
  placeCard: (binderId: string, pocket: number, cardId: string, variant: Variant) => void;
  /** Removes the copies of a card kept in one place: a free binder, or its set binder (null). */
  removeCard: (cardId: string, binderId: string | null) => void;
  /** Deletes the copies of these cards that live in their set's binder (not those in a free binder): a set taken off the shelf. */
  removeLooseCopies: (cardIds: string[]) => void;
  addCopy: (cardId: string, variant: Variant) => void;
  updateCopy: (cardId: string, copyId: string, patch: Partial<Omit<Copy, "id">>) => void;
  removeCopy: (cardId: string, copyId: string) => void;
  /**
   * « J'ai tout » in a set binder: a copy for each card (or version) missing, kept by its set. Returns the copies added,
   * for its undo.
   */
  fillSet: (items: { cardId: string; variant: Variant }[]) => { cardId: string; copyId: string }[];
  /** Takes back the copies a fillSet added. */
  removeCopies: (items: { cardId: string; copyId: string }[]) => void;
  /**
   * « Échange accepté » on the trade mat: a copy of each given card leaves the collection (the one picked, else one of
   * that version, the loose ones first), each received card comes in as a copy kept by its set, in its condition.
   */
  trade: (give: { key: string; variant: Variant; copyId?: string }[], get: { key: string; variant: Variant; condition: Condition }[]) => void;
  importBackup: (backup: Backup) => void;
  /**
   * Copies from another site's export (lib/pokecardex), kept by their set (no pocket): a card and variant already owned
   * as many times or more is left as it is, so importing the same file twice adds nothing. Returns the copies added.
   */
  importCopies: (items: { key: string; variant: Variant; condition: Condition; qty: number; addedAt: number }[]) => number;
  resetCollection: () => void;
  /** How many copies of a card's version are up for trade (0 takes it off the list). */
  setTradable: (key: string, variant: Variant, n: number) => void;
  /** Changes what the public list shows; null forgets it (« Supprimer mon lien »). */
  setShare: (patch: Partial<ShareSettings> | null) => void;
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
      currency: null,
      binders: [],
      collection: {},
      tradable: {},
      share: null,
      sound: true,
      ambient: false,
      lampOn: true,
      daytime: true,
      createProfile: (name) => set((s) => ({ profile: { name: name.trim(), since: Date.now() }, currency: s.currency ?? siteCurrency(s.lang, s.frenchOk) })),
      setOffline: (on) => set({ offline: on }),
      setLang: (lang) => set({ lang }),
      setCurrency: (currency) =>
        set((s) => {
          const from = s.currency ?? siteCurrency(s.lang, s.frenchOk);
          if (from === currency) return { currency };
          const rate = currency === "USD" ? eurUsd.rate : 1 / eurUsd.rate;
          const collection: Record<string, Copy[]> = {};
          for (const [id, copies] of Object.entries(s.collection)) {
            collection[id] = copies.map((c) => (c.paid ? { ...c, paid: Math.round(c.paid * rate * 100) / 100 } : c));
          }
          return { currency, collection };
        }),
      addBinder: (b) => {
        const id = uid();
        if (get().binders.length >= MAX_BINDERS) return id;
        set((s) => ({ binders: [...s.binders, { id, color: freeColor(s.binders), ...b }] }));
        return id;
      },
      wishCard: (binderId, cardId, pocket) =>
        set((s) => ({
          binders: s.binders.map((b) => {
            if (b.id !== binderId || b.kind !== "free") return b;
            const at = pocket ?? firstEmpty(b, b.id, s.collection);
            return { ...b, wants: { ...b.wants, [at]: cardId } };
          }),
        })),
      unwish: (binderId, pocket) =>
        set((s) => ({
          binders: s.binders.map((b) => {
            if (b.id !== binderId || b.kind !== "free" || !b.wants) return b;
            return { ...b, wants: Object.fromEntries(Object.entries(b.wants).filter(([at]) => at !== String(pocket))) };
          }),
        })),
      obtainWish: (binderId, pocket, variant) => {
        const b = get().binders.find((x) => x.id === binderId);
        const cardId = b?.kind === "free" ? b.wants?.[String(pocket)] : undefined;
        if (!cardId) return;
        get().unwish(binderId, pocket);
        get().placeCard(binderId, pocket, cardId, variant);
      },
      setBinderColor: (id, color) => {
        set((s) => ({ binders: s.binders.map((b) => (b.id === id ? { ...b, color } : b)) }));
        unlock("decorator");
      },
      setBinderGrid: (id, grid) => set((s) => ({ binders: s.binders.map((b) => (b.id === id ? { ...b, grid } : b)) })),
      setBinderSort: (id, sort) => {
        set((s) => ({ binders: s.binders.map((b) => (b.id === id ? { ...b, sort } : b)) }));
        if (sort !== "num") unlock("sorter");
      },
      removeBinder: (id, keep) =>
        set((s) => {
          const b = s.binders.find((x) => x.id === id);
          const binders = s.binders.filter((x) => x.id !== id);
          if (!b) return {};
          if (b.kind === "set") {
            return { binders, collection: keep ? s.collection : filterCopies(s.collection, (c, cardId) => !!c.at || setIdOfCard(cardId) !== b.setId) };
          }
          if (!keep) return { binders, collection: filterCopies(s.collection, (c) => c.at?.binder !== id) };
          const collection = Object.fromEntries(
            Object.entries(s.collection).map(([cardId, copies]) => [cardId, copies.map((c) => (c.at?.binder === id ? { ...c, at: undefined } : c))]),
          );
          return { binders, collection };
        }),
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
      removeLooseCopies: (cardIds) =>
        set((s) => {
          const ids = new Set(cardIds);
          return { collection: filterCopies(s.collection, (c, cardId) => !ids.has(cardId) || !!c.at) };
        }),
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
      fillSet: (items) => {
        const added = items.map(({ cardId, variant }) => ({ cardId, copy: newCopy(variant) }));
        set((s) => {
          const collection = { ...s.collection };
          for (const { cardId, copy } of added) collection[cardId] = [...(collection[cardId] ?? []), copy];
          return { collection };
        });
        return added.map(({ cardId, copy }) => ({ cardId, copyId: copy.id }));
      },
      trade: (give, get) =>
        set((s) => {
          const collection = { ...s.collection };
          for (const g of give) {
            const copies = [...(collection[g.key] ?? [])];
            const i =
              (g.copyId ? copies.findIndex((c) => c.id === g.copyId) : -1) + 1 ||
              copies.findIndex((c) => c.variant === g.variant && !c.at) + 1 ||
              copies.findIndex((c) => c.variant === g.variant) + 1 ||
              copies.findIndex(() => true) + 1;
            if (!i) continue;
            const c = copies[i - 1];
            if (c.qty > 1) copies[i - 1] = { ...c, qty: c.qty - 1 };
            else copies.splice(i - 1, 1);
            if (copies.length) collection[g.key] = copies;
            else delete collection[g.key];
          }
          for (const g of get) collection[g.key] = [...(collection[g.key] ?? []), { ...newCopy(g.variant), condition: g.condition }];
          return { collection };
        }),
      removeCopies: (items) =>
        set((s) => {
          const gone = new Set(items.map((i) => `${i.cardId}|${i.copyId}`));
          return { collection: filterCopies(s.collection, (c, id) => !gone.has(`${id}|${c.id}`)) };
        }),
      importCopies: (items) => {
        // the file's copies, by card and variant (one line per condition)
        const want = new Map<string, typeof items>();
        for (const it of items) want.set(`${it.key}|${it.variant}`, [...(want.get(`${it.key}|${it.variant}`) ?? []), it]);
        let added = 0;
        set((s) => {
          const collection = { ...s.collection };
          for (const [k, lines] of want) {
            const [key, variant] = k.split("|") as [string, Variant];
            let have = (collection[key] ?? []).filter((c) => c.variant === variant).reduce((n, c) => n + c.qty, 0);
            const extra: Copy[] = [];
            for (const it of lines) {
              const qty = Math.max(0, it.qty - have);
              have = Math.max(0, have - it.qty);
              if (!qty) continue;
              extra.push({ id: uid(), variant, condition: it.condition, qty, paid: null, addedAt: it.addedAt });
              added += qty;
            }
            if (extra.length) collection[key] = [...(collection[key] ?? []), ...extra];
          }
          return { collection };
        });
        return added;
      },
      importBackup: (raw) =>
        set((s) => {
          const backup = (raw.version ?? 0) < 4 ? withCardLangs(raw, resolveLang(s.lang, s.frenchOk) === "en") : raw;
          mergeTrophies(backup.trophies);
          mergePension(backup.pension);
          mergeWallet(backup.wallet);
          return {
            collection: backup.collection,
            binders: backup.binders?.length ? backup.binders : bindersFromCollection(backup.collection),
            profile: backup.profile ?? s.profile,
            // older saves: their purchase prices were typed in the site's currency
            currency: backup.currency ?? siteCurrency(s.lang, s.frenchOk),
            tradable: backup.tradable ?? {},
            // a save from before the lists keeps the list made on this device
            share: backup.share === undefined ? s.share : backup.share,
          };
        }),
      resetCollection: () => set({ collection: {} }),
      setTradable: (key, variant, n) =>
        set((s) => {
          const tradable = { ...s.tradable };
          if (n > 0) tradable[`${key}|${variant}`] = Math.round(n);
          else delete tradable[`${key}|${variant}`];
          return { tradable };
        }),
      setShare: (patch) =>
        set((s) => ({
          share: patch && { slug: null, want: true, give: true, sets: null, prices: true, ...s.share, ...patch },
        })),
      toggleSound: () => set((s) => ({ sound: !s.sound })),
      setAmbient: (on) => set({ ambient: on }),
      toggleLamp: () => set((s) => ({ lampOn: !s.lampOn })),
      toggleDaytime: () => set((s) => ({ daytime: !s.daytime })),
    }),
    {
      // storage key from the PokéPocket days: kept, so nobody loses their collection
      name: "pokepocket:v1",
      version: 4,
      storage: createJSONStorage(() => localStorage),
      // Ambient music never auto-starts on reload (browsers block autoplay anyway).
      partialize: (s) => ({ profile: s.profile, offline: s.offline, frenchOk: s.frenchOk, lang: s.lang, currency: s.currency, binders: s.binders, collection: s.collection, tradable: s.tradable, share: s.share, sound: s.sound, lampOn: s.lampOn, daytime: s.daytime }),
      migrate: (persisted, version) => {
        let s = persisted as { collection?: Record<string, Copy[]>; binders?: UserBinder[]; lang?: "fr" | "en" | null; frenchOk?: boolean } & Record<
          string,
          unknown
        >;
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
        if (version < 4) {
          // v4: each binder has its card language; the English site's cards become "en:" ones
          s = withCardLangs(s, resolveLang(s.lang ?? null, s.frenchOk) === "en");
          // and the purchase prices typed so far were in the site's currency: it becomes the player's
          s.currency = siteCurrency(s.lang ?? null, s.frenchOk);
        }
        return s as unknown as State;
      },
    },
  ),
);

export function makeBackup(s: Pick<State, "profile" | "currency" | "binders" | "collection"> & Partial<Pick<State, "tradable" | "share">>): Backup {
  return {
    app: "nookdex",
    version: 4,
    exportedAt: new Date().toISOString(),
    profile: s.profile,
    currency: s.currency,
    binders: s.binders,
    collection: s.collection,
    tradable: s.tradable ?? {},
    share: s.share ?? null,
    trophies: useTrophyStore.getState().got,
    pension: usePension.getState().levels,
    wallet: { gold: usePension.getState().gold, at: usePension.getState().goldAt },
  };
}

export function isBackup(x: unknown): x is Backup {
  const b = x as Backup;
  return !!b && (b.app === "nookdex" || b.app === "pokepocket") && typeof b.collection === "object" && b.collection !== null;
}

/** Copies of a card kept in its own set binder (not slipped in a free binder). */
export const looseCopies = (copies: Copy[] | undefined) => copies?.filter((c) => !c.at) ?? [];
