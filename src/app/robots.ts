import type { MetadataRoute } from "next";
import { CARD_SITEMAPS } from "@/lib/cardPages";
import { IS_PRODUCTION, SITE_URL } from "@/lib/site";

// Crawlers that bring no player: SEO tools' own indexes, ad and dataset scrapers (2026-10-26: with the ~41,000 card
// pages, the robots made most of the site's traffic and went past Vercel's Hobby quotas). Search engines and the AI
// answer engines (ChatGPT, Claude, Perplexity: the blog's GEO) stay welcome.
const UNWANTED = [
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "BLEXBot",
  "DataForSeoBot",
  "serpstatbot",
  "Barkrowler",
  "SeekportBot",
  "PetalBot",
  "Bytespider",
  "Amazonbot",
  "ImagesiftBot",
  "Timpibot",
];

export default function robots(): MetadataRoute.Robots {
  // Vercel previews must not be indexed: only the real domain shows up on Google.
  if (!IS_PRODUCTION) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    // /studio stays crawlable on purpose: its noindex is only seen if Google may read the page
    rules: [
      { userAgent: UNWANTED, disallow: "/" },
      { userAgent: "*", allow: "/" },
    ],
    // the site, then the card pages in their slices (app/cartes/sitemap.ts)
    sitemap: [`${SITE_URL}/sitemap.xml`, ...CARD_SITEMAPS.map((s) => `${SITE_URL}/cartes/sitemap/${s.id}.xml`)],
  };
}
