import type { MetadataRoute } from "next";
import { CARD_SITEMAPS, cardPageList } from "@/lib/cardPages";
import { setPageEntries } from "@/lib/setPath";
import { SITE_URL } from "@/lib/site";

/**
 * The card pages (lib/cardPages), apart from the site's sitemap.xml, cut in three per language so Search Console tells
 * the indexing rate of each (2026-10-29): /cartes/sitemap/<lang>-top.xml (cards over 5 €/$), <lang>-recent.xml (sets of
 * the last 12 months) and <lang>.xml (the rest: the address the whole list had before, already submitted). All named in
 * robots.txt. A card crossing 5 € moves from one to the other with the prices: Google takes an address from any sitemap.
 */
export async function generateSitemaps() {
  return CARD_SITEMAPS.map(({ id }) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;
  const map = CARD_SITEMAPS.find((s) => s.id === id);
  // an unlisted slice answers empty: its submitted address tells Search Console those pages left the sitemaps
  if (!map?.listed) return [];
  const { lang, slice } = map;
  const list = await cardPageList(lang, setPageEntries(lang));
  return list
    .filter((c) => c.slice === slice)
    .map((c) => ({ url: `${SITE_URL}${c.url}`, lastModified: c.lastModified, changeFrequency: "daily" as const, priority: 0.5 }));
}
