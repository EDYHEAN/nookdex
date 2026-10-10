"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * The trophies won, apart from the main store: they ride along in the save (Backup.trophies, the cloud) but never
 * count in its fingerprint, so two devices winning different ones never raise a "keep which one?" conflict.
 */
interface TrophyState {
  /** trophy id -> when it was won */
  got: Record<string, number>;
  /** counters of the desk's little games (cat pets, days played…): this device only */
  stats: Record<string, number>;
  /** last day this device played (YYYY-MM-DD), for the "regular" trophies */
  lastDay: string | null;
  /** when the trophy case was last opened: what was won since shines "new" */
  seenAt: number;
}

export const useTrophyStore = create<TrophyState>()(
  persist(() => ({ got: {}, stats: {}, lastDay: null, seenAt: 0 }) as TrophyState, {
    name: "nookdex:trophies",
    storage: createJSONStorage(() => localStorage),
  }),
);

/** Trophies won and waiting for their toast, one batch per unlock (a big batch gets a single summary toast). */
export const useTrophyQueue = create<{ batches: string[][] }>(() => ({ batches: [] }));

/** Wins these trophies (the ones not won yet), with their toast. */
export function unlock(...ids: string[]) {
  const { got } = useTrophyStore.getState();
  const fresh = ids.filter((id) => !got[id]);
  if (!fresh.length) return;
  const now = Date.now();
  useTrophyStore.setState({ got: { ...got, ...Object.fromEntries(fresh.map((id) => [id, now])) } });
  useTrophyQueue.setState((q) => ({ batches: [...q.batches, fresh] }));
}

/** Adds to a counter, returns its new value. */
export function bump(stat: string, n = 1) {
  const stats = useTrophyStore.getState().stats;
  const v = (stats[stat] ?? 0) + n;
  useTrophyStore.setState({ stats: { ...stats, [stat]: v } });
  return v;
}

/** Trophies from a save (the cloud, an imported file): added without a toast, the earliest date kept. */
export function mergeTrophies(other: Record<string, number> | undefined) {
  if (!other) return;
  const got = { ...useTrophyStore.getState().got };
  let changed = false;
  for (const [id, at] of Object.entries(other)) {
    if (typeof at !== "number" || (got[id] && got[id] <= at)) continue;
    got[id] = at;
    changed = true;
  }
  if (changed) useTrophyStore.setState({ got });
}

/** Same trophies, whatever their dates: tells if the cloud is missing some. */
export const trophyKey = (got: Record<string, number> | undefined) => Object.keys(got ?? {}).sort().join(",");
