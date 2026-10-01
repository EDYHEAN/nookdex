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
  /** Scan base URL; empty when TCGdex took the card out (see unavailable) */
  img: string;
  variants: Variant[];
  price: CardPrice;
  /** No longer listed by TCGdex: kept with its last known prices, shown as a card back until it's back. */
  unavailable?: boolean;
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
  /** Sits in a pocket of a free binder. Absent = it lives in its own set's binder. */
  at?: { binder: string; pocket: number };
}

/** A set offered in the "new binder" menu (src/data/catalog.json, made by `npm run fetch-set`). */
export interface CatalogSet {
  id: string;
  serie: string;
  serieName: string;
  name: string;
  /** French code, ex: EB12, EV04, ME02 */
  code: string;
  /** TCGdex logo, without extension */
  logo: string | null;
  releaseDate: string | null;
  total: number;
  /** Sub-sets merged into this binder (Trainer Gallery…) */
  subs: string[];
  /** Older series, promos…: not offered as a binder, only searchable for the free binders */
  extra?: boolean;
}

/** A binder the player put on their shelf (shelf order). */
export type UserBinder = ({ kind: "set"; setId: string } | { kind: "free"; name: string }) & {
  id: string;
  /** Cover color; missing on saves from before colors could be picked */
  color?: string;
  /** Order of the cards in a set binder (default: set number) */
  sort?: BinderSort;
};

export type BinderSort = "num" | "rarity" | "name";

/** A binder as drawn in the room and opened on screen. */
export interface BinderDef {
  id: string;
  kind: "set" | "free";
  code: string;
  name: string;
  /** Cover color, a darker shade of it, and the text color that reads on it */
  color: string;
  dark: string;
  ink: string;
  /** Set logo (TCGdex, without extension); null for a free binder */
  logo: string | null;
  /** Place on the shelves (index in SCENE.slots) */
  slot: number;
  /** Set binders only */
  setId: string | null;
  sort: BinderSort;
}
