import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // The blog pages read their posts from disk at request time (lib/blog; the root layout reads the language cookie, so
  // nothing under it is prerendered), and its share image uses the site's fonts and painted desk: ship all of it with
  // those functions.
  outputFileTracingIncludes: {
    "/blog/**": ["./content/blog/**/*", "./src/assets/fonts/*.ttf", "./src/app/opengraph-image.jpg"],
    // the set pages list the posts that show their cards (lib/setPages)
    "/extensions/**": ["./content/blog/**/*"],
    "/en/sets/**": ["./content/blog/**/*"],
    "/sitemap.xml": ["./content/blog/**/*"],
    // the release calendar links each release to the blog post about it (lib/releases)
    "/calendrier-des-sorties": ["./content/blog/**/*"],
    "/en/release-calendar": ["./content/blog/**/*"],
    // a binder's share picture: the fonts and the painted desk
    "/share/**": ["./src/assets/fonts/*.ttf", "./src/assets/share-desk.jpg"],
    // a public list's share picture (app/c/[slug]/og.png): the fonts and the painted desk, landscape
    "/c/**": ["./src/assets/fonts/*.ttf", "./src/app/opengraph-image.jpg"],
  },
  // Japanese cards TCGdex has no picture of yet are shown with TCGplayer's (scripts/fetch-set, scansFromTcgcsvJa): their
  // scans, /scans/tp/<product id>/low.webp and the like, are TCGplayer's image server at the size of ours (245 and 600 px
  // wide). Not downloaded: some 1,500 cards. Temporary redirects, so a scan TCGdex later has replaces them at once.
  redirects: async () => [
    { source: "/scans/tp/:id(\\d+)/low.:ext(webp|png)", destination: "https://product-images.tcgplayer.com/fit-in/245x342/:id.jpg", permanent: false },
    { source: "/scans/tp/:id(\\d+)/high.:ext(webp|png)", destination: "https://product-images.tcgplayer.com/fit-in/600x837/:id.jpg", permanent: false },
    // Short links for posts (Johan, 2026-10-20): a clean address to share, the source added for lib/funnel and Vercel
    // Analytics (the Reddit and Facebook apps send no referrer, so without it those visits read as "direct").
    { source: "/reddit", destination: "/?utm_source=reddit-fr", permanent: false },
    { source: "/en/reddit", destination: "/en?utm_source=reddit-en", permanent: false },
    { source: "/facebook", destination: "/?utm_source=facebook", permanent: false },
    { source: "/en/facebook", destination: "/en?utm_source=facebook-en", permanent: false },
    // The Instagram story highlights' link stickers (2026-11-01): their visits apart from the bio's and the posts'.
    { source: "/instagram", destination: "/?utm_source=instagram-story", permanent: false },
    { source: "/en/instagram", destination: "/en?utm_source=instagram-story-en", permanent: false },
  ],
  // The pages whose address says their language (src/proxy.ts: nothing in them follows the cookie) are kept a day on
  // Vercel's CDN: drawn on each visit otherwise (the root layout reads the cookie), the crawlers going through the ~41,000
  // card pages ran a function each time and went past the Hobby plan's CPU and invocations (2026-10-26). Their prices
  // change once a day, with the prices commit, and each deploy starts the CDN's cache afresh. The other pages follow the
  // visitor's language and stay uncached.
  headers: async () =>
    ["/en", "/en/:path*", "/extensions", "/extensions/:path*", "/calendrier-des-sorties", "/invitations-amazon", "/marche"].map((source) => ({
      source,
      headers: [{ key: "Vercel-CDN-Cache-Control", value: "s-maxage=86400, stale-while-revalidate=86400" }],
    })),
  // The sets' files (30 MB) stay out of every function: lib/setFiles fetches them from the site's static files.
  // Each function carried its own copy, and Vercel's Hobby plan keeps every deploy of the last 30 days within 10 GB.
  outputFileTracingExcludes: {
    "/**": ["./public/**/*"],
  },
};

export default nextConfig;
