"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * The Nook Survivors Pension: permanent boosts bought with what's left of a run's gold. Apart from the main store, like
 * the trophies: they ride along in the save (Backup.pension, the cloud) and never count in its fingerprint. Levels only
 * go up, so two devices merge by keeping the higher one.
 */
interface PensionState {
  /** upgrade id -> level */
  levels: Record<string, number>;
  /** the last day (UTC, YYYY-MM-DD) the daily challenge paid its bonus */
  dailyPaid: string | null;
}

export const usePension = create<PensionState>()(
  persist(() => ({ levels: {}, dailyPaid: null }) as PensionState, {
    name: "nookdex:pension",
    storage: createJSONStorage(() => localStorage),
  }),
);

export function buyLevel(id: string) {
  const levels = usePension.getState().levels;
  usePension.setState({ levels: { ...levels, [id]: (levels[id] ?? 0) + 1 } });
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

/** Same levels: tells if the cloud is behind. */
export const pensionKey = (levels: Record<string, number> | undefined) =>
  Object.entries(levels ?? {})
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}${v}`)
    .join(",");
