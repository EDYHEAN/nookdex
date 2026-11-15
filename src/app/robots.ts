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

/**
 * AI training crawlers (not the answer engines: OAI-SearchBot, ChatGPT-User, Claude-SearchBot, PerplexityBot stay
 * everywhere): kept off the ~41,000 card pages only, the blog, the calendar and the set pages stay open to them. Business
 * review of 2026-11-14: ClaudeBot, GPTBot and Meta made ~120,000 requests in 12 days there and sent no visitor.
 */
const TRAINING = ["ClaudeBot", "GPTBot", "meta-externalagent", "CCBot"];
/** the desk with a binder to open (see below), barred for everyone */
const DESK_LINKS = ["/*?carte=", "/*?classeur="];

export default function robots(): MetadataRoute.Robots {
  // Vercel previews must not be indexed: only the real domain shows up on Google.
  if (!IS_PRODUCTION) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    // /studio stays crawlable on purpose: its noindex is only seen if Google may read the page
    rules: [
      { userAgent: UNWANTED, disallow: "/" },
      // a crawler follows only its own group: the desk links again there ("/extensions/*/" is a card, a set has no "/" after)
      { userAgent: TRAINING, allow: "/", disallow: ["/extensions/*/", "/en/sets/*/", ...DESK_LINKS] },
      // ?carte= / ?classeur= are the desk (/ or /en) with a binder to open: no page of their own, but every card and set
      // page links one, so a crawler fetched each card twice (2026-11-13: 24k of a scraper's 37k night requests).
      { userAgent: "*", allow: "/", disallow: DESK_LINKS },
    ],
    // the site, then the card pages in their slices (app/cartes/sitemap.ts)
    sitemap: [`${SITE_URL}/sitemap.xml`, ...CARD_SITEMAPS.filter((s) => s.listed).map((s) => `${SITE_URL}/cartes/sitemap/${s.id}.xml`)],
  };
}
