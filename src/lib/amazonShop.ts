import data from "@/data/amazon-products.json";
import pics from "@/data/amazon-pics.json";
import { amazonProduct, amazonSearch, type AmazonPlace } from "./amazon";

/**
 * Sealed Pokémon TCG products on amazon.fr (Johan, 2026-10-19: put the products forward, with their official picture and
 * a call to action, wherever they show): src/data/amazon-products.json, a group per set or line of products; their pictures come from
 * Poképédia (scripts/fetch-amazon-pics.mjs -> public/amazon, src/data/amazon-pics.json). Amazon sells most of them by invitation:
 * the button says so. French pages only (the affiliate tag pays on amazon.fr).
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

export const SHOP_PATH = "/invitations-amazon";
export const shopGroups = data.groups as ShopGroup[];
export const shopUpdated = data.updated;
export const shopOfSet = (setId: string) => shopGroups.find((g) => g.setId === setId);

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

/**
 * its button: Amazon sells the sealed Pokémon products by invitation; before the release its page takes pre-orders, and
 * before it's listed a search, which only shows pre-orders (Johan, 2026-10-31: a search isn't a pre-order)
 */
export const goLabel = (p: ShopProduct, soon: boolean) =>
  p.asin ? (soon ? "Précommander" : "Demander l'invitation") : soon ? "Voir les précommandes" : "Voir sur Amazon";

/** its page on amazon.fr (else a search), with the tracking id of the place it shows on */
export const productHref = (p: ShopProduct, place: AmazonPlace) => (p.asin ? amazonProduct(p.asin, place) : amazonSearch(p.q ?? `Pokémon ${p.name}`, place));

const PICS = pics as Record<string, { src: string; w: number; h: number }>;
export type ProductPic = { src: string; w: number; h: number };
/** the kinds made of boosters: the set's booster stands for them while their own picture is missing */
const OF_BOOSTERS: ShopKind[] = ["bundle", "tripack", "blister"];
/**
 * its official picture; none yet: the set's booster for a bundle, a tripack or a blister, else nothing (a drawn tile,
 * lib/kindArt: Règne Delta's Elite Trainer Box and display showed a booster, Johan 2026-10-31)
 */
export const productPic = (p: ShopProduct, g: ShopGroup): ProductPic | null =>
  (p.pic && PICS[p.pic]) || (OF_BOOSTERS.includes(p.kind) && g.pic && PICS[g.pic]) || null;
/** the set's boosters (its picture, the products' booster pictures): the hero's fan when its box has no picture */
export const boosterPics = (g: ShopGroup) =>
  [...new Set([g.pic, ...g.products.map((p) => p.pic)])].flatMap((k) => (k && PICS[k] && /\/booster-/.test(PICS[k].src) ? [PICS[k]] : []));

/** a set's name as people say it: "Méga-Évolution : Règne Delta (ME06)" -> "Règne Delta", "Mega Evolution: Delta Reign" -> "Delta Reign" */
export const shortSetName = (name: string) =>
  name
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/^.*?\s:\s|^[^:]*:\s/, "")
    .replace(/^(Méga-Évolution|Mega Evolution)\s+/, "");

/** the products to show first: the boxes people look for (ETB, display, bundle), then the rest */
const ORDER: ShopKind[] = ["etb", "display", "bundle", "box", "collection", "pokebox", "tripack", "tin", "blister"];
export const byInterest = (ps: ShopProduct[]) => [...ps].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
