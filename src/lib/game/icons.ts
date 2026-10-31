// Pictograms for the moves' types and the held items (2026-10-31, « lisibilité »: « ABI », « OSM », « GR » said nothing).
// Rows of letters, a pixel each: k the outline (ink), w white, a the item's own colour; drawn on the canvas (engine `pix`)
// and in the menus (NookBoy `Icon`). White inside a dark outline reads on any type's colour, light or dark.

import type { Elem, ItemId } from "./data";
import type { ColorKey } from "./gfx";

export const TYPE_ICONS: Record<Elem, string[]> = {
  fire: ["....k....", "...kwk...", "..kwwk...", "..kwwwk..", ".kwwkwwk.", ".kwkkkwk.", ".kwk.kwk.", "..kwwwk..", "...kkk..."],
  water: ["....k....", "...kwk...", "...kwk...", "..kwwwk..", ".kwwwwwk.", ".kwwwwwk.", ".kwkwwwk.", "..kwwwk..", "...kkk..."],
  grass: [".....kkk.", "...kkwwk.", "..kwwwwk.", ".kwwwkwk.", ".kwwkwwk.", ".kwkwwk..", "..kkkk...", ".k.......", "k........"],
  elec: ["....kkkk.", "...kwwk..", "..kwwk...", ".kwwkkkk.", ".kkkwwwk.", "...kwwk..", "..kwwk...", "..kwk....", "..kk....."],
  ice: ["...kkk...", "k..kwk..k", "kk.kwk.kk", ".kkkwkkk.", "kwwwwwwwk", ".kkkwkkk.", "kk.kwk.kk", "k..kwk..k", "...kkk..."],
  ghost: ["..kkkkk..", ".kwwwwwk.", "kwwkwkwwk", "kwwkwkwwk", "kwwwwwwwk", "kwwwwwwwk", "kwkwkwkwk", "kk.k.k.kk"],
  ground: ["...kkk...", "..kwwwk..", ".kwwkwwk.", ".kwwwwwk.", "kwwwwkwwk", "kwkwwwwwk", "kkkkkkkkk"],
  psy: ["..kkkkk..", ".kwwwwwk.", "kwwkkkwwk", "kwwkkkwwk", ".kwwwwwk.", "..kkkkk.."],
  normal: ["....k....", "...kwk...", "kkkkwkkkk", "kwwwwwwwk", ".kwwwwwk.", "..kwwwk..", ".kwwkwwk.", ".kkk.kkk."],
  fly: ["kk.......", "kwkk.....", "kwwwkk...", ".kwwwwkk.", ".kwwwwwwk", "..kwwwwk.", "...kwwk..", "....kk..."],
  dragon: ["k..k..k..", "kk.kk.kk.", "kwkkwkkwk", "kwwkwwkwk", ".kwwwwwwk", ".kwwwwwwk", "..kwwwwk.", "...kkkk.."],
  poison: ["..kkkkk..", ".kwwwwwk.", "kwkkwkkwk", "kwkkwkkwk", "kwwwwwwwk", ".kwkwkwk.", "..kkkkk.."],
  fight: [".kkkkkk..", "kwkwkwkk.", "kwkwkwkwk", "kwwwwwkwk", "kwwwwwwwk", "kwwwwwwk.", ".kwwwwk..", "..kkkk..."],
  fairy: [".kk...kk.", "kwwk.kwwk", "kwwwkwwwk", "kwwwwwwwk", ".kwwwwwk.", "..kwwwk..", "...kwk...", "....k...."],
  steel: ["...kkk...", ".kkwwwkk.", ".kwwwwwk.", "kwwkkkwwk", "kwwk.kwwk", "kwwkkkwwk", ".kwwwwwk.", ".kkwwwkk.", "...kkk..."],
  dark: ["..kkkk...", ".kwwwkk..", "kwwwk....", "kwwk.....", "kwwk.....", "kwwwk....", ".kwwwkk..", "..kkkk..."],
  bug: [".k.....k.", "..k...k..", "..kkkkk..", ".kwwkwwk.", "kkwwkwwkk", ".kwwkwwk.", "kkwwkwwkk", "..kkkkk.."],
};

/** an item's picture and its colour (a): at most 9x8, the slot's level pips go under it */
export const ITEM_ICONS: Record<ItemId, { rows: string[]; a: ColorKey }> = {
  leftovers: { rows: ["....k....", "...kk....", "..kaaak..", ".kaaaaak.", ".kawaaak.", ".kaaaaak.", "..kaaak..", "...kkk..."], a: "fire" },
  band: { rows: [".kkkkkkk.", "kaaaaaaak", "kawaaaaak", ".kkkkkkk.", "......kak", ".....kak.", "......k.."], a: "fire" },
  scarf: { rows: ["..kkkkk..", ".kaaaaak.", "kaawaaaak", ".kkkkaak.", "....kaak.", "....kaak.", ".....kk.."], a: "water" },
  claw: { rows: ["k.....k..", "kak..kak.", ".kak.kak.", ".kaakaak.", "..kaaak..", "..kwwwk..", "...kkk..."], a: "ground" },
  lens: { rows: ["..kkkk...", ".kwwwwk..", "kwaaaawk.", "kwaaaawk.", ".kwwwwk..", "..kkkkkk.", "......kkk"], a: "water" },
  magnet: { rows: ["kkk...kkk", "kwk...kwk", "kak...kak", "kak...kak", "kaakkkaak", ".kaaaaak.", "..kkkkk.."], a: "fire" },
  share: { rows: ["...kkk...", "...kak...", ".kkkakkk.", ".kaaaaak.", ".kkkakkk.", "...kak...", "...kkk..."], a: "xp" },
  hpup: { rows: ["...kkk...", "...kwk...", "..kkkkk..", ".kaaaaak.", ".kawaaak.", ".kaaaaak.", ".kaaaaak.", "..kkkkk.."], a: "heal" },
  root: { rows: ["...kkk...", "..kaaak..", "...kak...", "..kakak..", ".kak.kak.", "kak...kak", "kk.....kk"], a: "ground" },
  shellbell: { rows: ["....k....", "...kak...", "..kaaak..", "..kaaak..", ".kaaaaak.", ".kawaaak.", "kkkkkkkkk", "....k...."], a: "coin" },
  belt: { rows: ["kkkkkkkkk", "kaaakaaak", "kaakwkaak", "kaaakaaak", "kkkkkkkkk"], a: "fight" },
  lifeorb: { rows: ["..kkkkk..", ".kaaaaak.", "kawwaaaak", "kawaaaaak", "kaaaaaaak", ".kaaaaak.", "..kkkkk.."], a: "psy" },
  helmet: { rows: ["..kkkkk..", ".kaaaaak.", "kaawaaaak", "kaaaaaaak", "kkkkkkkkk", "k.k...k.k"], a: "rock" },
  eviolite: { rows: ["...kkk...", "..kaaak..", ".kawaaak.", "kaaaaaaak", ".kaaaaak.", "..kaaak..", "...kkk..."], a: "ghost" },
  kingsrock: { rows: [".k.k.k.", "kakakak", "kaaaaak", "kawaaak", "kkkkkkk"], a: "coin" },
  sash: { rows: ["kk.......", "kakk.....", ".kaakk...", "..kaaakk.", "...kkaaak", ".....kkak", ".......kk"], a: "fire" },
  spoon: { rows: ["...kk....", "..kaak...", "..kaak...", "...kk....", "...kak...", "....kak..", ".....kak.", "......kk."], a: "steel" },
  razorfang: { rows: ["kkkkkkkk.", "kwwwwwwk.", ".kwwwwk..", "..kwwk...", "...kk...."], a: "normal" },
  metronome: { rows: ["....k....", "...kak...", "..kakak..", "..kaakk..", ".kaaakak.", ".kaaaaak.", "kkkkkkkkk"], a: "ground" },
  amulet: { rows: ["..kkkk...", ".kaaaak..", "kaawaaak.", "kaaaaaak.", "kaaaaaak.", ".kaaaak..", "..kkkk..."], a: "coin" },
};
