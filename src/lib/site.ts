/** The public domain. Canonical link, sitemap and share image always point here in production. */
export const SITE_DOMAIN = "nookdex.com";

/** Production = the real domain; Vercel previews = their own URL; local = localhost. */
export const IS_PRODUCTION = process.env.VERCEL_ENV === "production";
export const SITE_URL = IS_PRODUCTION
  ? `https://${SITE_DOMAIN}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

/** Supabase: public values (its tables are guarded by row level security), env vars override them. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xwqhucccldraieyiycvt.supabase.co";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_Fn4KmAAhKl7crl-R_ZCHWw_OkFukB2i";

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

/** NookDex on Instagram: linked from the shelf notebook and /a-propos, in the home page's JSON-LD, on the share picture. */
export const INSTAGRAM_URL = "https://www.instagram.com/_nookdex/";
export const INSTAGRAM_HANDLE = "@_nookdex";
/** And on TikTok (2026-10-12): same places. */
export const TIKTOK_URL = "https://www.tiktok.com/@nookdex";
export const TIKTOK_HANDLE = "@nookdex";

/** The social posts, rendered on the repo's `social` branch (docs/social.md), read by /studio. */
export const SOCIAL_RENDERS = "https://raw.githubusercontent.com/EDYHEAN/nookdex/social/renders/";
/** Who may open /studio: SHA-256 of the e-mail, lower case (the addresses themselves stay out of the page's code). */
export const STUDIO_EMAIL_HASHES = [
  "2c4c00bbbcda2d584737cc0772927118df2c53159b1522099d395ae6d2f7fa33",
  "661b3359f20b30c599679ffdc2ed12aa3213ed19994f918a9d8d2310b24fc608",
  "584db0979a6e714ea48d6913c71af4c9641ddc5dd05edc43a538c66feb710280",
];

/** Who publishes the site and sells the skins (the legal notice, the terms of sale): Johan's sole-trader business. */
export const LEGAL = {
  name: "Johan Trigeard",
  siret: "878 661 941 00046",
  address: "10 allée des Mimosas, 33370 Tresses, France",
  email: "contact@nookdex.com",
  /** the consumer mediator Johan joins, named in the terms of sale once he sells himself (no Managed Payments) */
  mediator: null as { name: string; url: string } | null,
};

/**
 * How the shop sells (docs/skins.md): Stripe Managed Payments, where Link is the seller (taxes, receipts, refunds; no
 * Cartes Bancaires, no PayPal), or plain Stripe Checkout, where Johan sells (VAT-exempt, the buyer waives withdrawal
 * before paying). `NEXT_PUBLIC_STRIPE_MANAGED=off` in Vercel switches to plain Stripe, then a redeploy.
 */
export const MANAGED_PAYMENTS = process.env.NEXT_PUBLIC_STRIPE_MANAGED !== "off";

/** Tips for the project (the cat's bowl, the about pages). */
export const SUPPORT_URL = "https://paypal.me/JohanTrigeard";
