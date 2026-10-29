import type { MetadataRoute } from "next";
import { allPosts, translationOf } from "@/lib/blog";
import { setLastmod } from "@/lib/cardPages";
import { pricesUpdatedOf } from "@/lib/setPages";
import { type PageLang, SET_PAGES_ROOT, setPageEntries } from "@/lib/setPath";
import { SITE_URL } from "@/lib/site";
import type { CatalogSet } from "@/lib/types";

/**
 * Set pages: each with its twin in the other language (same TCGdex id), and the last day the cards it puts forward really
 * moved (lib/cardPages setLastmod; an extra set, without a price history: no lastmod). It used to be the day of the
 * prices: every set "changed today", a lastmod Google learns to ignore.
 */
async function setPages(): Promise<MetadataRoute.Sitemap> {
  const fr = new Map(setPageEntries("fr").map((e) => [e.set.id, `${SITE_URL}${SET_PAGES_ROOT.fr}/${e.slug}`]));
  const en = new Map(setPageEntries("en").map((e) => [e.set.id, `${SITE_URL}${SET_PAGES_ROOT.en}/${e.slug}`]));
  const page = async (lang: PageLang, set: CatalogSet) => ({
    url: (lang === "fr" ? fr : en).get(set.id)!,
    lastModified: await setLastmod(lang, set),
    // prices move every day (the prices Action)
    changeFrequency: "daily" as const,
    priority: 0.7,
    alternates: fr.has(set.id) && en.has(set.id) ? { languages: { fr: fr.get(set.id)!, en: en.get(set.id)! } } : undefined,
  });
  return Promise.all((["fr", "en"] as const).flatMap((lang) => setPageEntries(lang).map((e) => page(lang, e.set))));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = allPosts();
  const pages = await setPages();
  // the home, the indexes (their most expensive cards) and the market do show today's prices: the newest refresh of a set
  const days = await Promise.all(setPageEntries("fr").map((e) => pricesUpdatedOf("fr", e.set.id)));
  const prices = days.reduce<string | undefined>((max, d) => (d && (!max || d > max) ? d : max), undefined);
  const home = { languages: { fr: SITE_URL, en: `${SITE_URL}/en` } };
  const calendar = { languages: { fr: `${SITE_URL}/calendrier-des-sorties`, en: `${SITE_URL}/en/release-calendar` } };
  const sets = { languages: { fr: `${SITE_URL}/extensions`, en: `${SITE_URL}/en/sets` } };
  const market = { languages: { fr: `${SITE_URL}/marche`, en: `${SITE_URL}/en/market` } };
  return [
    { url: SITE_URL, lastModified: prices, changeFrequency: "daily", priority: 1, alternates: home },
    { url: `${SITE_URL}/en`, lastModified: prices, changeFrequency: "daily", priority: 1, alternates: home },
    { url: `${SITE_URL}/extensions`, lastModified: prices, changeFrequency: "weekly", priority: 0.8, alternates: sets },
    { url: `${SITE_URL}/en/sets`, lastModified: prices, changeFrequency: "weekly", priority: 0.8, alternates: sets },
    ...pages,
    // the calendar moves with each announcement (the blog routine)
    { url: `${SITE_URL}/calendrier-des-sorties`, changeFrequency: "weekly", priority: 0.8, alternates: calendar },
    { url: `${SITE_URL}/en/release-calendar`, changeFrequency: "weekly", priority: 0.8, alternates: calendar },
    // the week's risers and fallers, new every day with the prices (public/market)
    { url: `${SITE_URL}/marche`, lastModified: prices, changeFrequency: "daily", priority: 0.7, alternates: market },
    { url: `${SITE_URL}/en/market`, lastModified: prices, changeFrequency: "daily", priority: 0.7, alternates: market },
    // the sealed products on amazon.fr, kept up to date with each release
    { url: `${SITE_URL}/invitations-amazon`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/a-propos`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/blog`, lastModified: posts[0]?.date, changeFrequency: "weekly", priority: 0.7 },
    ...posts.map((p) => {
      const other = translationOf(p);
      return {
        url: `${SITE_URL}/blog/${p.slug}`,
        lastModified: p.date,
        changeFrequency: "monthly" as const,
        priority: 0.6,
        alternates: other ? { languages: { [p.lang]: `${SITE_URL}/blog/${p.slug}`, [other.lang]: `${SITE_URL}/blog/${other.slug}` } } : undefined,
      };
    }),
    { url: `${SITE_URL}/confidentialite`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/conditions`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/contact`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/mentions-legales`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/conditions-de-vente`, changeFrequency: "yearly", priority: 0.1 },
  ];
}
