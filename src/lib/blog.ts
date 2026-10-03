import fs from "node:fs";
import path from "node:path";
import { Marked } from "marked";
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
}

const DIR = path.join(process.cwd(), "content", "blog");

/** The few YAML lines a post starts with: `key: value`, quoted or not, and `[a, b]` lists. */
function frontmatter(src: string) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  const data: Record<string, string | string[]> = {};
  if (!m) return { data, body: src };
  for (const line of m[1].split(/\r?\n/)) {
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

export function formatDate(date: string, lang: BlogLang) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/* ---------- cards in a post: ::card[sv08-001] on its own line ---------- */

const sets = new Map<string, SetData | null>();
/** Sub-set id (a Trainer Gallery…) -> the set file that holds it, per card language (as lib/catalog, server side) */
const OWNER = new Map<string, string>();
for (const [lang, raw] of [["fr", rawFr], ["en", rawEn], ["ja", rawJa]] as [CardLang, CatalogSet[]][])
  for (const s of raw) for (const id of [s.id, ...s.subs]) OWNER.set(`${lang}:${id}`, s.id);

/** A card of the site's data (public/sets), French by default, `en:` / `ja:` like the rest of the site. */
function findCard(key: string): CardData | null {
  const lang = langOfKey(key);
  const id = bareId(key);
  const setId = OWNER.get(`${lang}:${id.slice(0, id.lastIndexOf("-"))}`);
  if (!setId) return null;
  const file = path.join(process.cwd(), "public", "sets", ...(lang === "fr" ? [] : [lang]), `${setId}.json`);
  if (!sets.has(file)) sets.set(file, fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as SetData) : null);
  return sets.get(file)?.cards.find((c) => bareId(c.id) === id) ?? null;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function cardFigure(key: string, lang: BlogLang) {
  const card = findCard(key);
  if (!card) return "";
  const trend = card.price.trend;
  const money = trend
    ? new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: currencyOf(langOfKey(key)) }).format(trend)
    : "—";
  // English cards: the TCGplayer market price; French and Japanese ones: the Cardmarket trend
  // (an English card TCGplayer doesn't sell: Cardmarket's trend converted to dollars, flagged `cm`)
  const tcgplayer = langOfKey(key) === "en" && !card.price.cm;
  const label = tcgplayer ? (lang === "fr" ? "prix TCGplayer :" : "TCGplayer market:") : lang === "fr" ? "tendance Cardmarket :" : "Cardmarket trend:";
  const img = card.img ? `<img src="${esc(card.img)}/low.webp" alt="${esc(card.name)}" width="245" height="342" loading="lazy">` : "";
  return (
    `<figure class="blog-card">${img}<figcaption><b>${esc(card.name)}</b> · ${esc(card.num)}` +
    `${card.rarity ? ` · ${esc(card.rarity)}` : ""}<br>${label} <b>${money}</b></figcaption></figure>`
  );
}

/** The post's HTML: Markdown (the routine's own text, from this repo) with its cards drawn from the site's data. */
export function renderPost(post: Post) {
  const md = post.body.replace(/^::card\[([^\]]+)\][ \t]*$/gm, (_, key: string) => cardFigure(key.trim(), post.lang));
  return new Marked({ gfm: true }).parse(md, { async: false });
}
