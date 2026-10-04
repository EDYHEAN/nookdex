import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // The blog pages read their posts from disk at request time (lib/blog; the root layout reads the language cookie, so
  // nothing under it is prerendered), a post draws its cards from the sets' files, and its share image uses the site's
  // fonts and painted desk: ship all of it with those functions.
  outputFileTracingIncludes: {
    "/blog/**": ["./content/blog/**/*", "./public/sets/**/*.json", "./src/assets/fonts/*.ttf", "./src/app/opengraph-image.jpg"],
    // the set pages read the sets' files the same way, and the posts that show their cards (lib/setPages)
    "/extensions/**": ["./public/sets/*.json", "./content/blog/**/*"],
    "/en/sets/**": ["./public/sets/en/*.json", "./content/blog/**/*"],
    // the sitemap dates each set page with its prices' last refresh
    "/sitemap.xml": ["./public/sets/*.json", "./public/sets/en/*.json", "./content/blog/**/*"],
  },
};

export default nextConfig;
