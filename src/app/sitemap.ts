import type { MetadataRoute } from "next";
import { allPosts, translationOf } from "@/lib/blog";
import { pricesUpdatedOf } from "@/lib/setPages";
import { SET_PAGES_ROOT, setPageEntries } from "@/lib/setPath";
import { SITE_URL } from "@/lib/site";

/** Set pages: each with its twin in the other language (same TCGdex id), and the day its prices were last refreshed. */
function setPages(): MetadataRoute.Sitemap {
  const fr = new Map(setPageEntries("fr").map((e) => [e.set.id, `${SITE_URL}${SET_PAGES_ROOT.fr}/${e.slug}`]));
  const en = new Map(setPageEntries("en").map((e) => [e.set.id, `${SITE_URL}${SET_PAGES_ROOT.en}/${e.slug}`]));
  const page = (lang: "fr" | "en", id: string, url: string) => ({
    url,
    lastModified: pricesUpdatedOf(lang, id) ?? undefined,
    // prices move every day (the prices Action)
    changeFrequency: "daily" as const,
    priority: 0.7,
    alternates: fr.has(id) && en.has(id) ? { languages: { fr: fr.get(id)!, en: en.get(id)! } } : undefined,
  });
  return [...[...fr].map(([id, url]) => page("fr", id, url)), ...[...en].map(([id, url]) => page("en", id, url))];
}

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = allPosts();
  const pages = setPages();
  // the home and the indexes show today's prices too: the newest refresh of any set
  const prices = pages.reduce<string | undefined>((max, p) => (typeof p.lastModified === "string" && (!max || p.lastModified > max) ? p.lastModified : max), undefined);
  const home = { languages: { fr: SITE_URL, en: `${SITE_URL}/en` } };
  const calendar = { languages: { fr: `${SITE_URL}/calendrier-des-sorties`, en: `${SITE_URL}/en/release-calendar` } };
  const sets = { languages: { fr: `${SITE_URL}/extensions`, en: `${SITE_URL}/en/sets` } };
  return [
    { url: SITE_URL, lastModified: prices, changeFrequency: "daily", priority: 1, alternates: home },
    { url: `${SITE_URL}/en`, lastModified: prices, changeFrequency: "daily", priority: 1, alternates: home },
    { url: `${SITE_URL}/extensions`, lastModified: prices, changeFrequency: "weekly", priority: 0.8, alternates: sets },
    { url: `${SITE_URL}/en/sets`, lastModified: prices, changeFrequency: "weekly", priority: 0.8, alternates: sets },
    ...pages,
    // the calendar moves with each announcement (the blog routine)
    { url: `${SITE_URL}/calendrier-des-sorties`, changeFrequency: "weekly", priority: 0.8, alternates: calendar },
    { url: `${SITE_URL}/en/release-calendar`, changeFrequency: "weekly", priority: 0.8, alternates: calendar },
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
  ];
}
