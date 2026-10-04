import fs from "node:fs";
import path from "node:path";
import { allPosts, formatDate, type Post } from "./blog";
import { bareId, currencyOf, langOfKey } from "./cardLang";
import { type PageLang, SET_PAGES_ROOT, setBySlug, setPageEntries } from "./setPath";
import type { CardData, CatalogSet, SetData } from "./types";

/**
 * What a set page shows (app/(desk)/extensions, app/(desk)/en/sets): the set's cards and today's prices, read from the
 * same files as the binders (public/sets, refreshed every day by the prices Action), and a few figures drawn from them.
 */

const files = new Map<string, SetData | null>();

function setFile(lang: PageLang, id: string): SetData | null {
  const file = path.join(process.cwd(), "public", "sets", ...(lang === "fr" ? [] : [lang]), `${id}.json`);
  // read once per server instance in production: the daily prices come with a new deploy
  if (!files.has(file) || process.env.NODE_ENV !== "production")
    files.set(file, fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as SetData) : null);
  return files.get(file) ?? null;
}

/** When a set's prices were last refreshed (its page's lastmod in the sitemap); null when its file is missing. */
export const pricesUpdatedOf = (lang: PageLang, id: string) => setFile(lang, id)?.pricesUpdated ?? null;

/** A card's price on its market (trend), as the binders read it: null when the market doesn't sell it. */
export const trendOf = (card: CardData) => (card.unavailable ? null : card.price.trend || card.price.trendHolo || null);

export interface SetPage {
  lang: PageLang;
  slug: string;
  path: string;
  set: CatalogSet;
  data: SetData;
  currency: "EUR" | "USD";
  /** the same set in the other language, when we have it */
  other: { lang: PageLang; path: string; name: string } | null;
  /** priced cards, most expensive first */
  top: CardData[];
  /** one copy of every priced card, added up */
  total: number;
  priced: number;
  rarities: { rarity: string; count: number; value: number }[];
  /** the other sets of its series, for the links at the bottom */
  series: { name: string; path: string; code: string }[];
  posts: Post[];
}

export function setPage(lang: PageLang, slug: string): SetPage | null {
  const entry = setBySlug(lang, slug);
  if (!entry) return null;
  const data = setFile(lang, entry.set.id);
  if (!data || !data.cards.length) return null;
  const { set } = entry;
  const otherLang: PageLang = lang === "fr" ? "en" : "fr";
  const twin = setPageEntries(otherLang).find((e) => e.set.id === set.id);
  const priced = data.cards.filter((c) => trendOf(c) != null);
  const top = [...priced].sort((a, b) => trendOf(b)! - trendOf(a)!);
  const rarities = new Map<string, { count: number; value: number }>();
  for (const c of data.cards) {
    const r = rarities.get(c.rarity ?? "—") ?? { count: 0, value: 0 };
    r.count++;
    r.value += trendOf(c) ?? 0;
    rarities.set(c.rarity ?? "—", r);
  }
  const ids = new Set(data.cards.map((c) => c.id));
  const name = set.name.toLowerCase();
  return {
    lang,
    slug,
    path: `${SET_PAGES_ROOT[lang]}/${slug}`,
    set,
    data,
    currency: currencyOf(lang),
    other: twin ? { lang: otherLang, path: `${SET_PAGES_ROOT[otherLang]}/${twin.slug}`, name: twin.set.name } : null,
    top,
    total: priced.reduce((sum, c) => sum + trendOf(c)!, 0),
    priced: priced.length,
    // rarest last: the order the cards come in the set
    rarities: [...rarities].map(([rarity, r]) => ({ rarity, ...r })),
    series: setPageEntries(lang)
      .filter((e) => e.set.serie === set.serie && e.set.id !== set.id)
      .map((e) => ({ name: e.set.name, path: `${SET_PAGES_ROOT[lang]}/${e.slug}`, code: e.set.code })),
    // the blog posts that show one of its cards or name it
    posts: allPosts()
      .filter((p) => p.lang === lang)
      .filter((p) => p.cards.some((k) => langOfKey(k) === lang && ids.has(bareId(k))) || p.title.toLowerCase().includes(name))
      .slice(0, 4),
  };
}

/** "245 cartes" with the cards beyond the printed count (secret rares, Trainer Gallery…) told apart. */
export function cardCount(p: SetPage) {
  const n = p.data.cards.length;
  const official = p.data.official ?? n;
  return { n, official, beyond: Math.max(0, n - official) };
}

export const money = (n: number, p: Pick<SetPage, "lang" | "currency">) =>
  new Intl.NumberFormat(p.lang === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: p.currency }).format(n);

/** The page's questions: shown at the bottom and given to search engines (FAQPage). Built from the set's own figures. */
export function setFaq(p: SetPage): { q: string; a: string }[] {
  const fr = p.lang === "fr";
  const { n, official, beyond } = cardCount(p);
  const name = p.set.name;
  const best = p.top[0];
  const day = formatDate(p.data.pricesUpdated.slice(0, 10), p.lang);
  const market = fr ? "Cardmarket" : "TCGplayer";
  const out: { q: string; a: string }[] = [];
  out.push(
    fr
      ? {
          q: `Combien de cartes compte ${name} ?`,
          a: beyond
            ? `${name} compte ${n} cartes : ${official} numérotées sur la liste officielle et ${beyond} au-delà (cartes secrètes et séries spéciales).`
            : `${name} compte ${n} cartes.`,
        }
      : {
          q: `How many cards are in ${name}?`,
          a: beyond
            ? `${name} has ${n} cards: ${official} in the official numbering and ${beyond} beyond it (secret rares and special sub-sets).`
            : `${name} has ${n} cards.`,
        },
  );
  if (best)
    out.push(
      fr
        ? {
            q: `Quelle est la carte la plus chère de ${name} ?`,
            a: `Au ${day}, c'est ${best.name} (${best.num}), à ${money(trendOf(best)!, p)} (prix tendance ${market}).`,
          }
        : {
            q: `What is the most expensive card in ${name}?`,
            a: `As of ${day}, it's ${best.name} (${best.num}), at ${money(trendOf(best)!, p)} (${market} market price).`,
          },
    );
  if (p.priced)
    out.push(
      fr
        ? {
            q: `Combien coûte le set complet de ${name} ?`,
            a: `Une carte de chaque, au prix tendance ${market} du ${day}, revient à environ ${money(p.total, p)} (${p.priced} cartes cotées sur ${n}, sans les variantes reverse).`,
          }
        : {
            q: `How much is a complete ${name} set worth?`,
            a: `One of each card, at ${market} market prices on ${day}, comes to about ${money(p.total, p)} (${p.priced} priced cards out of ${n}, reverse holos not counted).`,
          },
    );
  if (p.set.releaseDate)
    out.push(
      fr
        ? { q: `Quand est sortie ${name} ?`, a: `${name} (${p.set.code}) est sortie le ${formatDate(p.set.releaseDate, "fr")}, dans la série ${p.set.serieName}.` }
        : { q: `When was ${name} released?`, a: `${name} (${p.set.code}) was released on ${formatDate(p.set.releaseDate, "en")}, in the ${p.set.serieName} series.` },
    );
  return out;
}
