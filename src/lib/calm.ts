"use client";

import { create } from "zustand";
import { useStore } from "./store";

/**
 * The calm room's asks (Johan, 2026-10-23, « pas de demande avant la valeur »): the account card (room/SavePrompt), the cat
 * (room/SupportCat), the tip corner (room/TipCorner), the Pokécardex strip (room/ImportBar), the trade binder's note, the
 * road log. One of them a visit, at most: the first to come takes the visit's turn, the others wait for another visit.
 * The trophy toasts aren't asks (they give, they don't ask). And nothing that asks before the player has had something
 * from the site: 10 cards, or a third day of visits (`valued`).
 */

export type Ask = "save" | "cat" | "tip" | "import" | "trade-note" | "roadlog";

const DAYS_KEY = "nookdex:visit-days";
/** a third day of visits, or this many cards: the site has given something, it may ask */
export const VALUE_DAYS = 3;
export const VALUE_CARDS = 10;

/** The days this device came (local days, counted once each). Kept on the device, like the funnel's id. */
function countDays(): number {
  try {
    const today = new Date().toLocaleDateString("sv-SE");
    const kept = JSON.parse(localStorage.getItem(DAYS_KEY) ?? "null") as { last: string; n: number } | null;
    if (kept?.last === today) return kept.n;
    const n = (kept?.n ?? 0) + 1;
    localStorage.setItem(DAYS_KEY, JSON.stringify({ last: today, n }));
    return n;
  } catch {
    return 1;
  }
}

interface Calm {
  /** the ask that had this visit's turn */
  holder: Ask | null;
  /** days of visits on this device, this one included */
  days: number;
}

export const useCalm = create<Calm>(() => ({ holder: null, days: typeof window === "undefined" ? 1 : countDays() }));

/** Takes the visit's turn for an ask (true), unless another one had it (false). Asking again for the same one is fine. */
export function claimAsk(ask: Ask): boolean {
  const { holder } = useCalm.getState();
  if (holder && holder !== ask) return false;
  if (!holder) useCalm.setState({ holder: ask });
  return true;
}

/** This ask may still show this visit: nobody else had the turn. */
export const useAskFree = (ask: Ask) => useCalm((c) => !c.holder || c.holder === ask);

/** The site has given something: 10 cards, or a third day of visits. Before that, nothing asks. */
export function useValued() {
  const days = useCalm((c) => c.days);
  const cards = useStore((s) => Object.keys(s.collection).length);
  return cards >= VALUE_CARDS || days >= VALUE_DAYS;
}
