"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { useStore } from "./store";

/**
 * The calm room's asks (Johan, 2026-10-23, « pas de demande avant la valeur »): the account card (room/SavePrompt), the
 * trade binder's note, the Pokécardex strip (room/ImportBar), the road log, the cat (room/SupportCat) and the tip corner
 * (room/TipCorner). One of them a visit, at most, and by priority, not by who comes first: an ask that wants to show
 * (`useWantAsk`) holds back the ones after it, even while it waits for its moment (a trophy toast, the binder closed).
 * Money is always last: the cat came before the account in the visit a player reached 10 cards (UX review, 2026-10-24).
 * The trophy toasts aren't asks. And nothing asks before the site has given something: 10 cards, or a 3rd day of visits.
 */

export type Ask = "save" | "trade-note" | "import" | "roadlog" | "cat" | "tip";

/** the order of the asks: the first wanting one has the visit */
const PRIORITY: Record<Ask, number> = { save: 0, "trade-note": 1, import: 2, roadlog: 3, cat: 4, tip: 4 };

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
  /** the asks that want to show this visit (their conditions met, waiting for a calm moment) */
  wanting: Ask[];
  /** days of visits on this device, this one included */
  days: number;
}

export const useCalm = create<Calm>(() => ({ holder: null, wanting: [], days: typeof window === "undefined" ? 1 : countDays() }));

const before = (ask: Ask, wanting: Ask[]) => wanting.some((w) => w !== ask && PRIORITY[w] < PRIORITY[ask]);

/**
 * Takes the visit's turn for an ask (true), unless another one had it, or one before it wants to show (false). Asking
 * again for the same one is fine.
 */
export function claimAsk(ask: Ask): boolean {
  const { holder, wanting } = useCalm.getState();
  if (holder) return holder === ask;
  if (before(ask, wanting)) return false;
  useCalm.setState({ holder: ask });
  return true;
}

/** An ask says it would like to show this visit (or no longer): the ones after it wait. */
export function useWantAsk(ask: Ask, wants: boolean) {
  useEffect(() => {
    if (!wants) return;
    useCalm.setState((c) => (c.wanting.includes(ask) ? c : { wanting: [...c.wanting, ask] }));
    return () => useCalm.setState((c) => ({ wanting: c.wanting.filter((w) => w !== ask) }));
  }, [ask, wants]);
}

/** This ask may still show this visit: nobody else had the turn, and none before it wants it. */
export const useAskFree = (ask: Ask) => useCalm((c) => (c.holder ? c.holder === ask : !before(ask, c.wanting)));

/** The site has given something: 10 cards, or a third day of visits. Before that, nothing asks. */
export function useValued() {
  const days = useCalm((c) => c.days);
  const cards = useStore((s) => Object.keys(s.collection).length);
  return cards >= VALUE_CARDS || days >= VALUE_DAYS;
}
