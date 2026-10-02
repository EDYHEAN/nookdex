"use client";

import { create } from "zustand";
import rawEn from "@/data/catalog-en.json";
import rawFr from "@/data/catalog.json";
import { type CardLang, bareId, keyOf, langOfKey } from "./cardLang";
import type { CardData, CatalogSet, Copy, SetData, UserBinder } from "./types";

/**
 * Each binder has its card language (see lib/cardLang): French cards come from /sets, English ones from /sets/en.
 * Set and card ids are keyed with their language as soon as they're read, so the rest of the code never mixes them.
 */
const keyed = (lang: CardLang, sets: CatalogSet[]): CatalogSet[] =>
  sets.map((s) => ({ ...s, id: keyOf(lang, s.id), subs: s.subs.map((id) => keyOf(lang, id)), lang }));

const CATALOGS: Record<CardLang, CatalogSet[]> = {
  fr: keyed("fr", rawFr as CatalogSet[]),
  en: keyed("en", rawEn as CatalogSet[]),
};

/** Every set we have the cards of in a language, newest first (extra ones only feed the free binders' search). */
export const catalog = (lang: CardLang): CatalogSet[] => CATALOGS[lang];
/** The sets a binder can be made of. */
export const binderSets = (lang: CardLang) => catalog(lang).filter((s) => !s.extra);

const BY_ID = new Map(Object.values(CATALOGS).flatMap((sets) => sets.map((s) => [s.id, s] as const)));
/** Set key (sub-sets included) -> key of the catalog set whose binder holds it */
const OWNER = new Map<string, string>();
Object.values(CATALOGS).forEach((sets) => sets.forEach((s) => [s.id, ...s.subs].forEach((id) => OWNER.set(id, s.id))));

export const catalogSet = (key: string) => BY_ID.get(key);

/** "en:swsh12tg-TG05" -> "en:swsh12" (the set whose binder holds it) */
export function setIdOfCard(cardKey: string) {
  return OWNER.get(cardKey.slice(0, cardKey.lastIndexOf("-")));
}

/** Files of a set or of the search index, in a card language. */
const dataUrl = (lang: CardLang, file: string) => (lang === "fr" ? `/sets/${file}` : `/sets/${lang}/${file}`);

/** A card of the search index: [card key, name, num, set key, image path, trend] */
export type IndexCard = [string, string, string, string, string, number | null];

interface Sets {
  /** Set files downloaded so far, by set key */
  sets: Record<string, SetData>;
  /** Cards of those sets, by card key */
  cards: Record<string, CardData>;
  /** Every card of a language in a few fields, for the free binders' search (loaded on demand) */
  index: Partial<Record<CardLang, IndexCard[]>>;
  assets: string;
}

/** Card data, downloaded from /sets as binders need it. Not persisted: the files are cached by the browser. */
export const useSets = create<Sets>(() => ({ sets: {}, cards: {}, index: {}, assets: "" }));

const pending = new Map<string, Promise<SetData>>();

export function loadSet(key: string): Promise<SetData> {
  const done = useSets.getState().sets[key];
  if (done) return Promise.resolve(done);
  let p = pending.get(key);
  if (!p) {
    const lang = langOfKey(key);
    p = fetch(dataUrl(lang, `${bareId(key)}.json`))
      .then((r) => {
        if (!r.ok) throw new Error(`set ${key}: ${r.status}`);
        return r.json() as Promise<SetData>;
      })
      .then((raw) => {
        const set: SetData = { ...raw, id: key, cards: raw.cards.map((c) => ({ ...c, id: keyOf(lang, c.id) })) };
        useSets.setState((s) => {
          const cards = { ...s.cards };
          set.cards.forEach((c) => (cards[c.id] = c));
          return { sets: { ...s.sets, [key]: set }, cards };
        });
        return set;
      })
      .finally(() => pending.delete(key));
    pending.set(key, p);
  }
  return p;
}

const indexPending: Partial<Record<CardLang, Promise<IndexCard[]>>> = {};

export function loadIndex(lang: CardLang): Promise<IndexCard[]> {
  const done = useSets.getState().index[lang];
  if (done) return Promise.resolve(done);
  indexPending[lang] ??= fetch(dataUrl(lang, "index.json"))
    .then((r) => r.json() as Promise<{ assets: string; cards: IndexCard[] }>)
    .then(({ assets, cards }) => {
      const list = cards.map(([id, name, num, set, img, trend]): IndexCard => [keyOf(lang, id), name, num, keyOf(lang, set), img, trend]);
      useSets.setState((s) => ({ index: { ...s.index, [lang]: list }, assets }));
      return list;
    })
    .catch((e) => {
      delete indexPending[lang];
      throw e;
    });
  return indexPending[lang];
}

/** Sets needed to draw the shelf: those of the set binders and of every card owned. */
export function neededSets(binders: UserBinder[], collection: Record<string, Copy[]>) {
  const ids = new Set<string>();
  binders.forEach((b) => b.kind === "set" && ids.add(b.setId));
  Object.keys(collection).forEach((cardId) => {
    const id = setIdOfCard(cardId);
    if (id) ids.add(id);
  });
  return [...ids];
}

export const loadSets = (ids: string[]) => Promise.allSettled(ids.map(loadSet));
