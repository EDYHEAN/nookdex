import type { MetadataRoute } from "next";
import { cardPageList } from "@/lib/cardPages";
import { setPageEntries } from "@/lib/setPath";
import { SITE_URL } from "@/lib/site";

/**
 * The card pages (lib/cardPages), apart from the site's sitemap.xml: /cartes/sitemap/fr.xml and /cartes/sitemap/en.xml
 * (~20 000 and ~25 000 addresses, under the 50 000 a sitemap may hold), both named in robots.txt.
 */
export async function generateSitemaps() {
  return [{ id: "fr" }, { id: "en" }];
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const lang = (await props.id) === "en" ? "en" : "fr";
  const list = await cardPageList(
    lang,
    setPageEntries(lang).map((e) => ({ id: e.set.id, slug: e.slug })),
  );
  return list.map((c) => ({ url: `${SITE_URL}${c.url}`, lastModified: c.lastModified, changeFrequency: "daily" as const, priority: 0.5 }));
}
