import type { MetadataRoute } from "next";
import { allPosts, translationOf } from "@/lib/blog";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = allPosts();
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
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
