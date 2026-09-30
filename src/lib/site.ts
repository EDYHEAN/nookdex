/** Public address of the site: Vercel gives the production domain at build time; localhost in dev. */
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

/** The name, everywhere on the site (split in two for the two-tone lettering). */
export const SITE_NAME = "NookDex";
export const NAME_PARTS = ["Nook", "Dex"] as const;
export const OS_NAME = `${SITE_NAME.toUpperCase()} OS`;
export const SITE_DESCRIPTION =
  "Range ta collection de cartes Pokémon dans des classeurs, sur un petit bureau peint à la main : suivi de tes extensions, prix Cardmarket, wishlist et doublons.";
