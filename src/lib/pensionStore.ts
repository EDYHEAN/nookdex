"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * The Nook Survivors Pension and purse: permanent boosts, and the gold kept from run to run (Johan, 2026-10-13: no gold
 * lost at the end of a run). Apart from the main store, like the trophies: they ride along in the save (Backup.pension,
 * Backup.wallet, the cloud) and never count in its fingerprint. Levels only go up, so two devices merge by keeping the
 * higher one; the purse goes up and down, so the latest one wins.
 */
interface PensionState {
  /** upgrade id -> level */
  levels: Record<string, number>;
  /** the last day (UTC, YYYY-MM-DD) the daily challenge paid its bonus */
  dailyPaid: string | null;
  /** the purse, and when it last changed */
  gold: number;
  goldAt: number;
}

export const usePension = create<PensionState>()(
  persist(() => ({ levels: {}, dailyPaid: null, gold: 0, goldAt: 0 }) as PensionState, {
    name: "nookdex:pension",
    storage: createJSONStorage(() => localStorage),
  }),
);

export function setGold(gold: number) {
  usePension.setState({ gold: Math.max(0, Math.round(gold)), goldAt: Date.now() });
}

/**
 * The best classic or coop wave reached (it opens the Pension's 2nd rank, then the start tiers). Kept among the levels
 * under "wave": it merges like them (the higher wins) and rides in the save and the cloud with them; the game reads only
 * its upgrades' ids.
 */
export const bestWave = (levels: Record<string, number>) => levels.wave ?? 0;
export function reachWave(wave: number) {
  const { levels } = usePension.getState();
  if (wave > bestWave(levels)) usePension.setState({ levels: { ...levels, wave } });
}

/** a level bought with the purse */
export function buyLevel(id: string, cost: number) {
  const { levels, gold } = usePension.getState();
  if (gold < cost) return false;
  usePension.setState({ levels: { ...levels, [id]: (levels[id] ?? 0) + 1 } });
  setGold(gold - cost);
  return true;
}

/** Levels from a save (the cloud, an imported file): the higher of the two, upgrade by upgrade. */
export function mergePension(other: Record<string, number> | undefined) {
  if (!other) return;
  const levels = { ...usePension.getState().levels };
  let changed = false;
  for (const [id, lv] of Object.entries(other)) {
    if (typeof lv !== "number" || (levels[id] ?? 0) >= lv) continue;
    levels[id] = lv;
    changed = true;
  }
  if (changed) usePension.setState({ levels });
}

/** The purse from a save: kept if it changed more recently than this one. */
export function mergeWallet(w: { gold: number; at: number } | undefined) {
  if (!w || typeof w.gold !== "number" || typeof w.at !== "number") return;
  if (w.at > usePension.getState().goldAt) usePension.setState({ gold: w.gold, goldAt: w.at });
}

/** Same levels and purse: tells if the cloud is behind. */
export const pensionKey = (levels: Record<string, number> | undefined, wallet?: { gold: number; at: number }) =>
  Object.entries(levels ?? {})
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}${v}`)
    .join(",") + (wallet ? `|${wallet.gold}@${wallet.at}` : "");
