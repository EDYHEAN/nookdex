/**
 * Amazon's affiliate program (Club Partenaires Amazon.fr, Johan 2026-10-19): sealed products and accessories, never single
 * cards (those stay on Cardmarket). French pages only: the tag only pays on amazon.fr. Links are searches with the tag (no
 * product ids to keep up; any purchase within 24 h counts), marked `rel="sponsored"`, and every page showing one says
 * the program's sentence (`AMAZON_NOTICE`, also on /a-propos). The account closes if it makes no 3 sales in 180 days.
 */
export const AMAZON_TAG = "nookdex-21";

/** a search on amazon.fr, our tag on it ("Méga-Évolution : Règne Delta (ME06)" -> "Méga-Évolution Règne Delta", "30ᵉ" -> "30e") */
export const amazonSearch = (q: string) => {
  const words = q.normalize("NFKC").replace(/\([^)]*\)/g, "").replace(/[:·]/g, " ").replace(/\s+/g, " ").trim();
  return `https://www.amazon.fr/s?k=${encodeURIComponent(words)}&tag=${AMAZON_TAG}`;
};

/** a set still in the shops: out within the last two years */
export const inShops = (releaseDate?: string | null) => !!releaseDate && Date.now() - Date.parse(releaseDate) < 730 * 86_400_000;

/** the sentence the program asks for, wherever its links are */
export const AMAZON_NOTICE = "En tant que Partenaire Amazon, je réalise un bénéfice sur les achats remplissant les conditions requises.";

/** an amazon.fr link in a blog post (Markdown can't say rel): our tag on it, sponsored, in a new tab */
export function tagAmazonLinks(html: string) {
  return html.replace(/<a href="(https:\/\/(?:www\.)?amazon\.fr\/[^"]*)"/g, (_, href: string) => {
    const u = new URL(href.replace(/&amp;/g, "&"));
    u.searchParams.set("tag", AMAZON_TAG);
    return `<a href="${u.toString().replace(/&/g, "&amp;")}" target="_blank" rel="sponsored noopener"`;
  });
}
