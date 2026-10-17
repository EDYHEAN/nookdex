"use client";

// The trade mat (NookDex OS → « Échange », Johan 2026-10-17): at a card fair, the cards given against the cards received,
// and how much the trade weighs. A card's value: its trend in the player's money, less an estimate for its condition
// (Cardmarket gives one price, a near-mint copy's), or the price typed for a graded card (no source gives PSA prices).
// « Échange accepté » takes the given copies out of the collection and puts the received ones in it.

import { create } from "zustand";
import { priceOf } from "./price";
import type { CardData, Condition, Copy, Variant } from "./types";

/** The mat out (App draws it), from NookDex OS or from a card's sheet (« Échanger »: that card on the player's side). */
export const useTradeMat = create<{ open: boolean; seed?: { key: string; copy?: Copy } }>(() => ({ open: false }));
export const openTrade = (seed?: { key: string; copy?: Copy }) => useTradeMat.setState({ open: true, seed });
export const closeTrade = () => useTradeMat.setState({ open: false, seed: undefined });

export type Side = "give" | "get";

export interface TradeItem {
  uid: string;
  side: Side;
  /** the card's key (lib/cardLang) */
  key: string;
  variant: Variant;
  condition: Condition;
  /** "PSA 10"…: then `price` is what was agreed (no market gives it) */
  grade: string | null;
  price: number | null;
  /** one of the player's own copies (given away on « Échange accepté ») */
  copyId?: string;
}

/** What a copy in that condition fetches against a near-mint one: an estimate, said so on the mat. */
export const CONDITION_RATE: Record<Condition, number> = { MT: 1, NM: 1, EX: 0.85, GD: 0.75, LP: 0.65, PL: 0.5, PO: 0.3 };
export const CONDITIONS = Object.keys(CONDITION_RATE) as Condition[];
export const GRADES = ["PSA 10", "PSA 9", "PSA 8", "CGC 10", "CGC 9.5", "BGS 9.5", "PCA 10"];

/** In the player's money; null when it can't be priced (not for sale, or a graded card with no price typed yet). */
export function itemValue(it: TradeItem, card: CardData | undefined): number | null {
  if (it.grade) return it.price;
  if (!card) return null;
  const p = priceOf(card, it.variant, "trend");
  return p == null ? null : p * CONDITION_RATE[it.condition];
}

/** Within 5 % of the bigger side: fair. */
export function verdictOf(give: number, get: number) {
  const diff = get - give;
  const big = Math.max(give, get);
  const kind: "empty" | "fair" | "win" | "lose" = !give && !get ? "empty" : big && Math.abs(diff) / big <= 0.05 ? "fair" : diff > 0 ? "win" : "lose";
  // the knob on the bar: the share of the trade's value on the side given (0.5: balanced)
  return { kind, diff, share: give + get ? give / (give + get) : 0.5 };
}

const KEY = "nookdex:trade";
/** The mat survives a reload (a phone that kills the tab at a fair): kept on this device only. */
export function loadTrade(): TradeItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
export function saveTrade(items: TradeItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
}
