import rawEn from "@/data/catalog-en.json";
import rawFr from "@/data/catalog.json";
import type { CardLang } from "./cardLang";
import type { CatalogSet } from "./types";

/**
 * The public set pages (one per set, server rendered, for search engines): French cards under /extensions/<slug>, English
 * ones under /en/sets/<slug>. The slug is the set's name in its language ("tempete-argentee", "silver-tempest"), the two
 * pages of one set share its TCGdex id (hreflang). No pages for Japanese sets: their names are Japanese.
 */
export type PageLang = "fr" | "en";

export const SET_PAGES_ROOT: Record<PageLang, string> = { fr: "/extensions", en: "/en/sets" };

export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

interface Entry {
  set: CatalogSet;
  slug: string;
}

function index(sets: CatalogSet[]) {
  const bySlug = new Map<string, Entry>();
  const byId = new Map<string, Entry>();
  for (const set of sets) {
    let slug = slugify(set.name) || set.id.toLowerCase();
    // two sets with one name (never so far): the second one carries its code
    if (bySlug.has(slug)) slug = `${slug}-${slugify(set.code || set.id)}`;
    const e = { set, slug };
    bySlug.set(slug, e);
    for (const id of [set.id, ...set.subs]) byId.set(id, e);
  }
  return { bySlug, byId, all: [...bySlug.values()] };
}

const INDEX: Record<PageLang, ReturnType<typeof index>> = { fr: index(rawFr as CatalogSet[]), en: index(rawEn as CatalogSet[]) };

/** Every set with a page in a language, newest first (the catalog's order). */
export const setPageEntries = (lang: PageLang) => INDEX[lang].all;
export const setBySlug = (lang: PageLang, slug: string) => INDEX[lang].bySlug.get(slug);
/** The page of a set (a TCGdex set id, sub-sets included) in a card language; null for Japanese cards or an unknown set. */
export function setPagePath(lang: CardLang, setId: string): string | null {
  if (lang === "ja") return null;
  const e = INDEX[lang].byId.get(setId);
  return e ? `${SET_PAGES_ROOT[lang]}/${e.slug}` : null;
}
