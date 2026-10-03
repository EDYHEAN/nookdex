import fs from "node:fs";
import path from "node:path";
import { Marked, type Token } from "marked";
import rawEn from "@/data/catalog-en.json";
import rawFr from "@/data/catalog.json";
import rawJa from "@/data/catalog-ja.json";
import { bareId, currencyOf, langOfKey, type CardLang } from "./cardLang";
import type { CardData, CatalogSet, SetData } from "./types";

/**
 * The blog: Markdown files in content/blog/<fr|en>/<slug>.md, written by the scheduled Claude routine (docs/blog.md).
 * Read on the server only (pages, sitemap, feed, llms.txt); the files are traced into the build (next.config).
 */
export type BlogLang = "fr" | "en";

export interface Post {
  slug: string;
  lang: BlogLang;
  title: string;
  description: string;
  /** YYYY-MM-DD */
  date: string;
  /** shared by the French and English versions of one article */
  key: string;
  tags: string[];
  /** Markdown body */
  body: string;
  /** reading time, in minutes */
  minutes: number;
  /** the cards the post shows, in order (the first ones go on its share image) */
  cards: string[];
}

const DIR = path.join(process.cwd(), "content", "blog");
const CARD_LINE = /^::card\[([^\]]+)\][ \t]*$/gm;

/** The few YAML lines a post starts with: `key: value`, quoted or not, and `[a, b]` lists. */
function frontmatter(src: string) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  const data: Record<string, string | string[]> = {};
  if (!m) return { data, body: src };
  for (const line of m[1].split("\n")) {
    const kv = /^(\w+):\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    const raw = kv[2].trim();
    const unquote = (s: string) => s.trim().replace(/^(["'])(.*)\1$/, "$2");
    data[kv[1]] = raw.startsWith("[") ? raw.slice(1, -1).split(",").map(unquote).filter(Boolean) : unquote(raw);
  }
  return { data, body: src.slice(m[0].length) };
}

let cache: Post[] | null = null;

/** Every post, newest first. A post dated in the future waits for its day. */
export function allPosts(): Post[] {
  if (!cache || process.env.NODE_ENV !== "production") {
    const out: Post[] = [];
    for (const lang of ["fr", "en"] as const) {
      const dir = path.join(DIR, lang);
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith(".md")) continue;
        // CRLF on a Windows checkout: one kind of line end for the parsing below
        const { data, body } = frontmatter(fs.readFileSync(path.join(dir, file), "utf8").replace(/\r\n/g, "\n"));
        const str = (k: string) => (typeof data[k] === "string" ? (data[k] as string) : "");
        const slug = file.slice(0, -3);
        out.push({
          slug,
          lang,
          title: str("title") || slug,
          description: str("description"),
          date: str("date"),
          key: str("key") || slug,
          tags: Array.isArray(data.tags) ? data.tags : [],
          body,
          minutes: Math.max(1, Math.round(body.replace(CARD_LINE, "").split(/\s+/).length / 220)),
          cards: [...body.matchAll(CARD_LINE)].map((m) => m[1].trim()),
        });
      }
    }
    cache = out.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  }
  const today = new Date().toISOString().slice(0, 10);
  return cache.filter((p) => p.date <= today);
}

export const postsIn = (lang: BlogLang) => allPosts().filter((p) => p.lang === lang);
export const postBySlug = (slug: string) => allPosts().find((p) => p.slug === slug);
/** The same article in the other language, if it was written */
export const translationOf = (post: Post) => allPosts().find((p) => p.key === post.key && p.lang !== post.lang);

/** Further reading under a post: same language, the most shared tags first, then the newest. */
export function relatedPosts(post: Post, n = 3) {
  const shared = (p: Post) => p.tags.filter((t) => post.tags.includes(t)).length;
  return postsIn(post.lang)
    .filter((p) => p.key !== post.key)
    .sort((a, b) => shared(b) - shared(a) || b.date.localeCompare(a.date))
    .slice(0, n);
}

export function formatDate(date: string, lang: BlogLang) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/* ---------- cards in a post: ::card[sv08-001] on its own line ---------- */

const sets = new Map<string, SetData | null>();
/** Sub-set id (a Trainer Gallery…) -> the catalog set whose file holds it, per card language (as lib/catalog, server side) */
const OWNER = new Map<string, CatalogSet>();
for (const [lang, raw] of [["fr", rawFr], ["en", rawEn], ["ja", rawJa]] as [CardLang, CatalogSet[]][])
  for (const s of raw) for (const id of [s.id, ...s.subs]) OWNER.set(`${lang}:${id}`, s);

/** A card of the site's data (public/sets), French by default, `en:` / `ja:` like the rest of the site, with its set. */
export function findCard(key: string): { card: CardData; set: SetData; setName: string } | null {
  const lang = langOfKey(key);
  const id = bareId(key);
  const owner = OWNER.get(`${lang}:${id.slice(0, id.lastIndexOf("-"))}`);
  if (!owner) return null;
  const file = path.join(process.cwd(), "public", "sets", ...(lang === "fr" ? [] : [lang]), `${owner.id}.json`);
  if (!sets.has(file)) sets.set(file, fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as SetData) : null);
  const set = sets.get(file);
  const card = set?.cards.find((c) => bareId(c.id) === id);
  return set && card && !card.unavailable ? { card, set, setName: owner.name } : null;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const money = (n: number | null | undefined, currency: string, lang: BlogLang) =>
  n ? new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", { style: "currency", currency }).format(n) : "—";

/** What the card's price says, in the post's language: the amount, its market, its date, where it's heading, and the link to buy. */
function priceOf(key: string, card: CardData, set: SetData, lang: BlogLang) {
  const fr = lang === "fr";
  // English cards: the TCGplayer market price, unless TCGplayer doesn't sell it (`cm`: Cardmarket's, converted)
  const tcgplayer = langOfKey(key) === "en" && !card.price.cm;
  const day = new Date(set.pricesUpdated).toLocaleDateString(fr ? "fr-FR" : "en-GB", { day: "numeric", month: "short" });
  const market = tcgplayer ? "TCGplayer" : "Cardmarket";
  const p = card.price;
  // the binders' rule: last 7 days against the last 30, shown from 5 %
  const move = p.avg7 != null && p.avg30 ? (p.avg7 - p.avg30) / p.avg30 : 0;
  const arrow = move >= 0.05 ? `<i class="blog-up" title="${fr ? "en hausse sur 7 jours" : "up over 7 days"}">↗</i>` : move <= -0.05 ? `<i class="blog-down" title="${fr ? "en baisse sur 7 jours" : "down over 7 days"}">↘</i>` : "";
  const href = tcgplayer
    ? p.tp
      ? `https://www.tcgplayer.com/product/${p.tp}`
      : `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(card.name)}`
    : p.cmId
      ? `https://www.cardmarket.com/${fr ? "fr" : "en"}/Pokemon/Products?idProduct=${p.cmId}`
      : `https://www.cardmarket.com/${fr ? "fr" : "en"}/Pokemon/Products/Search?searchString=${encodeURIComponent(card.name)}`;
  return { money: money(p.trend, currencyOf(langOfKey(key)), lang), arrow, label: `${market} · ${day}`, href, market };
}

/** "234/091": the number as printed on the card */
const num = (card: CardData, set: SetData) =>
  /^\d+$/.test(card.num) && set.official ? `${card.num}/${String(set.official).padStart(card.num.length, "0")}` : card.num;
/** One card the text talks about: the scan beside its sheet (set, number, rarity, today's price, a link to its market). */
function cardFeature(key: string, lang: BlogLang) {
  const found = findCard(key);
  if (!found) return "";
  const { card, set, setName } = found;
  const fr = lang === "fr";
  const pr = priceOf(key, card, set, lang);
  const img = card.img ? `<img src="${esc(card.img)}/low.webp" alt="${esc(`${card.name} ${num(card, set)}`)}" width="245" height="342" loading="lazy">` : "";
  return (
    `<figure class="blog-card">${img}<figcaption>` +
    `<span class="blog-card-set">${esc(setName)} · ${esc(num(card, set))}</span>` +
    `<b class="blog-card-name">${esc(card.name)}</b>` +
    (card.rarity ? `<span class="blog-card-rarity">${esc(card.rarity)}</span>` : "") +
    `<span class="blog-card-price"><b>${pr.money}</b>${pr.arrow}<small>${esc(pr.label)}</small></span>` +
    // cheapest offer on the card's market, and Cardmarket's sales averages (in euros, every language mixed)
    `<dl class="blog-card-stats">` +
    `<div><dt>${fr ? "Plus bas" : "Lowest"}</dt><dd>${money(card.price.low, currencyOf(langOfKey(key)), lang)}</dd></div>` +
    `<div><dt>${fr ? "Moy. 7 j" : "7-day avg"}</dt><dd>${money(card.price.avg7, "EUR", lang)}</dd></div>` +
    `<div><dt>${fr ? "Moy. 30 j" : "30-day avg"}</dt><dd>${money(card.price.avg30, "EUR", lang)}</dd></div>` +
    `</dl>` +
    `<a href="${esc(pr.href)}" target="_blank" rel="noopener nofollow">${fr ? `Voir sur ${pr.market}` : `See on ${pr.market}`} ↗</a>` +
    `</figcaption></figure>`
  );
}

/** Several cards in a row: a small gallery, each with its name and price. */
function cardGallery(keys: string[], lang: BlogLang) {
  const items = keys.flatMap((key) => {
    const found = findCard(key);
    if (!found) return [];
    const { card, set, setName } = found;
    const pr = priceOf(key, card, set, lang);
    const img = card.img ? `<img src="${esc(card.img)}/low.webp" alt="${esc(`${card.name} ${num(card, set)}`)}" width="245" height="342" loading="lazy">` : "";
    return [
      `<a class="blog-mini" href="${esc(pr.href)}" target="_blank" rel="noopener nofollow">${img}` +
        `<b>${esc(card.name)}</b><span>${esc(setName)} · ${esc(num(card, set))}</span><span class="blog-mini-price">${pr.money}${pr.arrow}</span></a>`,
    ];
  });
  return items.length ? `<div class="blog-gallery">${items.join("")}</div>` : "";
}

/** The post's HTML: Markdown (the routine's own text, from this repo) with its cards drawn from the site's data. */
export function renderPost(post: Post) {
  // a run of ::card lines (blank lines between them allowed) is one block: a single card, or a gallery
  const md = post.body.replace(/^::card\[[^\]]+\][ \t]*(?:\n(?:[ \t]*\n)*::card\[[^\]]+\][ \t]*)*/gm, (run) => {
    const keys = [...run.matchAll(CARD_LINE)].map((m) => m[1].trim());
    return `${keys.length === 1 ? cardFeature(keys[0], post.lang) : cardGallery(keys, post.lang)}\n\n`;
  });
  const html = new Marked({ gfm: true }).parse(md, { async: false });
  // wide tables scroll sideways on a phone instead of squeezing their columns
  return html.replace(/<table>/g, '<div class="blog-table"><table>').replace(/<\/table>/g, "</table></div>");
}

/* ---------- FAQ: the "## Questions fréquentes" section, for the FAQPage structured data ---------- */

const FAQ_TITLE = /^(faq|questions fréquentes|vos questions|tes questions|frequently asked questions|your questions)\b/i;

const plain = (s: string) =>
  s
    .replace(/::card\[[^\]]+\]/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#|]/g, "")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

/** The questions of the post's FAQ section (### question, then its answer), empty when it has none. */
export function faqOf(post: Post): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  let inFaq = false;
  for (const t of new Marked().lexer(post.body) as Token[]) {
    if (t.type === "heading" && t.depth <= 2) {
      inFaq = FAQ_TITLE.test(plain(t.text));
      continue;
    }
    if (!inFaq) continue;
    if (t.type === "heading") out.push({ q: plain(t.text), a: "" });
    else if (out.length && t.type !== "space") out[out.length - 1].a = `${out[out.length - 1].a} ${plain(t.raw)}`.trim();
  }
  return out.filter((f) => f.q && f.a);
}
