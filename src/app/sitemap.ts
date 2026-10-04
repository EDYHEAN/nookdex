import type { MetadataRoute } from "next";
import { allPosts, translationOf } from "@/lib/blog";
import { SET_PAGES_ROOT, setPageEntries } from "@/lib/setPath";
import { SITE_URL } from "@/lib/site";

/** Set pages: each with its twin in the other language (same TCGdex id), when we have both. */
function setPages(): MetadataRoute.Sitemap {
  const fr = new Map(setPageEntries("fr").map((e) => [e.set.id, `${SITE_URL}${SET_PAGES_ROOT.fr}/${e.slug}`]));
  const en = new Map(setPageEntries("en").map((e) => [e.set.id, `${SITE_URL}${SET_PAGES_ROOT.en}/${e.slug}`]));
  return [...fr, ...en].map(([id], i) => {
    const url = i < fr.size ? fr.get(id)! : en.get(id)!;
    const both = fr.has(id) && en.has(id);
    return {
      url,
      // prices move every day (the prices Action)
      changeFrequency: "daily" as const,
      priority: 0.7,
      alternates: both ? { languages: { fr: fr.get(id)!, en: en.get(id)! } } : undefined,
    };
  });
}

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = allPosts();
  const home = { languages: { fr: SITE_URL, en: `${SITE_URL}/en` } };
  const sets = { languages: { fr: `${SITE_URL}/extensions`, en: `${SITE_URL}/en/sets` } };
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1, alternates: home },
    { url: `${SITE_URL}/en`, changeFrequency: "daily", priority: 1, alternates: home },
    { url: `${SITE_URL}/extensions`, changeFrequency: "weekly", priority: 0.8, alternates: sets },
    { url: `${SITE_URL}/en/sets`, changeFrequency: "weekly", priority: 0.8, alternates: sets },
    ...setPages(),
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
