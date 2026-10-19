import data from "@/data/amazon-products.json";
import pics from "@/data/amazon-pics.json";
import { AMAZON_TAG, amazonSearch } from "./amazon";

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

export const productHref = (p: ShopProduct) => (p.asin ? `https://www.amazon.fr/dp/${p.asin}?tag=${AMAZON_TAG}` : amazonSearch(p.q ?? `Pokémon ${p.name}`));

const PICS = pics as Record<string, { src: string; w: number; h: number }>;
export const productPic = (p: ShopProduct, g: ShopGroup) => (p.pic && PICS[p.pic]) || (g.pic && PICS[g.pic]) || null;

/** the products to show first: the boxes people look for (ETB, display, bundle), then the rest */
const ORDER: ShopKind[] = ["etb", "display", "bundle", "box", "collection", "pokebox", "tripack", "tin", "blister"];
export const byInterest = (ps: ShopProduct[]) => [...ps].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
