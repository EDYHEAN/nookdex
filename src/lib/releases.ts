import rawEn from "@/data/catalog-en.json";
import rawFr from "@/data/catalog.json";
import rawJa from "@/data/catalog-ja.json";
import data from "@/data/releases.json";
import { type PageLang, setPagePath } from "./setPath";
import type { CatalogSet } from "./types";

/**
 * The release calendar (app/(desk)/calendrier-des-sorties, app/(desk)/en/release-calendar): what's coming, from
 * src/data/releases.json (official announcements only, kept up to date by the blog routine), and what came out this
 * past year, from the catalogs (with a link to each set's page).
 */
export interface Release {
  date: string;
  /** "intl": France and the rest of the world; "jp": Japan */
  region: "intl" | "jp";
  kind: "set" | "product" | "event";
  name: string;
  code?: string;
  note?: string;
  source?: string;
  /** the set's page on NookDex */
  href?: string | null;
  /** out already: from the catalogs */
  out?: boolean;
}

/** setId: the TCGdex id the set will have, so it shows once when it reaches the catalog */
type Item = (typeof data.items)[number] & { code?: string; setId?: string };

export function releases(lang: PageLang, today = new Date().toISOString().slice(0, 10)) {
  const fr = lang === "fr";
  const announced: Release[] = (data.items as Item[]).map((i) => ({
    date: i.date,
    region: i.region as Release["region"],
    kind: i.kind as Release["kind"],
    name: fr ? i.fr : i.en,
    code: i.code,
    note: fr ? i.noteFr : i.noteEn,
    source: i.source,
  }));
  const yearAgo = new Date(Date.parse(`${today}T12:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10);
  const recent = (sets: CatalogSet[]) => sets.filter((s) => !s.extra && s.releaseDate && s.releaseDate <= today && s.releaseDate >= yearAgo);
  const released: Release[] = [
    ...recent((fr ? rawFr : rawEn) as CatalogSet[]).map((s) => ({
      date: s.releaseDate!,
      region: "intl" as const,
      kind: "set" as const,
      name: s.name,
      code: s.code,
      href: setPagePath(lang, s.id),
      out: true,
    })),
    // Japanese sets have no page of their own (their names are Japanese)
    ...recent(rawJa as CatalogSet[]).map((s) => ({ date: s.releaseDate!, region: "jp" as const, kind: "set" as const, name: s.name, code: s.code, out: true })),
  ];
  // an announced set already in the catalog shows once, from the catalog
  const known = new Set([...rawFr, ...rawEn].map((s) => s.id));
  const all = [...released, ...announced.filter((a, i) => !(data.items[i] as Item).setId || !known.has((data.items[i] as Item).setId!))];
  return {
    upcoming: all.filter((r) => !r.out && r.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    past: all.filter((r) => r.out || (r.date < today && r.date >= yearAgo)).sort((a, b) => b.date.localeCompare(a.date)),
    updated: data.updated,
  };
}

/** Days from today to a date (0 = today) */
export const daysUntil = (date: string, today = new Date().toISOString().slice(0, 10)) =>
  Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
