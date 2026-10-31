/**
 * Amazon's affiliate program (Club Partenaires Amazon.fr, Johan 2026-10-19): sealed products and accessories, never single
 * cards (those stay on Cardmarket). French pages only: the tag only pays on amazon.fr. Links are marked `rel="sponsored"`,
 * and every page showing one says the program's sentence (`AMAZON_NOTICE`, also on /a-propos). The account closes if it
 * makes no 3 sales in 180 days (3 shipped in October 2026: kept).
 */
export const AMAZON_TAG = "nookdex-21";

/**
 * The English pages: Amazon Associates US, amazon.com (Johan, 2026-10-31: the /en set pages and calendar get English
 * traffic, the US most of it). null until that account exists: the English pages show no Amazon link meanwhile.
 */
export const AMAZON_US_TAG: string | null = "nookdex-20";
/** the pages of a language carry Amazon links */
export const amazonOn = (lang: "fr" | "en") => lang === "fr" || !!AMAZON_US_TAG;

/**
 * A tracking id per place on the site (Johan's Amazon account, 2026-10-19): Amazon's reports tell the sales of each, the
 * weekly report the clicks (lib/funnel watchAmazonClicks). The main tag stays for anything else.
 */
export const AMAZON_TAGS = {
  invit: "nookdex-invit-21",
  extension: "nookdex-extension-21",
  calendrier: "nookdex-calendrier-21",
  blog: "nookdex-blog-21",
} as const;
export type AmazonPlace = keyof typeof AMAZON_TAGS;
const tagOf = (place?: AmazonPlace) => (place ? AMAZON_TAGS[place] : AMAZON_TAG);

/**
 * a search on amazon.fr (English pages: amazon.com), our tag on it ("Méga-Évolution : Règne Delta (ME06)" ->
 * "Méga-Évolution Règne Delta", "30ᵉ" -> "30e")
 */
export const amazonSearch = (q: string, place?: AmazonPlace, lang: "fr" | "en" = "fr") => {
  const words = q.normalize("NFKC").replace(/\([^)]*\)/g, "").replace(/[:·]/g, " ").replace(/\s+/g, " ").trim();
  if (lang === "en") return `https://www.amazon.com/s?k=${encodeURIComponent(words)}&tag=${AMAZON_US_TAG}`;
  return `https://www.amazon.fr/s?k=${encodeURIComponent(words)}&tag=${tagOf(place)}`;
};

/** a product's page on amazon.fr */
export const amazonProduct = (asin: string, place?: AmazonPlace) => `https://www.amazon.fr/dp/${asin}?tag=${tagOf(place)}`;

/** a set still in the shops: out within the last two years */
export const inShops = (releaseDate?: string | null) => !!releaseDate && Date.now() - Date.parse(releaseDate) < 730 * 86_400_000;

/** the sentence the program asks for, wherever its links are */
export const AMAZON_NOTICE = "En tant que Partenaire Amazon, je réalise un bénéfice sur les achats remplissant les conditions requises.";
/** the US program's sentence, on the English pages */
export const AMAZON_NOTICE_EN = "As an Amazon Associate I earn from qualifying purchases.";
export const amazonNotice = (lang: "fr" | "en") => (lang === "fr" ? AMAZON_NOTICE : AMAZON_NOTICE_EN);

/**
 * an Amazon link in a blog post (Markdown can't say rel): the blog's tag on it (amazon.com: the US tag, once it exists),
 * sponsored, in a new tab
 */
export function tagAmazonLinks(html: string) {
  return html.replace(/<a href="(https:\/\/(?:www\.)?amazon\.(?:fr|com)\/[^"]*)"/g, (_, href: string) => {
    const u = new URL(href.replace(/&amp;/g, "&"));
    const us = u.hostname.endsWith("amazon.com");
    if (!us) u.searchParams.set("tag", AMAZON_TAGS.blog);
    else if (AMAZON_US_TAG) u.searchParams.set("tag", AMAZON_US_TAG);
    return `<a href="${u.toString().replace(/&/g, "&amp;")}" target="_blank" rel="sponsored noopener"`;
  });
}
