"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/*
 * The Advent calendar (Johan, 2026-11-16; docs/skins.md « Calendrier de l'Avent »): a fir in place of the monstera from
 * December 1st, a box a day up to the 24th, only the day's opens. Each box puts something on the tree (the 1st the tree
 * itself, then a bauble a day, the star on the 24th) and gives a little gift besides. The tree stays after Christmas.
 */

export const ADVENT_YEAR = 2026;

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
  [{ kind: "cat", id: "pyjama" }],
  [{ kind: "layer", layer: "garland" }],
  [{ kind: "layer", layer: "socks" }],
  [{ kind: "poster", id: "aurore" }],
  [{ kind: "gold", waves: 6 }],
  [{ kind: "card" }],
  [{ kind: "layer", layer: "star" }, { kind: "radio" }, { kind: "trophy", id: "advent-24" }],
];

/** The baubles go on from the 2nd to the 23rd (the 1st brings the tree, the 24th the star): which day hangs bauble n */
export const baubleDay = (n: number) => n + 2;

interface AdventState {
  /** the days opened (1-24) */
  opened: number[];
}

export const useAdvent = create<AdventState>()(
  persist(() => ({ opened: [] }) as AdventState, {
    name: "nookdex:advent-2026",
    storage: createJSONStorage(() => localStorage),
  }),
);

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
