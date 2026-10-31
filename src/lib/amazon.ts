/**
 * Amazon's affiliate program (Club Partenaires Amazon.fr, Johan 2026-10-19): sealed products and accessories, never single
 * cards (those stay on Cardmarket). French pages only: the tag only pays on amazon.fr. Links are marked `rel="sponsored"`,
 * each group of them says « Lien affilié » in small grey (`affiliateLabel`), the program's sentence is on /conditions and
 * /a-propos (`AMAZON_NOTICE`, Johan 2026-10-31: no "I earn…" by the buttons). The account closes if it makes no 3 sales in
 * 180 days (3 shipped in October 2026: kept).
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
 * The places on the site an Amazon link shows on. Each link carries its place (`data-amazon-place`, also `<place>-bar` for
 * a phone's sticky bar): the weekly report counts the clicks by it (lib/funnel watchAmazonClicks), Amazon's reports the
 * sales by its tracking id.
 */
export type AmazonPlace = "invit" | "extension" | "calendrier" | "blog" | "carte" | "accessoires";

/**
 * A tracking id per place on amazon.fr (Johan's Amazon account, 2026-10-19). The card pages and the accessories have none
 * of their own yet: the main tag.
 */
export const AMAZON_TAGS: Record<AmazonPlace, string> = {
  invit: "nookdex-invit-21",
  extension: "nookdex-extension-21",
  calendrier: "nookdex-calendrier-21",
  blog: "nookdex-blog-21",
  carte: AMAZON_TAG,
  accessoires: AMAZON_TAG,
};
/**
 * The same on amazon.com. Every place on the one US tag for now: Johan creates the per-place ids in Associates Central
 * (nookdex-cal-20, -set-20…), then they go here.
 */
export const AMAZON_US_TAGS: Record<AmazonPlace, string> = {
  invit: "nookdex-20",
  extension: "nookdex-20",
  calendrier: "nookdex-20",
  blog: "nookdex-20",
  carte: "nookdex-20",
  accessoires: "nookdex-20",
};
const tagOf = (place?: AmazonPlace) => (place ? AMAZON_TAGS[place] : AMAZON_TAG);
const usTagOf = (place?: AmazonPlace) => (place ? AMAZON_US_TAGS[place] : AMAZON_US_TAG);

/**
 * a search on amazon.fr (English pages: amazon.com), our tag on it ("Méga-Évolution : Règne Delta (ME06)" ->
 * "Méga-Évolution Règne Delta", "30ᵉ" -> "30e")
 */
export const amazonSearch = (q: string, place?: AmazonPlace, lang: "fr" | "en" = "fr") => {
  const words = q.normalize("NFKC").replace(/\([^)]*\)/g, "").replace(/[:·]/g, " ").replace(/\s+/g, " ").trim();
  if (lang === "en") return `https://www.amazon.com/s?k=${encodeURIComponent(words)}&tag=${usTagOf(place)}`;
  return `https://www.amazon.fr/s?k=${encodeURIComponent(words)}&tag=${tagOf(place)}`;
};

/** a product's page on amazon.fr */
export const amazonProduct = (asin: string, place?: AmazonPlace) => `https://www.amazon.fr/dp/${asin}?tag=${tagOf(place)}`;

/** a set still in the shops: out within the last two years */
export const inShops = (releaseDate?: string | null) => !!releaseDate && Date.now() - Date.parse(releaseDate) < 730 * 86_400_000;

/** the sentence the program asks for: on /conditions and /a-propos */
export const AMAZON_NOTICE = "En tant que Partenaire Amazon, je réalise un bénéfice sur les achats remplissant les conditions requises.";
/** the US program's sentence: on the English /conditions and /a-propos */
export const AMAZON_NOTICE_EN = "As an Amazon Associate I earn from qualifying purchases.";
export const amazonNotice = (lang: "fr" | "en") => (lang === "fr" ? AMAZON_NOTICE : AMAZON_NOTICE_EN);
/** the short line by each group of Amazon buttons (a few links: the plural) */
export const affiliateLabel = (lang: "fr" | "en", many = false) =>
  lang === "fr" ? (many ? "Liens affiliés" : "Lien affilié") : many ? "Affiliate links" : "Affiliate link";

/**
 * an Amazon link in a blog post (Markdown can't say rel): the blog's tag on it (amazon.com: the US one), sponsored, in a
 * new tab, its place for the click count
 */
export function tagAmazonLinks(html: string) {
  return html.replace(/<a href="(https:\/\/(?:www\.)?amazon\.(?:fr|com)\/[^"]*)"/g, (_, href: string) => {
    const u = new URL(href.replace(/&amp;/g, "&"));
    u.searchParams.set("tag", u.hostname.endsWith("amazon.com") ? AMAZON_US_TAGS.blog : AMAZON_TAGS.blog);
    return `<a href="${u.toString().replace(/&/g, "&amp;")}" target="_blank" rel="sponsored noopener" data-amazon-place="blog"`;
  });
}

/**
 * the place a clicked Amazon link counts for: its `data-amazon-place`, else its page's first path segment (a link drawn
 * before the attribute); an amazon.com link gets "-us" (the US program is weighed on its own)
 */
export function amazonPlaceOf(a: HTMLAnchorElement, pathname: string) {
  const place = a.dataset.amazonPlace || pathname.split("/")[1] || "home";
  return (/(^|\.)amazon\.com$/.test(a.hostname) ? `${place}-us` : place).slice(0, 40);
}
