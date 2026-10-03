import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // The blog pages read their posts from disk at request time (lib/blog; the root layout reads the language cookie, so
  // nothing under it is prerendered), and a post draws its cards from the sets' files: ship both with those functions.
  outputFileTracingIncludes: {
    "/blog/**": ["./content/blog/**/*", "./public/sets/**/*.json"],
  },
};

export default nextConfig;
