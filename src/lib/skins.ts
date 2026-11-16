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
  /** painted into the room (build-skins SPOTS): its night picture, and it stays still (no hand-drawn wobble) */
  srcNight?: string;
  still?: boolean;
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
  /** the Soutien collection's plaque (its own item, in the pack too): the player's name engraved in `text` */
  plaque?: Placed & { text: Box };
  /** the Advent tree (lib/advent): the bare fir, its decorations by name, its baubles in the order they're hung */
  /** a frame round the clock (the winter pack's holly): under the hands the code draws */
  clock?: Placed;
  /** the Advent calendar's frost on the window panes (its 14th box) */
  frost?: Placed;
  tree?: { base: Placed; layers: Partial<Record<"lights" | "gifts" | "snow" | "candy" | "garland" | "socks" | "star", Placed>>; baubles: Placed[] };
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
export type Slot = "sky" | "decor" | "cat" | "lamp" | "radio" | "plaque" | "clock";

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
  /** the room's corners darkened in this colour (multiply) */
  vignette?: string;
  /** things floating in the room (PaintedRoom, sceneAnim drawSpooky) */
  particles?: "spooky";
  /** the radio's tune (lib/sound) */
  music?: AmbientMood;
  /** given, never sold (the Advent calendar's: lib/advent), owned once its box is open */
  gift?: number;
  /** last day in the shop (ISO), from its bundle: bought ones stay forever */
  until?: string;
  /** first day in the shop (ISO), from its bundle */
  from?: string;
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
  /** first day in the shop (ISO): before it, not shown (the winter pack, December 1st) */
  from?: string;
  /** once gone: when it comes back (the shop's past collections say it) */
  returns?: { fr: string; en: string };
  items: string[];
  name: { fr: string; en: string };
  blurb: { fr: string; en: string };
}

/** What the room wears: the items on, put together */
export interface Look {
  art: SkinArt;
  lava?: LavaTheme;
  tint?: string;
  vignette?: string;
  particles?: "spooky";
  music?: AmbientMood;
  /** the plaque on the wall, the player's name engraved (the Soutien collection's) */
  plaque?: boolean;
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
/**
 * A collection whose art isn't cut yet (scripts/build-skins) stays out of the shop in production: its catalogue can be
 * merged before its pictures (the Soutien pack, 2026-11-16, would have reopened the shop with empty tiles).
 */
const ready = (set: string) => process.env.NODE_ENV !== "production" || !!ART[set];
const READY_ITEMS = CAT.items.filter((i) => ready(i.set));
/** The collections, in the catalogue's order: each set's name and items */
export const COLLECTIONS = Object.entries(CAT.sets)
  .filter(([id]) => ready(id))
  .map(([id, name]) => ({ id, name, items: READY_ITEMS.filter((i) => i.set === id).map((i) => i.id) }));

export const BUNDLES: Bundle[] = CAT.bundles.filter((b) => b.items.every((id) => READY_ITEMS.some((i) => i.id === id)));
/** The permanent pack that supports the site (Johan, 2026-11-16): bought as a pack, it adds Warwick's poster and the ★ */
export const SUPPORT_BUNDLE = "soutien";
/** The Advent tree, once its art is cut (scripts/build-skins SPOTS hiver) */
export const TREE = ART.hiver?.tree;
/** The frost on the panes, once its art is cut */
export const FROST = ART.hiver?.frost;
/** The engraved plaque, once its art is cut (scripts/build-skins) */
export const PLAQUE = ART[SUPPORT_BUNDLE]?.plaque;
export const ITEMS: Item[] = READY_ITEMS.map((i) => {
  const b = BUNDLES.find((x) => x.items.includes(i.id));
  return { ...i, until: b?.until, from: b?.from };
});
export const ITEM = new Map(ITEMS.map((i) => [i.id, i]));
export const BUNDLE = new Map(BUNDLES.map((b) => [b.id, b]));

/** An item, or a bundle's items: what buying (or trying) it gives */
export const itemsOf = (id: string): string[] => BUNDLE.get(id)?.items ?? (ITEM.has(id) ? [id] : []);
/** A bundle's worth when its items are bought one by one */
export const worthOf = (b: Bundle) => b.items.reduce((n, id) => n + (ITEM.get(id)?.price ?? 0), 0);
/** Still for sale (its last day not past) */
export const onSale = (x: { until?: string; from?: string; gift?: number }) => {
  const today = new Date().toISOString().slice(0, 10);
  return !x.gift && (!x.until || today <= x.until) && (!x.from || today >= x.from);
};

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
    if (it.slot === "clock") look.art.clock = a.clock;
    if (it.lava) look.lava = it.lava;
    if (it.tint) look.tint = it.tint;
    if (it.vignette) look.vignette = it.vignette;
    if (it.particles) look.particles = it.particles;
    if (it.music) look.music = it.music;
    if (it.slot === "plaque") look.plaque = true;
  }
  return any ? look : null;
}

/** "2,99 €" / "€2.99" */
export const formatEuros = (n: number, lang: "fr" | "en") =>
  new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-IE", { style: "currency", currency: "EUR" }).format(n);
