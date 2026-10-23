import { bareId, langOfKey } from "./cardLang";
import { catalogSet, setIdOfCard } from "./catalog";
import { SCENE } from "./scene";
import type { BinderDef, BinderGrid, CardData, Copy, UserBinder } from "./types";

/** Binder colors, picked on the binders painted in the first version of the room. */
export const BINDER_COLORS = [
  "#b9b3bd", // silver
  "#d9a95e", // mustard
  "#86acc6", // sky
  "#977fb8", // lavender
  "#c95a58", // red
  "#7f9a7a", // sage
  "#bba283", // sand
  "#7b7eb0", // indigo
  "#86a66b", // grass
  "#d6879d", // pink
  "#5f9b93", // teal
  "#5f5a5e", // charcoal
];

/** Places on the shelves, in filling order (top shelf, then bottom shelf): one page of the shelf. */
export const SHELF_SLOTS = SCENE.slots.length;
/** The player's binders at most (Johan, 2026-10-16: big collections, the Pokécardex import): 5 pages' worth of 12. */
export const MAX_BINDERS = SHELF_SLOTS * 5;
/**
 * Places the trade binder takes at the start of the shelf (Johan, 2026-10-23: every player has it, it stands first, top
 * shelf, page 1). The player's binders follow it: page 1 holds 11 of them, the others 12.
 */
export const SHELF_LEAD = 1;
/** Pages the shelf can turn: the player's binders after the trade binder (60 + 1 places: a 6th page for the last one) */
export const SHELF_PAGES = Math.ceil((MAX_BINDERS + SHELF_LEAD) / SHELF_SLOTS);
/** Where the n-th place of the shelf is (the trade binder's counted): its page and its slot */
export const shelfPlace = (pos: number) => ({ page: Math.floor(pos / SHELF_SLOTS), slot: pos % SHELF_SLOTS });
/** Pages the shelf shows: the ones with binders, and the one with the free place for a new binder. */
export const shelfPageCount = (n: number) =>
  Math.min(SHELF_PAGES, Math.floor(Math.min(n + SHELF_LEAD, MAX_BINDERS + SHELF_LEAD - 1) / SHELF_SLOTS) + 1);

/** The first color no binder wears yet. */
export function freeColor(binders: UserBinder[]) {
  const used = new Set(binders.map((b) => b.color));
  return BINDER_COLORS.find((c) => !used.has(c)) ?? BINDER_COLORS[binders.length % BINDER_COLORS.length];
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
/** Mixes a color toward black (t < 0) or white (t > 0). */
export const shade = (hex: string, t: number) => toHex(rgb(hex).map((v) => (t < 0 ? v * (1 + t) : v + (255 - v) * t)));
const light = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
};

/** The player's binders as they stand on the shelf. */
export function shelfBinders(binders: UserBinder[]): BinderDef[] {
  return binders.slice(0, MAX_BINDERS).map((b, i) => {
    const color = b.color ?? BINDER_COLORS[i % BINDER_COLORS.length];
    const paint = { ...shelfPlace(i + SHELF_LEAD), color, dark: shade(color, -0.48), ink: light(color) ? "#241c26" : "#fff3e6", sort: b.sort ?? "num", grid: b.grid ?? 9 };
    if (b.kind === "free") {
      const wish = !!b.wish;
      return { ...paint, id: b.id, kind: "free", wish, wants: b.wants ?? {}, code: wish ? "WISH" : "LIBRE", name: b.name, logo: null, setId: null, lang: null };
    }
    const set = catalogSet(b.setId);
    return {
      ...paint,
      id: b.id,
      kind: "set",
      wish: false,
      wants: {},
      code: set?.code ?? bareId(b.setId).toUpperCase(),
      name: set?.name ?? bareId(b.setId),
      logo: set?.logo ?? null,
      setId: b.setId,
      lang: langOfKey(b.setId),
    };
  });
}

/** A free binder's pockets: the copies slipped in it, by pocket number. */
export function pocketsOf(binderId: string, collection: Record<string, Copy[]>) {
  const out = new Map<number, { cardId: string; copy: Copy }>();
  for (const [cardId, copies] of Object.entries(collection)) {
    for (const copy of copies) if (copy.at?.binder === binderId) out.set(copy.at.pocket, { cardId, copy });
  }
  return out;
}

export const PER_PAGE = 9;

/**
 * A page's pockets: columns, rows, the page's width / height and a pocket's share of its width. The cards keep their
 * size from 9 to 6 (a narrower page, like a real 6-pocket binder); 4 makes them bigger on the same page.
 */
export const GRIDS: Record<BinderGrid, { cols: number; rows: number; aspect: number; colW: number }> = {
  9: { cols: 3, rows: 3, aspect: 0.74, colW: 28.5 },
  6: { cols: 2, rows: 3, aspect: 0.52, colW: 41 },
  // a little smaller than the page allows: their variant marks fit under them, and the page breathes
  4: { cols: 2, rows: 2, aspect: 0.74, colW: 37 },
};

/** A wishlist's wanted cards, by pocket (none for another binder). */
export function wantsOf(b: UserBinder | BinderDef | undefined) {
  const wants = b && "wants" in b ? (b.wants ?? {}) : {};
  return new Map(Object.entries(wants).map(([pocket, cardId]) => [Number(pocket), cardId]));
}

/**
 * The box on the shelf: the cards no binder holds (copies kept by their set, whose binder isn't on the shelf; extra sets
 * have none). By set, the biggest first. Nothing is stored for it: a set binder put back takes its cards again.
 */
export function boxOf(collection: Record<string, Copy[]>, binders: UserBinder[]) {
  const onShelf = new Set(binders.flatMap((b) => (b.kind === "set" ? [b.setId] : [])));
  const bySet = new Map<string, { cardId: string; copies: Copy[] }[]>();
  for (const [cardId, copies] of Object.entries(collection)) {
    const loose = copies.filter((c) => !c.at);
    const setId = setIdOfCard(cardId);
    if (!loose.length || !setId || onShelf.has(setId)) continue;
    bySet.set(setId, [...(bySet.get(setId) ?? []), { cardId, copies: loose }]);
  }
  return [...bySet]
    .map(([setId, items]) => ({ setId, set: catalogSet(setId), items, count: items.reduce((n, x) => n + x.copies.reduce((m, c) => m + c.qty, 0), 0) }))
    .sort((a, b) => b.count - a.count);
}

/** First pocket of a free binder with neither a copy nor a wanted card. */
export function firstEmpty(binder: UserBinder | undefined, binderId: string, collection: Record<string, Copy[]>) {
  const used = pocketsOf(binderId, collection);
  const wants = wantsOf(binder);
  let i = 0;
  while (used.has(i) || wants.has(i)) i++;
  return i;
}

/** The player's wishlists. */
export const wishBinders = (binders: UserBinder[]) =>
  binders.filter((b): b is Extract<UserBinder, { kind: "free" }> => b.kind === "free" && !!b.wish);

/** Pages of a free binder: up to the last one used, plus a fresh one once that one is full. */
export function freePageCount(pockets: Map<number, unknown>, per: number = PER_PAGE) {
  if (!pockets.size) return 1;
  const last = Math.max(...pockets.keys());
  const pages = Math.floor(last / per) + 1;
  let full = true;
  for (let i = (pages - 1) * per; i < pages * per; i++) if (!pockets.has(i)) full = false;
  return full ? pages + 1 : pages;
}

/** Free binders holding a copy of this card (for the "dans Fourre-tout" tag). */
export function freeHomes(copies: Copy[] | undefined, binders: UserBinder[]) {
  const ids = new Set(copies?.flatMap((c) => (c.at ? [c.at.binder] : [])));
  return binders.filter((b): b is Extract<UserBinder, { kind: "free" }> => b.kind === "free" && ids.has(b.id));
}

/** A pocket as drawn; `wanted`: a wishlist's ghost, not owned */
export type Pocket = { index: number; cardId: string | null; card: CardData | null; wanted?: boolean };
