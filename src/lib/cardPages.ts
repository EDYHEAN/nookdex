import { formatDate } from "./blog";
import { currencyOf } from "./cardLang";
import type { IndexCard } from "./catalog";
import { publicJson, setFile } from "./setFiles";
import { money, trendOf } from "./setPages";
import { type PageLang, SET_PAGES_ROOT, setBySlug, setPagePath, slugify } from "./setPath";
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

  const hist = await publicJson<History>("history", lang, `${entry.set.id}.json`);
  const vals = hist?.cards[card.id] ?? [];
  const history = (hist?.days ?? []).map((day, k) => ({ day, v: vals[k] as number })).filter((x) => x.v != null);

  const link = (c: CardData) => ({ name: `${c.name} ${c.num}`, path: `${setPath}/${cardSlug(c)}` });
  // the same Pokémon elsewhere: by name in the search index, the most expensive first
  const index = await publicJson<{ assets: string; cards: IndexCard[] }>("sets", ...(fr ? [] : ["en"]), "index.json");
  const same = (index?.cards ?? [])
    .filter(([id, name]) => name === card.name && id !== card.id)
    .map(([, name, num, set, img, trend]) => {
      const path = cardPagePath(lang, set, { name, num });
      return path ? { name, set: setBySlugName(lang, set), num, img: img.startsWith("http") ? img : `${index!.assets}${img}`, trend: trend ?? null, path } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => (b.trend ?? -1) - (a.trend ?? -1))
    .slice(0, 8);

  // the other language: the same TCGdex id in the other catalog
  const otherLang: PageLang = fr ? "en" : "fr";
  const twin = await setFile(otherLang, entry.set.id);
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

/** Every card page of a language, for the sitemap: set by set, with the day its prices were refreshed */
export async function cardPageList(lang: PageLang, sets: { id: string; slug: string }[]) {
  const out: { url: string; lastModified?: string }[] = [];
  for (const s of sets) {
    const data = await setFile(lang, s.id);
    if (!data) continue;
    for (const c of data.cards) if (!c.unavailable) out.push({ url: `${SET_PAGES_ROOT[lang]}/${s.slug}/${cardSlug(c)}`, lastModified: data.pricesUpdated });
  }
  return out;
}

export { trendOf };
