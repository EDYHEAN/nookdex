// The Nook Survivors ladders: Supabase functions game_top2 and game_submit2 (docs/supabase.sql), open to everyone,
// account or not; one board per mode (classic, the daily, coop) and period (this month's season, the day, all time).
// While the v2 functions aren't there yet, the classic board falls back on the first ones.

import { supabase } from "@/lib/cloud";
import type { Mode, RunStats } from "./engine";

export interface Score {
  name: string;
  wave: number;
  kills: number;
  level: number;
  starter: number;
  seconds: number;
  created_at: string;
}

export type Period = "season" | "day" | "all";

const NAME_KEY = "nookdex:game-name";

/** the name typed last time on this device, else the profile's nickname */
export function lastName(fallback: string) {
  try {
    return localStorage.getItem(NAME_KEY) || fallback;
  } catch {
    return fallback;
  }
}

export async function topScores(mode: Mode = "classic", period: Period = "season", day?: string, limit = 20): Promise<Score[] | null> {
  const { data, error } = await supabase.rpc("game_top2", { p_mode: mode, p_period: period, p_day: day ?? null, p_limit: limit });
  if (!error) return data as Score[];
  if (mode !== "classic") return null;
  const old = await supabase.rpc("game_top", { p_limit: limit });
  return old.error ? null : (old.data as Score[]);
}

/** saves a run; its rank in its board, or null when the ladder can't be reached */
export async function submitScore(name: string, run: RunStats): Promise<number | null> {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {}
  const args = { p_name: name, p_wave: run.wave, p_kills: run.kills, p_level: run.level, p_starter: run.starter, p_seconds: run.seconds };
  const { data, error } = await supabase.rpc("game_submit2", { ...args, p_mode: run.mode, p_day: run.day ?? null });
  if (!error) return data as number;
  if (run.mode !== "classic") return null;
  const old = await supabase.rpc("game_submit", args);
  return old.error ? null : (old.data as number);
}
