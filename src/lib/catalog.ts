"use client";

import { create } from "zustand";
import rawEn from "@/data/catalog-en.json";
import rawFr from "@/data/catalog.json";
import { currentLang } from "./lang";
import type { CardData, CatalogSet, Copy, SetData, UserBinder } from "./types";

const FR = rawFr as CatalogSet[];
const EN = rawEn as CatalogSet[];

/**
 * The card data speaks the visitor's language (French or English cards, same ids). Read once: switching the
 * language reloads the page. English files not downloaded yet -> the French ones.
 */
const english = () => typeof window !== "undefined" && currentLang() === "en" && EN.length > 0;

/** Every set we have the cards of, newest first (extra ones only feed the free binders' search). */
export const catalog = (): CatalogSet[] => (english() ? EN : FR);
/** The sets a binder can be made of. */
export const binderSets = () => catalog().filter((s) => !s.extra);

/** French and English sets merged: a card owned keeps its set whatever the language. */
const BY_ID = new Map([...FR, ...EN].map((s) => [s.id, s]));
const BY_ID_EN = new Map(EN.map((s) => [s.id, s]));
/** TCGdex set id (sub-sets included) -> catalog set id */
const OWNER = new Map<string, string>();
[...FR, ...EN].forEach((s) => [s.id, ...s.subs].forEach((id) => OWNER.set(id, s.id)));

/** Files of a set or of the search index, in the visitor's language. */
const dataUrl = (file: string) => (english() ? `/sets/en/${file}` : `/sets/${file}`);

export const catalogSet = (id: string) => (english() ? (BY_ID_EN.get(id) ?? FR.find((s) => s.id === id)) : FR.find((s) => s.id === id)) ?? BY_ID.get(id);

/** "swsh12tg-TG05" -> "swsh12" (the set whose binder holds it) */
export function setIdOfCard(cardId: string) {
  return OWNER.get(cardId.slice(0, cardId.lastIndexOf("-")));
}

/** A card of the search index: [id, name, num, setId, image path, trend] */
export type IndexCard = [string, string, string, string, string, number | null];

interface Sets {
  /** Set files downloaded so far */
  sets: Record<string, SetData>;
  cards: Record<string, CardData>;
  /** Every card in a few fields, for the free binders' search (loaded on demand) */
  index: IndexCard[] | null;
  assets: string;
}

/** Card data, downloaded from /sets as binders need it. Not persisted: the files are cached by the browser. */
export const useSets = create<Sets>(() => ({ sets: {}, cards: {}, index: null, assets: "" }));

const pending = new Map<string, Promise<SetData>>();

export function loadSet(id: string): Promise<SetData> {
  const done = useSets.getState().sets[id];
  if (done) return Promise.resolve(done);
  let p = pending.get(id);
  if (!p) {
    p = fetch(dataUrl(`${id}.json`))
      // a set that only exists in French: its French file
      .then((r) => (r.ok || !english() ? r : fetch(`/sets/${id}.json`)))
      .then((r) => {
        if (!r.ok) throw new Error(`set ${id}: ${r.status}`);
        return r.json() as Promise<SetData>;
      })
      .then((set) => {
        useSets.setState((s) => {
          const cards = { ...s.cards };
          set.cards.forEach((c) => (cards[c.id] = c));
          return { sets: { ...s.sets, [id]: set }, cards };
        });
        return set;
      })
      .finally(() => pending.delete(id));
    pending.set(id, p);
  }
  return p;
}

let indexPending: Promise<IndexCard[]> | null = null;

export function loadIndex(): Promise<IndexCard[]> {
  const done = useSets.getState().index;
  if (done) return Promise.resolve(done);
  indexPending ??= fetch(dataUrl("index.json"))
    .then((r) => (r.ok ? r : fetch("/sets/index.json")))
    .then((r) => r.json() as Promise<{ assets: string; cards: IndexCard[] }>)
    .then(({ assets, cards }) => {
      useSets.setState({ index: cards, assets });
      return cards;
    })
    .catch((e) => {
      indexPending = null;
      throw e;
    });
  return indexPending;
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
