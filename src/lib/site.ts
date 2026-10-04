/** The public domain. Canonical link, sitemap and share image always point here in production. */
export const SITE_DOMAIN = "nookdex.com";

/** Production = the real domain; Vercel previews = their own URL; local = localhost. */
export const IS_PRODUCTION = process.env.VERCEL_ENV === "production";
export const SITE_URL = IS_PRODUCTION
  ? `https://${SITE_DOMAIN}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

/** The name, everywhere on the site (split in two for the two-tone lettering). */
export const SITE_NAME = "NookDex";
export const NAME_PARTS = ["Nook", "Dex"] as const;
export const OS_NAME = `${SITE_NAME.toUpperCase()} OS`;
export const SITE_DESCRIPTION =
  "Range ta collection de cartes Pokémon dans des classeurs, sur un petit bureau peint à la main : suivi de tes extensions, prix Cardmarket et TCGplayer, wishlist et doublons.";
export const SITE_DESCRIPTION_EN =
  "File your Pokémon card collection in binders, on a little hand-painted desk: track your sets, TCGplayer and Cardmarket prices, wishlist and duplicates.";

/** Server pages (the legal notebook, the page text) read the language from this cookie, kept in step with the app. */
export const LANG_COOKIE = "nookdex-lang";

/** Set by the proxy on pages whose address carries their language (/en, /extensions): it wins over the cookie. */
export const PATH_LANG_HEADER = "x-nookdex-lang";

/** Tips for the project (the cat's bowl, the about pages). */
export const SUPPORT_URL = "https://paypal.me/JohanTrigeard";
