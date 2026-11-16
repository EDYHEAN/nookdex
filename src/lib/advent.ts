"use client";

import { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { usePension, setGold } from "./pensionStore";
import { TROPHIES } from "./trophies";
import { unlock, useTrophyStore } from "./trophyStore";

/*
 * The Advent calendar (Johan, 2026-11-16; docs/skins.md « Calendrier de l'Avent »): a fir in place of the monstera from
 * December 1st, a box a day up to the 24th, only the day's opens. Each box puts something on the tree (the 1st the tree
 * itself, then a bauble a day, the star on the 24th) and gives a little gift besides. The tree stays after Christmas.
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
  [{ kind: "poster", id: "village" }],
  [{ kind: "cat", id: "renne" }],
  [{ kind: "gold", waves: 3 }],
  [{ kind: "poster", id: "marche" }],
  [{ kind: "trophy", id: "advent-7" }],
  [{ kind: "layer", layer: "gifts" }],
  [{ kind: "poster", id: "chalet" }],
  [{ kind: "cat", id: "lutin" }],
  [{ kind: "gold", waves: 3 }],
  [{ kind: "layer", layer: "snow" }],
  [{ kind: "poster", id: "patinoire" }],
  [{ kind: "frost" }],
  [{ kind: "layer", layer: "candy" }],
  [{ kind: "poster", id: "bonhomme" }],
  [{ kind: "gold", waves: 3 }],
  [{ kind: "cat", id: "bonnet" }],
  [{ kind: "layer", layer: "garland" }],
  [{ kind: "layer", layer: "socks" }],
  [{ kind: "poster", id: "aurore" }],
  [{ kind: "gold", waves: 6 }],
  [{ kind: "card" }],
  [{ kind: "layer", layer: "star" }, { kind: "radio" }, { kind: "trophy", id: "advent-24" }],
];

/** The baubles go on from the 2nd to the 23rd (the 1st brings the tree, the 24th the star): which day hangs bauble n */
export const baubleDay = (n: number) => n + 2;

const key = (day: number) => `advent:${day}`;
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
  return { tree: has.has(1), layers, baubles: (n: number) => has.has(baubleDay(n)) };
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
  for (const g of DAYS[day - 1] ?? []) {
    // its trophy once it exists (each needs its trinket: docs/skins.md A5)
    if (g.kind === "trophy" && TROPHIES.some((t) => t.id === g.id)) unlock(g.id);
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
