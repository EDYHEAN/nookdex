"use client";

import { create } from "zustand";
import raw from "@/data/catalog.json";
import type { CardData, CatalogSet, Copy, SetData, UserBinder } from "./types";

/** Every set a binder can be made of, newest first. */
export const CATALOG = raw as CatalogSet[];

const BY_ID = new Map(CATALOG.map((s) => [s.id, s]));
/** TCGdex set id (sub-sets included) -> catalog set id */
const OWNER = new Map<string, string>();
CATALOG.forEach((s) => [s.id, ...s.subs].forEach((id) => OWNER.set(id, s.id)));

export const catalogSet = (id: string) => BY_ID.get(id);

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
    p = fetch(`/sets/${id}.json`)
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
  indexPending ??= fetch("/sets/index.json")
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
