import type { CardData, Copy, SetData, Variant } from "./types";

type Kind = "low" | "trend";

/** Cardmarket lists reverse holos as the "holo" version of the product. */
export function unitPrice(card: CardData, variant: Variant, kind: Kind): number {
  const p = card.price;
  if (variant === "reverse") {
    const holo = kind === "low" ? p.lowHolo : p.trendHolo;
    if (holo) return holo;
  }
  return (kind === "low" ? p.low : p.trend) ?? 0;
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
      if (c.paid == null) continue;
      s.spent += c.paid * c.qty;
      s.spentTrend += unitPrice(card, c.variant, "trend") * c.qty;
    }
    s.copies += copies.reduce((n, c) => n + c.qty, 0);
  }
  return s;
}

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
export const formatEur = (n: number) => eur.format(n);

export type Tier = "common" | "rare" | "legend";

export function cardTier(card: CardData): Tier {
  const trend = card.price.trend ?? 0;
  if (trend >= 50) return "legend";
  const r = card.rarity ?? "";
  if (trend >= 5 || /V|Ultra|Magnifique|Radieux|Full Art/.test(r)) return "rare";
  return "common";
}

export const VARIANT_LABEL: Record<Variant, string> = {
  normal: "Normale",
  reverse: "Reverse",
  holo: "Holo",
};
