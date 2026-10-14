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
  /** worn by Warwick, asleep and awake */
  hat?: { sleep: Placed; awake: Placed };
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

export interface Skin {
  id: string;
  name: { fr: string; en: string };
  blurb: { fr: string; en: string };
  /** what's in it, one line each */
  contents: { fr: string; en: string }[];
  /** euros */
  price: number;
  /** the lava lamp's colour while it's worn (first in the lamp's cycle) */
  lava?: LavaTheme;
  /** a light laid over the whole room (CSS colour, soft-light) */
  tint?: string;
  /** the radio's tune while it's worn (lib/sound) */
  music?: AmbientMood;
  art: SkinArt;
}

const ART = art as Record<string, SkinArt>;

/** the catalogue (src/data/skins.json, also read by scripts/stripe-skins.mjs for Stripe's products), with its art */
export const SKINS: Skin[] = (catalogue as Omit<Skin, "art">[]).map((s) => ({ ...s, art: ART[s.id] ?? {} }));

export const SKIN = new Map(SKINS.map((s) => [s.id, s]));

/** "2,99 €" / "€2.99" */
export const formatEuros = (n: number, lang: "fr" | "en") =>
  new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-IE", { style: "currency", currency: "EUR" }).format(n);
