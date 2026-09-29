export type Variant = "normal" | "reverse" | "holo";

// Cardmarket conditions, best to worst.
export type Condition = "MT" | "NM" | "EX" | "GD" | "LP" | "PL" | "PO";

export interface CardPrice {
  low: number | null;
  trend: number | null;
  lowHolo: number | null;
  trendHolo: number | null;
}

export interface CardData {
  id: string;
  num: string;
  name: string;
  rarity: string | null;
  category: string | null;
  img: string;
  variants: Variant[];
  price: CardPrice;
}

export interface SetData {
  id: string;
  name: string;
  logo: string | null;
  symbol: string | null;
  official: number | null;
  releaseDate: string | null;
  pricesUpdated: string;
  cards: CardData[];
}

export interface Copy {
  id: string;
  variant: Variant;
  condition: Condition;
  qty: number;
  /** What this copy cost, in €. 0 = pulled from a booster, null = not filled in. */
  paid: number | null;
  addedAt: number;
}

export interface BinderDef {
  id: string;
  code: string;
  name: string;
  /** Cover / spine colors */
  color: string;
  dark: string;
  ink: string;
  /** Set logo (TCGdex, without extension) */
  logo: string;
  /** Painted binder in the room ("shelf-index") */
  slot: string;
  /** null = placeholder binder, not filled yet */
  set: SetData | null;
}
