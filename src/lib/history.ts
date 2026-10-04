"use client";

import { bareId, langOfKey } from "./cardLang";
import { setIdOfCard } from "./catalog";

/** A set's price history: public/history/<lang>/<set>.json, one column a day (scripts/price-history.mjs, daily Action). */
interface SetHistory {
  days: string[];
  cards: Record<string, (number | null)[]>;
}

const files = new Map<string, Promise<SetHistory | null>>();

/** A card's daily prices on its market, oldest first; null when its set has no history file. */
export async function cardHistory(cardKey: string): Promise<{ day: string; price: number }[] | null> {
  const setKey = setIdOfCard(cardKey);
  if (!setKey) return null;
  const url = `/history/${langOfKey(setKey)}/${bareId(setKey)}.json`;
  if (!files.has(url)) {
    const load = fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<SetHistory>) : null))
      .catch(() => null);
    files.set(url, load);
    // a network hiccup is tried again next time
    load.then((h) => !h && files.delete(url));
  }
  const h = await files.get(url)!;
  if (!h) return null;
  const row = h.cards[bareId(cardKey)] ?? [];
  return h.days.flatMap((day, i) => (row[i] != null ? [{ day, price: row[i]! }] : []));
}
