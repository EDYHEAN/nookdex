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
  /** the start tier's wave (game_top2 v4), 1 from the start */
  start?: number;
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

/** a board's top 50 (Johan, 2026-10-18: a top 20 left the 21st out, "where's Sophie?"), shown page by page */
export async function topScores(mode: Mode = "classic", period: Period = "season", day?: string, limit = 50): Promise<Score[] | null> {
  const { data, error } = await supabase.rpc("game_top2", { p_mode: mode, p_period: period, p_day: day ?? null, p_limit: limit });
  if (!error) return data as Score[];
  if (mode !== "classic") return null;
  const old = await supabase.rpc("game_top", { p_limit: limit });
  return old.error ? null : (old.data as Score[]);
}

/** the best run with each starter, all time (game_records, v7); null while that function isn't in Supabase yet: no tab then */
export async function starterRecords(mode: Mode = "classic"): Promise<Score[] | null> {
  const { data, error } = await supabase.rpc("game_records", { p_mode: mode });
  return error ? null : (data as Score[]);
}

/** a name in the Panthéon: its first classic run to the last wave */
export interface Legend {
  name: string;
  starter: number;
  seconds: number;
  created_at: string;
  start: number;
}
let hall: Promise<Legend[] | null> | null = null;
/**
 * The Panthéon: everyone who reached the classic's last wave, earliest first (game_hall, v7), for the crowns, its tab and
 * the Game Boy's bubble. Asked once a visit (it hardly changes), again after a run sent there; null while the function
 * isn't in Supabase yet: no crown, no tab.
 */
export function legends(fresh = false): Promise<Legend[] | null> {
  if (!hall || fresh)
    hall = (async () => {
      const { data, error } = await supabase.rpc("game_hall");
      return error ? null : (data as Legend[]);
    })().catch(() => null);
  return hall;
}

/**
 * The signed-in player's rewards (table game_rewards, docs/supabase.sql: each player reads only their own rows, given by
 * hand), e.g. "skin-mewtwo". None without an account.
 */
export async function myRewards(): Promise<string[]> {
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) return [];
  const { data, error } = await supabase.from("game_rewards").select("reward");
  return error || !data ? [] : data.map((r: { reward: string }) => r.reward);
}

/**
 * saves a run; its rank in its board, "refused" when the server finds it implausible (too quick for its waves: a run
 * jumped through in dev, or tampered with; retrying won't help), or null when the ladder can't be reached
 */
export async function submitScore(name: string, run: RunStats): Promise<number | "refused" | null> {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {}
  const args = { p_name: name, p_wave: run.wave, p_kills: run.kills, p_level: run.level, p_starter: run.starter, p_seconds: run.seconds };
  const { data, error } = await supabase.rpc("game_submit2", { ...args, p_mode: run.mode, p_day: run.day ?? null, p_start: run.start });
  if (!error) return data as number;
  if (error.message?.includes("implausible")) return "refused";
  if (run.mode !== "classic") return null;
  const old = await supabase.rpc("game_submit", args);
  return old.error ? null : (old.data as number);
}
