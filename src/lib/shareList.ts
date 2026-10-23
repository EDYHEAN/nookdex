import fs from "node:fs/promises";
import path from "node:path";
import rawEn from "@/data/catalog-en.json";
import rawFr from "@/data/catalog.json";
import rawJa from "@/data/catalog-ja.json";
import { type CardLang, bareId, langOfKey } from "./cardLang";
import { rarityRank } from "./rarity";
import { setFile } from "./setFiles";
import { SUPABASE_KEY, SUPABASE_URL } from "./site";
import type { CardData, CatalogSet, Variant } from "./types";

/**
 * A player's public list on the server (/c/<slug>, its share picture): the row Supabase keeps (share_get, card ids only),
 * and those ids made into cards from the sets' files, with the day's prices. lib/share writes it.
 */

export interface ShareRow {
  name: string;
  lang: "fr" | "en";
  prices: boolean;
  data: { v: 1; want: string[]; give: [string, Variant, number][] };
  updated_at: string;
}

const SLUG = /^[a-z0-9]{8}$/;

export async function getShare(slug: string, view = false): Promise<ShareRow | null> {
  if (!SLUG.test(slug)) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/share_get`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: slug, p_view: view }),
      // a list changes with each tick of its owner: never kept
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) return (((await r.json()) as ShareRow[])[0] ?? null) || null;
    // dev, before share_get exists in Supabase: the lists /api/share-dev keeps
    if (process.env.NODE_ENV !== "production" && r.status === 404) return devShare(slug);
    return null;
  } catch {
    return process.env.NODE_ENV !== "production" ? devShare(slug) : null;
  }
}

async function devShare(slug: string): Promise<ShareRow | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), ".cache", "share-dev", `${slug}.json`), "utf8")) as ShareRow;
  } catch {
    return null;
  }
}

/** A card of the list, ready to draw */
export interface ListCard {
  key: string;
  name: string;
  /** "045/191", or the card's own number */
  num: string;
  img: string | null;
  lang: CardLang;
  setKey: string;
  setName: string;
  logo: string | null;
  /** the set's release, for the order of the sets (newest first) */
  released: string;
  variant: Variant | null;
  /** copies offered (J'échange) */
  n: number;
  /** the day's trend on the card's market, in its currency; null: not priced (shown "—") */
  price: number | null;
  currency: "EUR" | "USD";
  rank: number;
}

const CATALOGS: Record<CardLang, CatalogSet[]> = { fr: rawFr as CatalogSet[], en: rawEn as CatalogSet[], ja: rawJa as CatalogSet[] };
/** "en:swsh12tg" -> the catalog set whose file holds it */
const OWNER = new Map<string, CatalogSet>();
for (const lang of Object.keys(CATALOGS) as CardLang[]) for (const s of CATALOGS[lang]) for (const id of [s.id, ...s.subs]) OWNER.set(`${lang}:${id}`, s);

/**
 * The price of a version on the card's market: lib/price's marketPrice rule (Cardmarket and TCGplayer list reverse holos,
 * and the holo of a card that also comes plain, as the product's "holo"). That module reads the player's store: not here.
 */
function trendOf(card: CardData, variant: Variant) {
  const p = card.price;
  if (variant === "reverse" || (variant === "holo" && card.variants.includes("normal"))) {
    if (p.trendHolo) return p.trendHolo;
  }
  return p.trend ?? null;
}

/** The list's cards, found in the sets' files (a card the files no longer have is left out). */
export async function resolveCards(items: { key: string; variant: Variant | null; n: number }[]): Promise<ListCard[]> {
  const out: ListCard[] = [];
  // one read per set, every card of the list from it
  const bySet = new Map<string, { owner: CatalogSet; lang: CardLang; items: typeof items }>();
  for (const it of items) {
    if (typeof it.key !== "string") continue;
    const lang = langOfKey(it.key);
    const id = bareId(it.key);
    const owner = OWNER.get(`${lang}:${id.slice(0, id.lastIndexOf("-"))}`);
    if (!owner) continue;
    const k = `${lang}:${owner.id}`;
    if (!bySet.has(k)) bySet.set(k, { owner, lang, items: [] });
    bySet.get(k)!.items.push(it);
  }
  await Promise.all(
    [...bySet.values()].map(async ({ owner, lang, items: wanted }) => {
      const set = await setFile(lang, owner.id);
      if (!set) return;
      const cards = new Map(set.cards.map((c) => [bareId(c.id), c]));
      for (const it of wanted) {
        const card = cards.get(bareId(it.key));
        if (!card) continue;
        const variant = it.variant ?? null;
        out.push({
          key: it.key,
          name: card.name,
          num: /^\d+$/.test(card.num) && set.official ? `${card.num}/${set.official}` : card.num,
          img: card.img && !card.unavailable ? card.img : null,
          lang,
          setKey: lang === "fr" ? owner.id : `${lang}:${owner.id}`,
          setName: owner.name,
          logo: owner.logo ?? null,
          released: owner.releaseDate ?? "",
          variant,
          n: Math.max(1, Math.min(99, Math.round(it.n) || 1)),
          price: trendOf(card, variant ?? card.variants[0] ?? "normal"),
          // English files are in dollars (TCGplayer, or Cardmarket converted), the others in euros
          currency: set.currency === "USD" ? "USD" : "EUR",
          rank: rarityRank(card),
        });
      }
    }),
  );
  return out;
}

/**
 * The order a trader reads in (Johan's call, 2026-10-23): by set, the newest first, and in a set the cards that matter
 * first (price, then rarity, then number). A set binder just started lists 180 commons it lacks: put first, they'd hide
 * the three hits worth a trade; the page folds each set after its first few.
 */
export function sortList(cards: ListCard[]) {
  const num = (c: ListCard) => parseInt(c.num, 10) || 0;
  return [...cards].sort(
    (a, b) =>
      b.released.localeCompare(a.released) ||
      a.setKey.localeCompare(b.setKey) ||
      (b.price ?? -1) - (a.price ?? -1) ||
      b.rank - a.rank ||
      num(a) - num(b),
  );
}
