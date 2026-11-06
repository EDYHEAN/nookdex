"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { useStore } from "./store";

/**
 * The calm room's asks and gifts (Johan, 2026-10-23, « pas de demande avant la valeur »; 2026-11-06, « que rien ne se gêne et
 * existe quand même »). Gifts give: the letter (room/Courrier), the trade binder's note, the road log, a release weekend's
 * strip (room/ReleaseBar). Asks ask: the account card (room/SavePrompt), the Pokécardex strip (room/ImportBar), the Monday
 * mail (room/MailAsk), the cat (room/SupportCat). Not the tip corner (room/TipCorner), a quiet corner that steps aside.
 * - One on screen at a time: one claimed (`claimAsk`) holds the room until it's put away (`useAskUp` back to false), then
 *   the next ready one comes, after its own calm delay.
 * - By priority, not by who comes first: one ready right now (`useWantAsk`: every condition of its own met, the calm room
 *   included) holds back the ones after it. Only "right now": one waiting for a moment that may never come (a note for page
 *   0 of the shelf, a road log behind a letter) used to hold the others back for the whole visit, and on a returning
 *   player's desk nothing showed at all any more (Johan, 2026-11-06).
 * - Gifts all come, one after the other. Asks: one a visit, whatever the answer (the account, then the cat on another day).
 * - Money is always last: the cat came before the account in the visit a player reached 10 cards (UX review, 2026-10-24).
 * The trophy toasts are neither. And nothing asks before the site has given something: 10 cards, or a 3rd day of visits.
 */

export type Ask = "save" | "courrier" | "trade-note" | "roadlog" | "release" | "import" | "mail" | "cat";

const GIFTS = new Set<Ask>(["courrier", "trade-note", "roadlog", "release"]);

/** the order: the first ready one has the room */
// the account first (once 10 cards are in), the gifts, then the asks; the Monday mail's offer (room/MailAsk) after the road
// log that announces it
const PRIORITY: Record<Ask, number> = { save: 0, courrier: 0.5, "trade-note": 1, roadlog: 1.5, release: 1.8, import: 2, mail: 3.5, cat: 4 };

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
  /** the ask (not a gift) that had this visit's turn */
  asked: Ask | null;
  /** the ones ready to show right now (all their conditions met), waiting for their calm delay */
  wanting: Ask[];
  /** days of visits on this device, this one included */
  days: number;
  /** the ones on screen, or claimed and not put away yet (the tip corner steps aside for them) */
  up: Ask[];
}

export const useCalm = create<Calm>(() => ({ asked: null, wanting: [], days: typeof window === "undefined" ? 1 : countDays(), up: [] }));

/** Claimed and not put away yet (or no longer): the others wait meanwhile. */
export function useAskUp(ask: Ask, up: boolean) {
  useEffect(() => {
    if (!up) {
      useCalm.setState((c) => (c.up.includes(ask) ? { up: c.up.filter((a) => a !== ask) } : c));
      return;
    }
    useCalm.setState((c) => (c.up.includes(ask) ? c : { up: [...c.up, ask] }));
    return () => useCalm.setState((c) => ({ up: c.up.filter((a) => a !== ask) }));
  }, [ask, up]);
}

/** an ask after the visit's one can't show: it holds nobody back */
const spent = (ask: Ask, asked: Ask | null) => !GIFTS.has(ask) && !!asked && asked !== ask;

function freeIn(ask: Ask, c: Pick<Calm, "asked" | "wanting" | "up">): boolean {
  if (c.up.some((u) => u !== ask)) return false;
  if (spent(ask, c.asked)) return false;
  return !c.wanting.some((w) => w !== ask && PRIORITY[w] < PRIORITY[ask] && !spent(w, c.asked));
}

/**
 * Takes the room for one (true): nothing else on screen, none before it ready, and for an ask, no other ask this visit.
 * It's on screen from now on (`up`), until its `useAskUp` goes false.
 */
export function claimAsk(ask: Ask): boolean {
  const c = useCalm.getState();
  if (!freeIn(ask, c)) return false;
  useCalm.setState({ asked: GIFTS.has(ask) ? c.asked : ask, up: c.up.includes(ask) ? c.up : [...c.up, ask] });
  return true;
}

/** One is ready to show right now (every condition of its own met): the ones after it wait. */
export function useWantAsk(ask: Ask, wants: boolean) {
  useEffect(() => {
    if (!wants) return;
    useCalm.setState((c) => (c.wanting.includes(ask) ? c : { wanting: [...c.wanting, ask] }));
    return () => useCalm.setState((c) => ({ wanting: c.wanting.filter((w) => w !== ask) }));
  }, [ask, wants]);
}

/** It may take the room now (claimAsk would say yes): wait for this before its calm delay starts. */
export const useAskFree = (ask: Ask) => useCalm((c) => freeIn(ask, c));
/** The site has given something: 10 cards, or a third day of visits. Before that, nothing asks. */
export function useValued() {
  const days = useCalm((c) => c.days);
  const cards = useStore((s) => Object.keys(s.collection).length);
  return cards >= VALUE_CARDS || days >= VALUE_DAYS;
}
