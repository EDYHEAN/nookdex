"use client";

import { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { usePension, setGold } from "./pensionStore";
import { ITEMS, syncGifts, wear } from "./shop";
import { TROPHIES } from "./trophies";
import { unlock, useTrophyStore } from "./trophyStore";

/*
 * The Advent calendar (Johan, 2026-11-16; docs/skins.md « Calendrier de l'Avent »): a fir in place of the monstera from
 * December 1st, a box a day up to the 24th, only the day's opens. Each box puts something on the tree (the 1st the tree
 * itself, then a bauble a day, the star on the 24th) and gives a little gift besides. The tree stays after Christmas.
 * Whatever day a player first comes, their first box brings the 1st's gifts too: the tree, the code, the trophy
 * (Johan, 2026-11-16: the tree for everyone, not only who came on December 1st).
 * The boxes opened ride with the trophies (`advent:<day>` among them, lib/trophyStore): kept on the device, merged
 * between devices and in the cloud like them, without an account too.
 */

export const ADVENT_YEAR = 2026;
/** Stripe's promotion code the 1st box gives: −20 % on the winter pack until December 31st */
export const ADVENT_PROMO = "NOEL20";

/** What a box gives besides its bauble */
export type Gift =
  | { kind: "tree" }
  | { kind: "layer"; layer: TreeLayer }
  | { kind: "poster"; id: string }
  | { kind: "cat"; id: string }
  | { kind: "gold"; waves: number }
  | { kind: "trophy"; id: string }
  | { kind: "promo" }
  | { kind: "frost" }
  | { kind: "card" }
  | { kind: "radio" };

/** The tree's decorations other than its baubles, each from a box (build-skins SPOTS hiver) */
export type TreeLayer = "lights" | "gifts" | "snow" | "candy" | "garland" | "socks" | "star";

/** Day by day: what each box adds (index 0 = December 1st) */
export const DAYS: Gift[][] = [
  [{ kind: "tree" }, { kind: "promo" }, { kind: "trophy", id: "advent-1" }],
  [{ kind: "layer", layer: "lights" }],
  [{ kind: "poster", id: "hiver-village" }],
  [{ kind: "cat", id: "renne" }],
  [{ kind: "gold", waves: 3 }],
  [{ kind: "poster", id: "hiver-marche" }],
  [{ kind: "trophy", id: "advent-7" }],
  [{ kind: "layer", layer: "gifts" }],
  [{ kind: "poster", id: "hiver-chalet" }],
  [{ kind: "cat", id: "lutin" }],
  [{ kind: "gold", waves: 3 }],
  [{ kind: "layer", layer: "snow" }],
  [{ kind: "poster", id: "hiver-patinoire" }],
  [{ kind: "frost" }],
  [{ kind: "layer", layer: "candy" }],
  [{ kind: "poster", id: "hiver-bonhomme" }],
  [{ kind: "gold", waves: 3 }],
  [{ kind: "cat", id: "bonnet" }],
  [{ kind: "layer", layer: "garland" }],
  [{ kind: "layer", layer: "socks" }],
  [{ kind: "poster", id: "hiver-aurore" }],
  [{ kind: "gold", waves: 6 }],
  [{ kind: "card" }],
  [{ kind: "layer", layer: "star" }, { kind: "radio" }, { kind: "trophy", id: "advent-24" }],
];

/**
 * A box's gifts: the 1st's (the tree, the code, the trophy) come with the first box opened, whatever its day; the 1st's
 * own box, opened later, gives them again (nothing twice: a trophy is won once, the tree is there).
 */
export function giftsOfDay(day: number, first: boolean): Gift[] {
  const own = DAYS[day - 1] ?? [];
  return first && day !== 1 ? [...DAYS[0], ...own] : own;
}

/** The baubles go on from the 2nd to the 23rd (the 1st brings the tree, the 24th the star): which day hangs bauble n */
export const baubleDay = (n: number) => n + 2;

const key = (day: number) => `advent:${day}`;
/** How many boxes a calendar trophy needs (the first one: any box) */
const TROPHY_BOXES: Record<string, number> = { "advent-1": 1, "advent-7": 7, "advent-24": 20 };
const daysOf = (got: Record<string, number>) =>
  Array.from({ length: 24 }, (_, i) => i + 1).filter((d) => got[key(d)]);

/** In dev, ?advent=12 opens the first 12 boxes (App) and ?adventDay=5 makes it December 5th */
export const useAdventDev = create<{ opened: number[] | null; day: number | null }>(() => ({ opened: null, day: null }));

/** The boxes opened */
export function useAdvent(): number[] {
  const got = useTrophyStore((s) => s.got);
  const dev = useAdventDev((s) => s.opened);
  return useMemo(() => dev ?? daysOf(got), [got, dev]);
}

/** The tree as the opened boxes made it: is it there, which layers, how many baubles (in their dealt order) */
export function treeOf(opened: number[]) {
  const has = new Set(opened);
  const layers = new Set<TreeLayer>();
  DAYS.forEach((gifts, i) => {
    if (!has.has(i + 1)) return;
    for (const g of gifts) if (g.kind === "layer") layers.add(g.layer);
  });
  // the first box opened, whichever, brings the tree
  const frost = DAYS.some((gifts, i) => has.has(i + 1) && gifts.some((g) => g.kind === "frost"));
  return { tree: opened.length > 0, layers, frost, baubles: (n: number) => has.has(baubleDay(n)) };
}

/**
 * Today in the calendar, from the server's clock (a phone set to the 24th opens nothing early): 1-24 in December, else
 * null; read once a visit. In dev, ?adventDay= says the day.
 */
let today: Promise<number | null> | null = null;
export function adventToday(): Promise<number | null> {
  const dev = useAdventDev.getState().day;
  if (dev) return Promise.resolve(dev);
  today ??= fetch("/manifest.webmanifest", { method: "HEAD", cache: "no-store" })
    .then((r) => new Date(r.headers.get("date") ?? Date.now()))
    .catch(() => new Date())
    .then((now) => {
      const [y, m, d] = now.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }).split("-").map(Number);
      return y === ADVENT_YEAR && m === 12 && d <= 24 ? d : null;
    });
  return today;
}

export function useAdventToday() {
  const [day, setDay] = useState<number | null>(null);
  const dev = useAdventDev((s) => s.day);
  useEffect(() => {
    let live = true;
    void adventToday().then((d) => live && setDay(d));
    return () => {
      live = false;
    };
  }, [dev]);
  return day;
}

/** Opens a box (today's only, the caller checks): its gifts given, the gold in the game's purse */
export async function openDay(day: number) {
  const { got } = useTrophyStore.getState();
  if (got[key(day)]) return;
  useTrophyStore.setState({ got: { ...got, [key(day)]: Date.now() } });
  const count = daysOf(got).length + 1;
  // the counted trophies, won by the box that reaches their count, whichever day it is
  for (const [id, n] of Object.entries(TROPHY_BOXES)) if (count >= n && TROPHIES.some((t) => t.id === id)) unlock(id);
  for (const g of giftsOfDay(day, daysOf(got).length === 0)) {
    // its trophy, as the boxes counted (a week of them, then 20 of the 24), once it exists
    if (g.kind === "trophy" && TROPHIES.some((t) => t.id === g.id) && count >= (TROPHY_BOXES[g.id] ?? 0)) unlock(g.id);
    if (g.kind === "cat") {
      // the Warwick it gives, worn at once (the room shows the gift)
      syncGifts();
      const it = ITEMS.find((i) => i.gift === day && i.slot === "cat");
      if (it) wear(it.id, true);
    }
    if (g.kind === "poster") {
      // hung at once (the room listens: PaintedRoom), kept as the player's pick
      try {
        localStorage.setItem("nookdex:poster", g.id);
      } catch {}
      window.dispatchEvent(new CustomEvent("nookdex:poster", { detail: g.id }));
    }
    if (g.kind === "radio") {
      // « Douce nuit » on the radio at once
      syncGifts();
      const it = ITEMS.find((i) => i.gift === day && i.slot === "radio");
      if (it) wear(it.id, true);
    }
    if (g.kind === "gold") {
      // as much as that many plain waves bring at the player's best wave (the game's own scale), 10 at least
      const { waveGold } = await import("./game/data");
      const { levels, gold } = usePension.getState();
      setGold(gold + g.waves * waveGold(Math.max(10, levels.wave ?? 0)));
    }
  }
}

/** The gold a box gives, for its card */
export async function goldOf(waves: number) {
  const { waveGold } = await import("./game/data");
  return waves * waveGold(Math.max(10, usePension.getState().levels.wave ?? 0));
}
