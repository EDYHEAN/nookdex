// The NookBoy's ladder: Supabase functions game_top and game_submit (docs/supabase.sql), open to everyone, account or not.

import { supabase } from "@/lib/cloud";
import type { RunStats } from "./engine";

export interface Score {
  name: string;
  wave: number;
  kills: number;
  level: number;
  starter: number;
  seconds: number;
  created_at: string;
}

const NAME_KEY = "nookdex:game-name";

/** the name typed last time on this device, else the profile's nickname */
export function lastName(fallback: string) {
  try {
    return localStorage.getItem(NAME_KEY) || fallback;
  } catch {
    return fallback;
  }
}

export async function topScores(limit = 20): Promise<Score[] | null> {
  const { data, error } = await supabase.rpc("game_top", { p_limit: limit });
  if (error) return null;
  return data as Score[];
}

/** saves a run; its rank among the other players' best runs, or null when the ladder can't be reached */
export async function submitScore(name: string, run: RunStats): Promise<number | null> {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {}
  const { data, error } = await supabase.rpc("game_submit", {
    p_name: name,
    p_wave: run.wave,
    p_kills: run.kills,
    p_level: run.level,
    p_starter: run.starter,
    p_seconds: run.seconds,
  });
  if (error) return null;
  return data as number;
}
