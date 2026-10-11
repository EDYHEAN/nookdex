import { SUPABASE_KEY, SUPABASE_URL } from "./site";

/**
 * How many players have an account (docs/supabase.sql, function player_count: the count only, nobody's data). Players
 * without an account aren't in it. Null when it can't be read (the function not created yet, no network).
 */
export async function playerCount(): Promise<number | null> {
  try {
    // GET: a stable function, so the answer can be cached for an hour on the server
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/player_count`, {
      headers: { apikey: SUPABASE_KEY },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const n = await res.json();
    return typeof n === "number" ? n : null;
  } catch {
    return null;
  }
}

/** "100" for 100 to 109, "120" for 127 ("déjà 100 dresseurs" stays true). Null under 50 (not worth saying yet). */
export const roundPlayers = (n: number | null) => (n == null || n < 50 ? null : Math.floor(n / 10) * 10);
