import catalogue from "@/data/skins.json";
import art from "@/data/skin-art.json";
import type { AmbientMood } from "./sound";

/*
 * The shop's catalogue (docs/skins.md): read by the room and the shop, and by the server that sells them
 * (app/api/shop). Paid skins are NookDex's own art, never anything Pokémon.
 */

/** A box in the painted room (scene px) */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A painted thing set in the room: its picture (cut out of a Gemini sheet), where, turned how much */
export interface Placed extends Box {
  src: string;
  /** degrees */
  rot?: number;
  /** a candle's flame or a lantern: a warm glow flickers around it at night */
  glow?: boolean;
  /** it stands on something: a soft shadow under it */
  shadow?: boolean;
  /** flames that dance over the painted ones: the bottom of each, and its height (scene px) */
  flames?: { x: number; y: number; h: number }[];
}

/** What a skin paints over the room: pictures cut by scripts/build-skins, placed in src/data/skin-art.json */
export interface SkinArt {
  /** the view through the window, night and day */
  sky?: string;
  skyDay?: string;
  /** decorations standing in the room, drawn over the painted backdrop and under the binders */
  decor?: Placed[];
  /** Warwick himself in costume, asleep and awake (his pictures swapped) */
  cat?: { sleep: Placed; awake: Placed };
  /** a spider that drops down its thread from (x, top) to `drop` now and then, and climbs back */
  spider?: { src: string; w: number; h: number; x: number; top: number; drop: number };
}

export interface LavaTheme {
  name: string;
  nameEn: string;
  fill: string;
  light: string;
  line: string;
  glow: string;
}

export type Rarity = "uncommon" | "rare" | "epic" | "legendary";
/** where an item goes: one of each worn at a time */
export type Slot = "sky" | "decor" | "cat" | "lamp" | "radio";

/** A thing sold on its own (src/data/skins.json): a part of a set's art, or a colour, or a tune */
export interface Item {
  id: string;
  /** its art in src/data/skin-art.json */
  set: string;
  slot: Slot;
  rarity: Rarity;
  /** euros, taxes included */
  price: number;
  /** its picture in the shop; a cut-out floats on its tile, else it's framed */
  icon: string;
  cutout?: boolean;
  name: { fr: string; en: string };
  blurb: { fr: string; en: string };
  /** the lava lamp's colour (first in the lamp's cycle) */
  lava?: LavaTheme;
  /** a light laid over the whole room (CSS colour, soft-light) */
  tint?: string;
  /** the radio's tune (lib/sound) */
  music?: AmbientMood;
  /** last day in the shop (ISO), from its bundle: bought ones stay forever */
  until?: string;
}

/** Items sold together, cheaper */
export interface Bundle {
  id: string;
  rarity: Rarity;
  price: number;
  icon: string;
  cutout?: boolean;
  /** last day in the shop (ISO) */
  until?: string;
  items: string[];
  name: { fr: string; en: string };
  blurb: { fr: string; en: string };
}

/** What the room wears: the items on, put together */
export interface Look {
  art: SkinArt;
  lava?: LavaTheme;
  tint?: string;
  music?: AmbientMood;
}

const ART = art as Record<string, SkinArt>;
/** The room as it comes, slot by slot: the locker's base collection (wearing it takes that slot's item off) */
export interface BaseItem {
  slot: Slot;
  icon: string;
  cutout?: boolean;
  name: { fr: string; en: string };
}

const CAT = catalogue as {
  sets: Record<string, { fr: string; en: string }>;
  base: BaseItem[];
  items: Omit<Item, "until">[];
  bundles: Bundle[];
};
export const BASE: BaseItem[] = CAT.base;
/** The collections, in the catalogue's order: each set's name and items */
export const COLLECTIONS = Object.entries(CAT.sets).map(([id, name]) => ({ id, name, items: CAT.items.filter((i) => i.set === id).map((i) => i.id) }));

export const BUNDLES: Bundle[] = CAT.bundles;
export const ITEMS: Item[] = CAT.items.map((i) => ({ ...i, until: BUNDLES.find((b) => b.items.includes(i.id))?.until }));
export const ITEM = new Map(ITEMS.map((i) => [i.id, i]));
export const BUNDLE = new Map(BUNDLES.map((b) => [b.id, b]));

/** An item, or a bundle's items: what buying (or trying) it gives */
export const itemsOf = (id: string): string[] => BUNDLE.get(id)?.items ?? (ITEM.has(id) ? [id] : []);
/** A bundle's worth when its items are bought one by one */
export const worthOf = (b: Bundle) => b.items.reduce((n, id) => n + (ITEM.get(id)?.price ?? 0), 0);
/** Still for sale (its last day not past) */
export const onSale = (x: { until?: string }) => !x.until || new Date().toISOString().slice(0, 10) <= x.until;

/** The room's look from the items worn (one per slot: the last one wins) */
export function lookOf(ids: string[]): Look | null {
  const look: Look = { art: {} };
  let any = false;
  for (const id of ids) {
    const it = ITEM.get(id);
    if (!it) continue;
    any = true;
    const a = ART[it.set] ?? {};
    if (it.slot === "sky") Object.assign(look.art, { sky: a.sky, skyDay: a.skyDay });
    if (it.slot === "decor") Object.assign(look.art, { decor: a.decor, spider: a.spider });
    if (it.slot === "cat") look.art.cat = a.cat;
    if (it.lava) look.lava = it.lava;
    if (it.tint) look.tint = it.tint;
    if (it.music) look.music = it.music;
  }
  return any ? look : null;
}

/** "2,99 €" / "€2.99" */
export const formatEuros = (n: number, lang: "fr" | "en") =>
  new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-IE", { style: "currency", currency: "EUR" }).format(n);
