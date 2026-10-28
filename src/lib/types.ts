import type { CardLang } from "./cardLang";

export type Variant = "normal" | "reverse" | "holo";

// Cardmarket conditions, best to worst.
export type Condition = "MT" | "NM" | "EX" | "GD" | "LP" | "PL" | "PO";

export interface CardPrice {
  low: number | null;
  trend: number | null;
  lowHolo: number | null;
  trendHolo: number | null;
  /** Average sale price over the last 7 and 30 days (for the ↗ ↘ arrow); missing in files fetched before */
  avg7?: number | null;
  avg30?: number | null;
  avg7Holo?: number | null;
  avg30Holo?: number | null;
  /** English cards: TCGplayer product id (the "see on TCGplayer" link) */
  tp?: number;
  /** Cardmarket product id (the card's own page on Cardmarket); missing in files fetched before */
  cmId?: number;
  /** English cards TCGplayer doesn't sell: Cardmarket's price, converted to dollars */
  cm?: true;
  /** A trend 20 times off the card's sales (fetch-set's saneTrend): the raw one. A Cardmarket trend is then replaced by
   * the 7-day (or 30-day) sales average, a TCGplayer asking price with no sale by null */
  trendRaw?: number;
  trendHoloRaw?: number;
  /** English cards: TCGplayer had no sale, the trend is the middle of the listings */
  ask?: true;
  askHolo?: true;
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
  /** Japanese cards: the French and English names of their Pokémon ("Dracaufeu · Charizard"), to find them */
  aka?: string;
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
  /** English files: prices in dollars (TCGplayer). Absent: Cardmarket euros. */
  currency?: "USD";
  cards: CardData[];
}

export interface Copy {
  id: string;
  variant: Variant;
  condition: Condition;
  qty: number;
  /** What this copy cost, in the site's currency (€ in French, $ in English). 0 = pulled from a booster, null = not filled in. */
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
  /** Card language, set when read (ids are then keyed with it, see lib/catalog) */
  lang?: CardLang;
}

/** A binder the player put on their shelf (shelf order). */
/**
 * A set binder's setId is a set key: "sv08" (French cards), "en:sv08" (English cards). A wishlist is a free binder
 * (`wish`) whose pockets can also hold wanted cards (`wants`, pocket -> card key): drawn as ghosts, never owned nor
 * counted. "Got it!" on one makes it a copy kept in that pocket, like any free binder's (never in its set's binder).
 */
export type UserBinder = ({ kind: "set"; setId: string } | { kind: "free"; name: string; wish?: boolean; wants?: Record<string, string> }) & {
  id: string;
  /** Cover color; missing on saves from before colors could be picked */
  color?: string;
  /** Order of the cards in a set binder (default: set number) */
  sort?: BinderSort;
  /** Pockets a page (default 9) */
  grid?: BinderGrid;
};

/** Pockets a page: 2x2, 2x3 or 3x3, like real binders (Johan, 2026-10-17: the commonest) */
export type BinderGrid = 4 | 6 | 9;

export type BinderSort = "num" | "rarity" | "price" | "name";

/** A binder as drawn in the room and opened on screen. */
export interface BinderDef {
  id: string;
  kind: "set" | "free";
  /** a wishlist (a free binder with wanted cards) */
  wish: boolean;
  /** a wishlist's wanted cards, pocket -> card key (empty for the others) */
  wants: Record<string, string>;
  code: string;
  name: string;
  /** Cover color, a darker shade of it, and the text color that reads on it */
  color: string;
  dark: string;
  ink: string;
  /** Set logo (TCGdex, without extension); null for a free binder */
  logo: string | null;
  /** Place on the shelves (index in SCENE.slots), on its page of the shelf (12 binders a page) */
  slot: number;
  page: number;
  /** Set binders only (a set key, see lib/cardLang) */
  setId: string | null;
  /** Pockets a page */
  grid: BinderGrid;
  /** Card language of a set binder; null for a free binder (its cards can be of any language) */
  lang: CardLang | null;
  sort: BinderSort;
}
