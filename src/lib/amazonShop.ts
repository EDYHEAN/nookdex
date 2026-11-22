import data from "@/data/amazon-products.json";
import dataUs from "@/data/amazon-products-us.json";
import pics from "@/data/amazon-pics.json";
import setBoxes from "@/data/set-boxes.json";
import catalogEn from "@/data/catalog-en.json";
import catalogFr from "@/data/catalog.json";
import { amazonProduct, amazonSearch, type AmazonPlace } from "./amazon";
import { boxArt } from "./kindArt";

/**
 * Sealed Pokémon TCG products on amazon.fr (Johan, 2026-10-19: put the products forward, with their official picture and
 * a call to action, wherever they show): src/data/amazon-products.json, a group per set or line of products; their pictures come from
 * Poképédia (scripts/fetch-amazon-pics.mjs -> public/amazon, src/data/amazon-pics.json). Amazon sells most of them by invitation:
 * the button says so. Each language has its own products and tag: amazon.fr's for the French pages, amazon.com's (the
 * English packaging, src/data/amazon-products-us.json) for the English ones.
 */
export type ShopKind = "etb" | "display" | "bundle" | "tripack" | "box" | "collection" | "blister" | "pokebox" | "tin";
export interface ShopProduct {
  /** amazon.fr/dp/<asin>; none yet: a search (q) */
  asin?: string;
  kind: ShopKind;
  name: string;
  q?: string;
  /** its Poképédia page or file, else the group's picture */
  pic?: string;
  /**
   * how amazon.fr sells it (Johan, 2026-11-22: « Demander l'invitation » made 134 clicks and no sale, the invited buy days
   * later from Amazon's own mail, out of our 24 h cookie; the links to what can be bought at once sold like the US's):
   * "now" in the cart straight away, "invite" by invitation only; unknown: neither promised. Kept up to date by the
   * release-watch routine (docs/release-watch.md).
   */
  buy?: "now" | "invite";
}
export interface ShopGroup {
  id: string;
  /** its set in the French catalog (its page, its binder), if it's a set's */
  setId: string | null;
  name: string;
  code?: string;
  date?: string;
  pic?: string;
  products: ShopProduct[];
}

type Lang = "fr" | "en";

export const SHOP_PATH = "/invitations-amazon";
/** the gift guide (amazon.fr, French only): src/app/(desk)/cadeaux-pokemon, src/data/amazon-gifts.json */
export const GIFTS_PATH = "/cadeaux-pokemon";
/** its season: a tab in the shop pages and a link from the calendar and the invitations, from November 20th to Christmas */
export const giftSeason = (d = new Date()) => {
  const md = d.toISOString().slice(5, 10);
  return md >= "11-20" && md <= "12-25";
};
export const SHOP_PATH_EN = "/en/amazon-invites";
export const shopPath = (lang: Lang) => (lang === "fr" ? SHOP_PATH : SHOP_PATH_EN);
export const shopGroups = data.groups as ShopGroup[];
export const shopUpdated = data.updated;
export const shopOfSet = (setId: string) => shopGroups.find((g) => g.setId === setId);
/** amazon.com's products (the English pages): src/data/amazon-products-us.json, the English packaging, TCGplayer's pictures */
export const shopGroupsUs = dataUs.groups as ShopGroup[];
export const shopUpdatedUs = dataUs.updated;
export const shopFor = (setId: string, lang: Lang) => (lang === "fr" ? shopOfSet(setId) : shopGroupsUs.find((g) => g.setId === setId));

export const KIND_LABEL: Record<ShopKind, string> = {
  etb: "Coffret Dresseur d'élite",
  display: "Display",
  bundle: "Bundle",
  tripack: "Tripack",
  box: "Coffret",
  collection: "Collection",
  blister: "Blister",
  pokebox: "Pokébox",
  tin: "Mini Tin",
};
const KIND_LABEL_EN: Record<ShopKind, string> = {
  etb: "Elite Trainer Box",
  display: "Booster Box",
  bundle: "Booster Bundle",
  tripack: "3-Pack Blister",
  box: "Box",
  collection: "Collection",
  blister: "Blister",
  pokebox: "Tin",
  tin: "Mini Tin",
};
export const kindLabel = (kind: ShopKind, lang: Lang = "fr") => (lang === "fr" ? KIND_LABEL : KIND_LABEL_EN)[kind];

/**
 * its button: before the release its page takes pre-orders, and before it's listed a search, which only shows pre-orders
 * (Johan, 2026-10-31: a search isn't a pre-order). Then what it promises: the price of a box sold at once (no price of
 * ours: Amazon's page says it), or the invitation. On amazon.com not every listing is by invitation: no promise there.
 */
export const goLabel = (p: ShopProduct, soon: boolean, lang: Lang = "fr") =>
  lang === "en"
    ? soon ? (p.asin ? "Pre-order" : "See pre-orders") : "See on Amazon"
    : soon
      ? p.asin ? "Précommander" : "Voir les précommandes"
      : p.asin && p.buy === "now"
        ? "Voir le prix sur Amazon"
        : p.asin && p.buy === "invite" ? "Demander l'invitation" : "Voir sur Amazon";
/** the same in a phone's sticky bar, a few words */
export const stickyLabel = (p: ShopProduct | undefined, soon: boolean, lang: Lang = "fr") =>
  lang === "en"
    ? soon ? "Pre-orders" : "On Amazon"
    : soon ? "Précommandes" : p?.asin && p.buy === "now" ? "Voir le prix" : p?.asin && p.buy === "invite" ? "L'invitation" : "Sur Amazon";
/** the chip on its picture (French pages, once out): « Sur invitation » only (a box sold at once: its button says it) */
export const buyChip = (p: ShopProduct, soon: boolean, lang: Lang = "fr") => (lang === "fr" && !soon && p.asin && p.buy === "invite" ? p.buy : null);

/**
 * its page on Amazon (else a search), with the tracking id of the place it shows on; on the invitations page a box sold at
 * once has its own id (nookdex-achat-21, Johan 2026-11-22), so Amazon's report tells it from the invitations
 */
export const productHref = (p: ShopProduct, place: AmazonPlace, lang: Lang = "fr") => {
  const tagged: AmazonPlace = place === "invit" && lang === "fr" && p.buy === "now" ? "achat" : place;
  return p.asin ? amazonProduct(p.asin, tagged, lang) : amazonSearch(p.q ?? `Pokémon ${p.name}`, tagged, lang);
};

const PICS = pics as Record<string, { src: string; w: number; h: number }>;
export type ProductPic = { src: string; w: number; h: number };
/** the kinds made of boosters: the set's booster stands for them while their own picture is missing */
const OF_BOOSTERS: ShopKind[] = ["bundle", "tripack", "blister"];
/**
 * A French box without its picture: the same box of the English set (TCGplayer's, src/data/amazon-products-us.json).
 * Poképédia uploads an Elite Trainer Box weeks late and displays never (Johan, 2026-11-10: « au pire les EN plutôt qu'un
 * placeholder »; same box, the English logo on it). Only on the French pages: the English ones never show the French box.
 */
function twinPic(p: ShopProduct, g: ShopGroup) {
  if (!g.setId || !shopGroups.includes(g)) return null;
  const twin = shopGroupsUs.find((x) => x.setId === g.setId)?.products.find((x) => x.kind === p.kind && x.pic && PICS[x.pic]);
  return twin ? PICS[twin.pic!] : null;
}
/**
 * A set's boxes as TCGplayer shows them (src/data/set-boxes.json, scripts/fetch-amazon-pics.mjs: TCGCSV lists them weeks
 * before the release, long before our products have an ASIN), the English packaging: a set with no product of ours yet
 * (the calendar's next set, the kinds of an older set) still shows real boxes (Johan, 2026-11-22: « un ETB vecteur ça
 * marche pas »).
 */
const BOXES = setBoxes as Record<string, Partial<Record<ShopKind | "booster", string>>>;
export const setBoxPic = (setId: string | null | undefined, kind: ShopKind | "booster"): ProductPic | null => {
  const k = setId ? BOXES[setId]?.[kind] : undefined;
  return (k && PICS[k]) || null;
};
/**
 * its official picture; none yet: the English set's same box (twinPic, then TCGplayer's of the set: setBoxPic; the
 * French one wins the day Poképédia has it, Johan 2026-11-22), the set's booster for a bundle, a tripack or a blister,
 * else nothing (never a booster for a box: Johan 2026-10-31)
 */
export const productPic = (p: ShopProduct, g: ShopGroup): ProductPic | null => {
  const own = (p.pic && PICS[p.pic]) || null;
  // a tripack's or a bundle's own picture is often its booster, standing in: the box itself, even English, says more
  if (own && !/\/booster-/.test(own.src)) return own;
  return (
    twinPic(p, g) ||
    setBoxPic(g.setId, p.kind) ||
    own ||
    (OF_BOOSTERS.includes(p.kind) && ((g.pic && PICS[g.pic]) || setBoxPic(g.setId, "booster"))) ||
    null
  );
};
/** a group's set logo in that language (the site's 320 px one), for a box drawn while its picture is missing (lib/kindArt boxArt) */
export function groupLogo(g: ShopGroup, lang: Lang = "fr") {
  if (!g.setId) return null;
  const s = ((lang === "fr" ? catalogFr : catalogEn) as { id: string; logo?: string | null }[]).find((x) => x.id === g.setId);
  return s?.logo?.startsWith("/") ? `${s.logo}-sm.webp` : null;
}

/** what stands for a product without its picture: its box drawn with the set's logo, else its kind drawn (SVG markup) */
export const productArt = (p: ShopProduct, g: ShopGroup, lang: Lang = "fr") => boxArt(p.kind, groupLogo(g, lang));

/** the set's boosters (its picture, the products' booster pictures): the hero's fan when its box has no picture */
export const boosterPics = (g: ShopGroup) =>
  [...new Set([g.pic, ...g.products.map((p) => p.pic)])].flatMap((k) => (k && PICS[k] && /\/booster-/.test(PICS[k].src) ? [PICS[k]] : []));

/** a set's name as people say it: "Méga-Évolution : Règne Delta (ME06)" -> "Règne Delta", "Mega Evolution: Delta Reign" -> "Delta Reign" */
export const shortSetName = (name: string) =>
  name
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/^.*?\s:\s|^[^:]*:\s/, "")
    // "Mega Evolution—Ascended Heroes" too (no colon, a dash)
    .replace(/^(Méga-Évolution|Mega Evolution)(\s*[—–-]\s*|\s+)/, "");

/**
 * the products to show first: the boxes people look for (ETB, display, bundle), then the rest. The first stands under the
 * lamp (the heroes, the sticky bars): the most looked-for, even by invitation (Johan, 2026-11-22: « autant afficher l'item
 * le plus populaire, donc l'ETB »); what sells at once comes as the second button (firstNow)
 */
const ORDER: ShopKind[] = ["etb", "display", "bundle", "box", "collection", "pokebox", "tripack", "tin", "blister"];
export const byInterest = (ps: ShopProduct[]) => [...ps].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
/** the first of a set's products sold at once (amazon.fr), the most looked-for first */
export const firstNow = (ps: ShopProduct[]) => byInterest(ps).find((p) => p.buy === "now" && p.asin);
