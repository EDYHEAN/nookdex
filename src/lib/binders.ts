import { bareId, langOfKey } from "./cardLang";
import { catalogSet, setIdOfCard } from "./catalog";
import { SCENE } from "./scene";
import type { BinderDef, CardData, Copy, UserBinder } from "./types";

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

/** Places on the shelves, in filling order (top shelf, then bottom shelf). */
export const MAX_BINDERS = SCENE.slots.length;

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
    const paint = { slot: i, color, dark: shade(color, -0.48), ink: light(color) ? "#241c26" : "#fff3e6", sort: b.sort ?? "num" };
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
export function freePageCount(pockets: Map<number, unknown>) {
  if (!pockets.size) return 1;
  const last = Math.max(...pockets.keys());
  const pages = Math.floor(last / PER_PAGE) + 1;
  let full = true;
  for (let i = (pages - 1) * PER_PAGE; i < pages * PER_PAGE; i++) if (!pockets.has(i)) full = false;
  return full ? pages + 1 : pages;
}

/** Free binders holding a copy of this card (for the "dans Fourre-tout" tag). */
export function freeHomes(copies: Copy[] | undefined, binders: UserBinder[]) {
  const ids = new Set(copies?.flatMap((c) => (c.at ? [c.at.binder] : [])));
  return binders.filter((b): b is Extract<UserBinder, { kind: "free" }> => b.kind === "free" && ids.has(b.id));
}

/** A pocket as drawn; `wanted`: a wishlist's ghost, not owned */
export type Pocket = { index: number; cardId: string | null; card: CardData | null; wanted?: boolean };
