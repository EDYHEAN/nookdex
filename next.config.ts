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
  },
  // Japanese cards TCGdex has no picture of yet are shown with TCGplayer's (scripts/fetch-set, scansFromTcgcsvJa): their
  // scans, /scans/tp/<product id>/low.webp and the like, are TCGplayer's image server at the size of ours (245 and 600 px
  // wide). Not downloaded: some 1,500 cards. Temporary redirects, so a scan TCGdex later has replaces them at once.
  redirects: async () => [
    { source: "/scans/tp/:id(\\d+)/low.:ext(webp|png)", destination: "https://product-images.tcgplayer.com/fit-in/245x342/:id.jpg", permanent: false },
    { source: "/scans/tp/:id(\\d+)/high.:ext(webp|png)", destination: "https://product-images.tcgplayer.com/fit-in/600x837/:id.jpg", permanent: false },
  ],
  // The sets' files (30 MB) stay out of every function: lib/setFiles fetches them from the site's static files.
  // Each function carried its own copy, and Vercel's Hobby plan keeps every deploy of the last 30 days within 10 GB.
  outputFileTracingExcludes: {
    "/**": ["./public/**/*"],
  },
};

export default nextConfig;
