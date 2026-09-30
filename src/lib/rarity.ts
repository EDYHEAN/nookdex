import type { BinderSort, CardData } from "./types";

/** TCGdex French rarities, from the most common to the rarest (official tiers, checked against prices). */
const RANK: Record<string, number> = {
  Commune: 0,
  "Peu Commune": 1,
  Rare: 2,
  "Holo Rare": 3,
  "Pikachu Rare": 3,
  "Double rare": 4,
  "Holo Rare V": 4,
  "HIGH-TECH rare": 4,
  "Radieux Rare": 5,
  "Holo Rare VSTAR": 5,
  "Holo Rare VMAX": 5,
  "Shiny rare": 6,
  "Shiny rare V": 6,
  "Chromatique ultra rare": 7,
  "Dresseur Full Art": 7,
  "Ultra Rare": 7,
  Magnifique: 8,
  "Illustration rare": 8,
  "Mega Attack Rare": 8,
  "Shiny rare VMAX": 8,
  "Magnifique rare": 9,
  "Futuristic Rare": 9,
  "Illustration spéciale rare": 10,
  "Hyper rare": 11,
  "Méga Hyper Rare": 12,
  "Rare Noir Blanc": 12,
  "RGB Rare": 13,
};

export const rarityRank = (card: CardData) => RANK[card.rarity ?? ""] ?? 0;

export const SORT_LABEL: Record<BinderSort, string> = {
  num: "N°",
  rarity: "Rareté",
  name: "A → Z",
};

const byName = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

/** A set's cards in the order the binder shows them. "num" keeps the set order (sub-sets after). */
export function sortCards(cards: CardData[], sort: BinderSort): CardData[] {
  if (sort === "num") return cards;
  const order = new Map(cards.map((c, i) => [c.id, i]));
  const tie = (a: CardData, b: CardData) => order.get(a.id)! - order.get(b.id)!;
  if (sort === "name") return [...cards].sort((a, b) => byName.compare(a.name, b.name) || tie(a, b));
  // rarest first, then the most valuable of a tier
  return [...cards].sort((a, b) => rarityRank(b) - rarityRank(a) || (b.price.trend ?? 0) - (a.price.trend ?? 0) || tie(a, b));
}
