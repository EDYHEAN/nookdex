import { currentLang } from "./lang";
import type { CardData, Copy, SetData, Variant } from "./types";

type Kind = "low" | "trend";

/**
 * Cardmarket price of a variant, or null when the card isn't for sale there (TCGdex then leaves Cardmarket out).
 * Cardmarket lists reverse holos as the "holo" version of the product.
 */
export function priceOf(card: CardData, variant: Variant, kind: Kind): number | null {
  const p = card.price;
  if (variant === "reverse") {
    const holo = kind === "low" ? p.lowHolo : p.trendHolo;
    if (holo) return holo;
  }
  return (kind === "low" ? p.low : p.trend) ?? null;
}

/** For sums: a card without a Cardmarket price adds nothing. */
export const unitPrice = (card: CardData, variant: Variant, kind: Kind): number => priceOf(card, variant, kind) ?? 0;

/** A card's price is known (it's sold on Cardmarket). */
export const hasPrice = (card: CardData, variant: Variant) => priceOf(card, variant, "trend") != null;

/** Where the price is heading: last 7 days' average against the last 30 days' (null when too flat or unknown). */
export function priceMove(card: CardData, variant: Variant): number | null {
  const p = card.price;
  const holo = variant === "reverse" && p.avg7Holo != null && p.avg30Holo != null;
  const recent = holo ? p.avg7Holo : p.avg7;
  const month = holo ? p.avg30Holo : p.avg30;
  if (recent == null || month == null || month <= 0) return null;
  const move = (recent - month) / month;
  return Math.abs(move) >= 0.05 ? move : null;
}

export function copiesValue(card: CardData, copies: Copy[] | undefined, kind: Kind): number {
  if (!copies) return 0;
  return copies.reduce((sum, c) => sum + c.qty * unitPrice(card, c.variant, kind), 0);
}

/** Sum of what was paid, over the copies where a price was entered. */
export function copiesPaid(copies: Copy[] | undefined): { paid: number; known: number } {
  let paid = 0;
  let known = 0;
  copies?.forEach((c) => {
    if (c.paid == null) return;
    paid += c.paid * c.qty;
    known += c.qty;
  });
  return { paid, known };
}

export interface SetStats {
  total: number;
  owned: number;
  masterTotal: number;
  masterOwned: number;
  low: number;
  trend: number;
  copies: number;
  /** € spent on the copies that have a purchase price */
  spent: number;
  /** Cardmarket trend of those same copies, to compute a gain */
  spentTrend: number;
}

export function setStats(set: SetData, collection: Record<string, Copy[]>): SetStats {
  const s: SetStats = {
    total: set.cards.length, owned: 0, masterTotal: 0, masterOwned: 0, low: 0, trend: 0, copies: 0, spent: 0, spentTrend: 0,
  };
  for (const card of set.cards) {
    s.masterTotal += card.variants.length;
    const copies = collection[card.id];
    if (!copies?.length) continue;
    s.owned++;
    const have = new Set(copies.map((c) => c.variant));
    s.masterOwned += card.variants.filter((v) => have.has(v)).length;
    s.low += copiesValue(card, copies, "low");
    s.trend += copiesValue(card, copies, "trend");
    for (const c of copies) {
      // a gain needs both prices: what was paid, and what it's worth now
      if (c.paid == null || !hasPrice(card, c.variant)) continue;
      s.spent += c.paid * c.qty;
      s.spentTrend += unitPrice(card, c.variant, "trend") * c.qty;
    }
    s.copies += copies.reduce((n, c) => n + c.qty, 0);
  }
  return s;
}

// Cardmarket prices are in euros, written the visitor's way: 12,50 € or €12.50
const EUR = { fr: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }), en: new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }) };
export const formatEur = (n: number) => EUR[currentLang()].format(n);
/** A card's price, or a dash when it isn't sold on Cardmarket (never "0,00 €", which reads as worthless). */
export const formatPrice = (n: number | null) => (n == null ? "—" : formatEur(n));
export const noPriceText = () => (currentLang() === "en" ? "Not for sale on Cardmarket right now" : "Pas en vente sur Cardmarket en ce moment");

export type Tier = "common" | "rare" | "legend";

export function cardTier(card: CardData): Tier {
  const trend = card.price.trend ?? 0;
  if (trend >= 50) return "legend";
  const r = card.rarity ?? "";
  if (trend >= 5 || /V|Ultra|Magnifique|Radieux|Full Art/.test(r)) return "rare";
  return "common";
}

const VARIANTS: Record<"fr" | "en", Record<Variant, string>> = {
  fr: { normal: "Normale", reverse: "Reverse", holo: "Holo" },
  en: { normal: "Normal", reverse: "Reverse", holo: "Holo" },
};
export const variantLabel = (v: Variant) => VARIANTS[currentLang()][v];

export interface Totals {
  /** Progress over the set binders */
  owned: number;
  total: number;
  /** Every card owned, wherever it is kept */
  cards: number;
  copies: number;
  low: number;
  trend: number;
  spent: number;
  spentTrend: number;
}

/** Value of a list of copies (each counted once, even if its card sits in two binders). */
export function copiesTotals(items: { card: CardData; copies: Copy[] }[]): Omit<Totals, "owned" | "total"> {
  const t = { cards: 0, copies: 0, low: 0, trend: 0, spent: 0, spentTrend: 0 };
  for (const { card, copies } of items) {
    if (!copies.length) continue;
    t.cards++;
    t.low += copiesValue(card, copies, "low");
    t.trend += copiesValue(card, copies, "trend");
    for (const c of copies) {
      t.copies += c.qty;
      if (c.paid == null || !hasPrice(card, c.variant)) continue;
      t.spent += c.paid * c.qty;
      t.spentTrend += unitPrice(card, c.variant, "trend") * c.qty;
    }
  }
  return t;
}

export function collectionTotals(collection: Record<string, Copy[]>, cards: Record<string, CardData>, sets: SetData[]): Totals {
  let owned = 0;
  let total = 0;
  for (const set of sets) {
    total += set.cards.length;
    owned += set.cards.filter((c) => collection[c.id]?.length).length;
  }
  const items = Object.entries(collection).flatMap(([id, copies]) => (cards[id] ? [{ card: cards[id], copies }] : []));
  return { owned, total, ...copiesTotals(items) };
}
