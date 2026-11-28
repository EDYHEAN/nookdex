import { formatDate } from "./blog";
import { currencyOf } from "./cardLang";
import type { IndexCard } from "./catalog";
import { publicJson, setFile } from "./setFiles";
import { money, trendOf } from "./setPages";
import { type PageLang, SET_PAGES_ROOT, setBySlug, setEntryOf, setPageEntries, setPagePath, slugify } from "./setPath";
import type { CardData, CatalogSet, SetData } from "./types";

/**
 * One page per card (Johan, 2026-10-17: what people search is a card's price, « dracaufeu ex 234 prix »), under its
 * set's page: /extensions/<set>/<card> (French cards, Cardmarket €), /en/sets/<set>/<card> (English ones, TCGplayer $).
 * Rendered on the first visit and kept a day (app/(desk)/…/[card]/page.tsx): 40 000 of them can't all be built.
 */

/** "dracaufeu-ex-234", "pikachu-tg05" */
export const cardSlug = (c: Pick<CardData, "name" | "num">) => slugify(`${c.name} ${c.num}`) || slugify(c.num);

/** The page of a card (its TCGdex id, its set's id), or null (a Japanese card, an unknown set) */
export function cardPagePath(lang: PageLang, setId: string, card: Pick<CardData, "name" | "num">) {
  const set = setPagePath(lang, setId);
  return set ? `${set}/${cardSlug(card)}` : null;
}

/** public/history/<lang>/<set>.json (scripts/price-history.mjs): one column a day, null for a day without a price */
interface History {
  days: string[];
  cards: Record<string, (number | null)[]>;
}

export interface CardPage {
  lang: PageLang;
  path: string;
  setPath: string;
  set: CatalogSet;
  data: SetData;
  card: CardData;
  currency: "EUR" | "USD";
  /** "234/091" */
  printed: string;
  /** the plain and the reverse/holo prices, as the binders read them */
  /** avg: the day's trend was a glitch, this is the card's sales average (fetch-set's saneTrend) */
  prices: { label: string; trend: number | null; low: number | null; avg?: boolean }[];
  /** the last week's average against the last month's (%), when both are known and it moved */
  move: number | null;
  /** its trend day by day (public/history, since 2026-10-04) */
  history: { day: string; v: number }[];
  /** the cards before and after it in its set */
  prev: { name: string; path: string } | null;
  next: { name: string; path: string } | null;
  /** the same Pokémon (same name) in the other sets */
  same: { name: string; set: string; num: string; img: string; trend: number | null; path: string }[];
  /** the same card in the other language, when we have it */
  other: { lang: PageLang; path: string } | null;
}

export async function cardPage(lang: PageLang, setSlug: string, slug: string): Promise<CardPage | null> {
  const entry = setBySlug(lang, setSlug);
  if (!entry) return null;
  const data = await setFile(lang, entry.set.id);
  const i = data?.cards.findIndex((c) => cardSlug(c) === slug) ?? -1;
  if (!data || i < 0) return null;
  const card = data.cards[i];
  const setPath = `${SET_PAGES_ROOT[lang]}/${setSlug}`;
  const fr = lang === "fr";
  const p = card.price;
  const plain = card.variants.includes("normal");
  const prices = card.unavailable
    ? []
    : [
        { label: plain ? (fr ? "Normale" : "Normal") : fr ? "Holo" : "Holo", trend: p.trend, low: p.low, avg: p.trendRaw != null && p.trend != null },
        ...(plain && (p.trendHolo || p.lowHolo)
          ? [{ label: card.variants.includes("holo") ? "Holo / reverse" : "Reverse", trend: p.trendHolo, low: p.lowHolo, avg: p.trendHoloRaw != null && p.trendHolo != null }]
          : []),
      ].filter((x) => x.trend != null || x.low != null);
  const move = p.avg7 && p.avg30 && Math.abs(p.avg7 / p.avg30 - 1) >= 0.05 ? (p.avg7 / p.avg30 - 1) * 100 : null;

  const hist = await historyOf(lang, entry.set);
  const vals = hist?.cards[card.id] ?? [];
  const history = (hist?.days ?? []).map((day, k) => ({ day, v: vals[k] as number })).filter((x) => x.v != null);

  const link = (c: CardData) => ({ name: `${c.name} ${c.num}`, path: `${setPath}/${cardSlug(c)}` });
  // the same Pokémon elsewhere: by name in the search index, the most expensive first
  const index = await publicJson<{ assets: string; cards: IndexCard[] }>("sets", ...(fr ? [] : ["en"]), "index.json");
  const same = (index?.cards ?? [])
    .filter(([id, name, , , img]) => name === card.name && id !== card.id && !!img)
    .map(([, name, num, set, img, trend]) => {
      const path = cardPagePath(lang, set, { name, num });
      return path ? { name, set: setBySlugName(lang, set), num, img: img.startsWith("http") ? img : `${index!.assets}${img}`, trend: trend ?? null, path } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => (b.trend ?? -1) - (a.trend ?? -1))
    .slice(0, 8);

  // the other language: the same TCGdex id in the other catalog (not fetched when that catalog hasn't the set: a 404 each time)
  const otherLang: PageLang = fr ? "en" : "fr";
  const twin = setEntryOf(otherLang, entry.set.id) ? await setFile(otherLang, entry.set.id) : null;
  const twinCard = twin?.cards.find((c) => c.id === card.id);
  const otherPath = twinCard ? cardPagePath(otherLang, entry.set.id, twinCard) : null;

  return {
    lang,
    path: `${setPath}/${slug}`,
    setPath,
    set: entry.set,
    data,
    card,
    currency: currencyOf(lang),
    printed: /^\d+$/.test(card.num) && data.official ? `${card.num}/${String(data.official).padStart(card.num.length, "0")}` : card.num,
    prices,
    move,
    history,
    prev: i > 0 ? link(data.cards[i - 1]) : null,
    next: i < data.cards.length - 1 ? link(data.cards[i + 1]) : null,
    same,
    other: otherPath ? { lang: otherLang, path: otherPath } : null,
  };
}

const setBySlugName = (lang: PageLang, setId: string) => {
  const path = setPagePath(lang, setId);
  return path ? (setBySlug(lang, path.split("/").pop()!)?.set.name ?? setId) : setId;
};

export interface TopCard {
  name: string;
  num: string;
  set: string;
  trend: number;
  path: string;
}

/**
 * The cards the set indexes (/extensions, /en/sets) link to straight away (2026-10-29): Google finds card pages by their
 * links (Noctali H29 was found through its set's page, the 151's Dracaufeu ex 199 was still "unknown to Google"), and an
 * index is one click from the home. The most expensive cards overall, then those of the two latest series (Mega
 * Evolution, Scarlet & Violet: the chase cards people search, which the vintage ones would crowd out), a few per set so
 * more sets get a door. From the search index (one file per language, already read by the card pages on this server).
 */
export async function topCards(lang: PageLang): Promise<{ all: TopCard[]; recent: TopCard[]; series: string[] }> {
  const index = await publicJson<{ cards: IndexCard[] }>("sets", ...(lang === "fr" ? [] : ["en"]), "index.json");
  // the catalog is newest first: its first two series
  const latest = [...new Map(setPageEntries(lang).map((e) => [e.set.serie, e.set.serieName]))].slice(0, 2);
  const cards: (TopCard & { slug: string; recent: boolean })[] = [];
  for (const [, name, num, setId, , trend] of index?.cards ?? []) {
    const entry = trend ? setEntryOf(lang, setId) : undefined;
    if (!entry) continue;
    const slug = `${SET_PAGES_ROOT[lang]}/${entry.slug}`;
    const recent = latest.some(([serie]) => serie === entry.set.serie);
    cards.push({ name, num, set: entry.set.name, trend: trend!, path: `${slug}/${cardSlug({ name, num })}`, slug, recent });
  }
  cards.sort((a, b) => b.trend - a.trend);
  const seen = new Set<string>();
  const pick = (list: typeof cards, n: number, perSet: number) => {
    const bySet = new Map<string, number>();
    const out: TopCard[] = [];
    for (const c of list) {
      if (out.length >= n) break;
      if (seen.has(c.path) || (bySet.get(c.slug) ?? 0) >= perSet) continue;
      seen.add(c.path);
      bySet.set(c.slug, (bySet.get(c.slug) ?? 0) + 1);
      out.push({ name: c.name, num: c.num, set: c.set, trend: c.trend, path: c.path });
    }
    return out;
  };
  const all = pick(cards, 25, 2);
  return { all, recent: pick(cards.filter((c) => c.recent), 25, 3), series: latest.map(([, name]) => name) };
}

/** The page's questions (FAQPage), from its own figures */
export function cardFaq(p: CardPage): { q: string; a: string }[] {
  const fr = p.lang === "fr";
  const name = `${p.card.name} ${p.printed}`;
  const set = p.set.name;
  const day = formatDate(p.data.pricesUpdated.slice(0, 10), p.lang);
  const market = fr ? "Cardmarket" : "TCGplayer";
  const m = (n: number) => money(n, p);
  const out: { q: string; a: string }[] = [];
  const main = p.prices[0];
  if (main?.trend != null)
    out.push(
      fr
        ? { q: `Combien vaut ${name} (${set}) ?`, a: `Au ${day}, ${name} vaut ${m(main.trend)} (${main.avg ? `moyenne des ventes ${market} sur 7 jours` : `prix tendance ${market}`}${main.low != null ? `, à partir de ${m(main.low)}` : ""}).` }
        : { q: `How much is ${name} (${set}) worth?`, a: `As of ${day}, ${name} is worth ${m(main.trend)} (${main.avg ? `${market} 7-day sales average` : `${market} market price`}${main.low != null ? `, from ${m(main.low)}` : ""}).` },
    );
  const rev = p.prices[1];
  if (rev?.trend != null)
    out.push(
      fr
        ? { q: `Quel est le prix de ${p.card.name} en ${rev.label.toLowerCase()} ?`, a: `En ${rev.label.toLowerCase()}, ${name} vaut ${m(rev.trend)} au ${day}.` }
        : { q: `What is the ${rev.label.toLowerCase()} ${p.card.name} worth?`, a: `The ${rev.label.toLowerCase()} ${name} is worth ${m(rev.trend)} as of ${day}.` },
    );
  if (p.history.length >= 7) {
    const [a, b] = [p.history[0], p.history.at(-1)!];
    const chg = Math.round((b.v / a.v - 1) * 100);
    out.push(
      fr
        ? { q: `La cote de ${p.card.name} monte-t-elle ?`, a: `Depuis le ${formatDate(a.day, "fr")}, elle est passée de ${m(a.v)} à ${m(b.v)} (${chg >= 0 ? "+" : ""}${chg} %).` }
        : { q: `Is ${p.card.name}'s price going up?`, a: `Since ${formatDate(a.day, "en")}, it went from ${m(a.v)} to ${m(b.v)} (${chg >= 0 ? "+" : ""}${chg}%).` },
    );
  }
  out.push(
    fr
      ? { q: `Dans quelle extension trouver ${p.card.name} ${p.printed} ?`, a: `Dans ${set} (${p.set.code})${p.set.releaseDate ? `, sortie le ${formatDate(p.set.releaseDate, "fr")}` : ""}${p.card.rarity ? `, en rareté ${p.card.rarity}` : ""}.` }
      : { q: `Which set is ${p.card.name} ${p.printed} from?`, a: `${set} (${p.set.code})${p.set.releaseDate ? `, released ${formatDate(p.set.releaseDate, "en")}` : ""}${p.card.rarity ? `, ${p.card.rarity}` : ""}.` },
  );
  return out;
}

/**
 * A card page's lastmod in the sitemap (2026-10-29): the last day its price really moved, more than 10 % (and 0.10 €/$:
 * a common at 0,04 € that reads 0,05 € moved 25 % and nothing that matters) from the price before it. Every card used to
 * say "today", the day of the prices, and Google ignores a lastmod that is always today. No move: the first day it had a
 * price (the history's start, 2026-10-04, or the day its set came in), else the file's first day.
 */
const MOVE = 0.1;
const MOVE_FLOOR = 0.1;
export function lastMoveOf(hist: History, cardId: string): string {
  const row = hist.cards[cardId] ?? [];
  let prev: number | null = null;
  let first: string | null = null;
  let moved: string | null = null;
  for (let i = 0; i < row.length; i++) {
    const v = row[i];
    // a hole (no price, or a glitch price-history left out) is skipped: the move is measured from the last real price
    if (v == null) continue;
    first ??= hist.days[i];
    if (prev != null && Math.abs(v / prev - 1) > MOVE && Math.abs(v - prev) >= MOVE_FLOOR) moved = hist.days[i];
    prev = v;
  }
  return moved ?? first ?? hist.days[0];
}

/** A set's price history, for the binder sets only (price-history.mjs skips the extra ones: no file to look for) */
const historyOf = (lang: PageLang, set: CatalogSet) => (set.extra ? Promise.resolve(null) : publicJson<History>("history", lang, `${set.id}.json`));

/** A set page's lastmod: the last real move of the cards it puts forward (its 8 most expensive, the gallery) */
export async function setLastmod(lang: PageLang, set: CatalogSet): Promise<string | undefined> {
  const [data, hist] = await Promise.all([setFile(lang, set.id), historyOf(lang, set)]);
  if (!data || !hist?.days.length) return undefined;
  const top = data.cards
    .filter((c) => trendOf(c) != null)
    .sort((a, b) => trendOf(b)! - trendOf(a)!)
    .slice(0, 8);
  return top.reduce((max, c) => {
    const d = lastMoveOf(hist, c.id);
    return d > max ? d : max;
  }, hist.days[0]);
}

/** The card sitemap's slices (app/cartes/sitemap.ts), so Search Console tells the indexing rate of each */
export type CardSlice = "top" | "recent" | "rest";
/**
 * Which card pages ask to be indexed (2026-11-28). From 2026-11-08 Google dropped every page of the site but the home
 * ("crawled, not indexed", no manual action): ~45,000 pages from one template read as scaled content. The cards people
 * search a price for are the dear ones, and a new set's: those stay in the sitemaps and indexable (~2,500 pages); the
 * others answer noindex (follow) and leave the sitemaps. They stay on the site, linked from their set's page.
 */
/** a card worth this much (€ or $) or more: "top" */
const TOP_PRICE = 50;
/** a set released less than this many days ago: its cards from RECENT_PRICE up are "recent" */
const RECENT_DAYS = 120;
const RECENT_PRICE = 5;

export function cardSliceOf(card: CardData, set: Pick<CatalogSet, "releaseDate">): CardSlice {
  const trend = trendOf(card) ?? 0;
  if (trend >= TOP_PRICE) return "top";
  const recentFrom = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString().slice(0, 10);
  return !!set.releaseDate && set.releaseDate >= recentFrom && trend >= RECENT_PRICE ? "recent" : "rest";
}

/**
 * The card sitemaps, /cartes/sitemap/<id>.xml: "fr" and "en" had the rest (the addresses first submitted). Since
 * 2026-11-15 they're served empty and left out of robots.txt (`listed: false`), and since 2026-11-28 taken out of Search
 * Console: only the indexable slices are listed (cardSliceOf).
 */
export const CARD_SITEMAPS: { id: string; lang: PageLang; slice: CardSlice; listed: boolean }[] = [
  { id: "fr-top", lang: "fr", slice: "top", listed: true },
  { id: "fr-recent", lang: "fr", slice: "recent", listed: true },
  { id: "fr", lang: "fr", slice: "rest", listed: false },
  { id: "en-top", lang: "en", slice: "top", listed: true },
  { id: "en-recent", lang: "en", slice: "recent", listed: true },
  { id: "en", lang: "en", slice: "rest", listed: false },
];

/** Every card page of a language, for the sitemap: set by set, with its lastmod (lastMoveOf) and its slice */
export async function cardPageList(lang: PageLang, sets: { set: CatalogSet; slug: string }[]) {
  const out: { url: string; lastModified?: string; slice: CardSlice }[] = [];
  for (const { set, slug } of sets) {
    const [data, hist] = await Promise.all([setFile(lang, set.id), historyOf(lang, set)]);
    if (!data) continue;
    for (const c of data.cards) {
      if (c.unavailable) continue;
      const slice = cardSliceOf(c, set);
      // no history (an extra set): no lastmod rather than a made-up one
      const lastModified = hist?.days.length ? lastMoveOf(hist, c.id) : undefined;
      out.push({ url: `${SET_PAGES_ROOT[lang]}/${slug}/${cardSlug(c)}`, lastModified, slice });
    }
  }
  return out;
}

export { trendOf };

export interface SetMove {
  card: CardData;
  from: number;
  to: number;
  /** % */
  change: number;
}

/**
 * What moved in a set over the last month, from our own daily history (public/history, since 2026-10-04): its "one of
 * each" value then and now, its biggest risers and fallers. Figures no other page has (2026-11-28: Google had dropped the
 * set pages as templated; this is the part only we can write). From the set's first day of prices when it's younger than
 * that. Cards under 1 €/$ then are left out of the lists (a 0.10 → 0.30 card is noise), moves under 10 % too.
 */
export async function setMoves(lang: PageLang, set: CatalogSet, data: SetData): Promise<{
  from: string;
  to: string;
  totalFrom: number;
  totalTo: number;
  up: SetMove[];
  down: SetMove[];
} | null> {
  const hist = await historyOf(lang, set);
  if (!hist || hist.days.length < 8) return null;
  const last = hist.days.length - 1;
  const monthAgo = new Date(Date.parse(hist.days[last]) - 30 * 86_400_000).toISOString().slice(0, 10);
  const first = Math.max(0, hist.days.findIndex((d) => d >= monthAgo));
  let totalFrom = 0;
  let totalTo = 0;
  const moves: SetMove[] = [];
  for (const card of data.cards) {
    const vals = hist.cards[card.id];
    if (!vals) continue;
    // a card's first and last known prices within the window (a day can be missing)
    const k0 = vals.findIndex((v, k) => k >= first && v != null);
    let k1 = last;
    while (k1 > k0 && vals[k1] == null) k1--;
    if (k0 < 0 || k1 <= k0) continue;
    const from = vals[k0]!;
    const to = vals[k1]!;
    totalFrom += from;
    totalTo += to;
    if (from >= 1) moves.push({ card, from, to, change: (to / from - 1) * 100 });
  }
  if (!totalFrom) return null;
  const byChange = moves.filter((m) => Math.abs(m.change) >= 10).sort((a, b) => b.change - a.change);
  return {
    from: hist.days[first],
    to: hist.days[last],
    totalFrom,
    totalTo,
    up: byChange.filter((m) => m.change > 0).slice(0, 4),
    down: byChange.filter((m) => m.change < 0).reverse().slice(0, 4),
  };
}
