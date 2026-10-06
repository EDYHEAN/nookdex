import { type CardLang, langOfKey } from "./cardLang";
import { type IndexCard, catalogSet, setIdOfCard } from "./catalog";
import { type RarityTier, rankOf, tierOf } from "./rarity";
import type { CatalogSet } from "./types";

/** Lower case, no accents: "Évoli" is found by "evoli". */
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A card of the search index, read once: what the searches filter, sort and draw. */
export interface Row {
  key: string;
  name: string;
  num: string;
  img: string;
  /** Trend on the card's own market, in its currency (euros, or dollars for English cards); null = not for sale */
  trend: number | null;
  rarity: string | null;
  /** lib/rarity's rank (-1: promo, no rarity), and its tier */
  rank: number;
  tier: RarityTier;
  /** Japanese cards: their Pokémon's French and English names */
  aka?: string;
  lang: CardLang;
  /** The set whose binder holds the card (its sub-sets, like a Trainer Gallery, go in it) */
  set: CatalogSet | undefined;
  /** Release date of that set, "" when unknown */
  date: string;
  /** For the matcher: name and aka, number without leading zeros, set code and name */
  text: string;
  bareNum: string;
  code: string;
  setName: string;
}

const prepared = new WeakMap<IndexCard[], Row[]>();

/** The rows of a loaded index, normalised once (not on every keystroke). */
export function rowsOf(index: IndexCard[]): Row[] {
  let rows = prepared.get(index);
  if (rows) return rows;
  rows = index.map(([key, name, num, , img, trend, rarity, aka]) => {
    const set = catalogSet(setIdOfCard(key) ?? "");
    const lowNum = num.toLowerCase();
    const rank = rankOf(rarity);
    return {
      key,
      name,
      num,
      img,
      trend,
      rarity,
      rank,
      tier: tierOf(rank),
      aka,
      lang: langOfKey(key),
      set,
      date: set?.releaseDate ?? "",
      text: aka ? `${norm(name)} ${norm(aka)}` : norm(name),
      bareNum: lowNum.replace(/^([a-z]*)0+(?=\d)/, "$1"),
      code: norm(set?.code ?? ""),
      setName: norm(set?.name ?? ""),
    };
  });
  prepared.set(index, rows);
  return rows;
}

/** "dracaufeu ev3.5", "lugia 186", "eb12 tg": every word must hit the name, the number or the set. Null for no words. */
export function matcher(q: string): ((r: Row) => boolean) | null {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  return (r) =>
    words.every((w) => {
      const n = w.replace(/^0+(?=\d)/, "");
      return r.text.includes(w) || r.bareNum === n || r.num.toLowerCase() === w || r.code === w || (w.length > 3 && r.setName.includes(w));
    });
}

/** How well a row's name answers the search: 0 = the name itself, 1 = starts with it, 2 = a word starts with it, 3 = elsewhere. */
export function relevance(r: Row, q: string): number {
  const nq = norm(q.trim());
  const name = norm(r.name);
  if (name === nq) return 0;
  if (name.startsWith(nq)) return 1;
  if (r.text.split(/[\s\-·]+/).some((w) => w.startsWith(nq))) return 2;
  return 3;
}

/** The first `limit` rows matching a search, in index order (newest sets first). */
export function searchRows(rows: Row[], q: string, limit: number): Row[] {
  const match = matcher(q);
  if (!match) return [];
  const out: Row[] = [];
  for (const r of rows) {
    if (!match(r)) continue;
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

/** A card number in reading order: "TG05" after "TG4", "SV107" after "SV12". */
export const compareNum = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
