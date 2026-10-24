"use client";

import { create } from "zustand";
import releasesData from "@/data/releases.json";
import { pocketsOf, wantsOf, wishBinders } from "./binders";
import { setIdOfCard, useSets } from "./catalog";
import { cardCurrency, convert, marketPrice, playerCurrency } from "./price";
import { useStore } from "./store";
import type { CardData, Variant } from "./types";

/**
 * « Le courrier » (sprint 2, 2026-10-24): a letter on the desk when the player comes back and something moved since their
 * last visit. All in this browser, no account: a snapshot of what their cards and wanted cards were worth (localStorage
 * `nookdex:visit-snap`), compared with today's prices (the set files the room loads anyway, nothing more to download).
 * At most 4 tiles: the collection's value since then, the owned card that moved most, the wanted cards that got cheaper,
 * the next release within 14 days. Never an empty letter: no move, no envelope (the release alone isn't news enough).
 * The snapshot is replaced only once the letter is opened, so small moves add up until they're worth a letter.
 */

const SNAP_KEY = "nookdex:visit-snap";
const DAY_KEY = "nookdex:courrier-day";
const PINS_KEY = "nookdex:courrier-pins";
/** a letter comes this long after the last snapshot at the earliest */
export const MIN_GAP = 20 * 3_600_000;
/** with nothing to say this long, the snapshot is taken again (new cards in it) */
const STALE = 14 * 86_400_000;
/** a card's price back then below this (its currency): its % moves mean nothing */
const MIN_THEN = 0.5;
/** the letters pinned on the cork board */
const PINS = 4;

export interface Snap {
  at: number;
  /** "key|variant" -> market price (the card's currency) and copies owned */
  owned: Record<string, [price: number, qty: number]>;
  /** wanted cards (★, wishlists) -> market price */
  wants: Record<string, number>;
}

export type Tile =
  | { kind: "value"; delta: number; pct: number }
  | { kind: "card"; key: string; name: string; img: string | null; pct: number; delta: number }
  | { kind: "wants"; key: string; name: string; img: string | null; pct: number; count: number }
  | { kind: "release"; name: string; date: string; days: number; setId?: string };

export interface Letter {
  /** the day it was written (YYYY-MM-DD, local) */
  day: string;
  /** the last visit it compares with */
  since: number;
  tiles: Tile[];
}

const today = () => new Date().toLocaleDateString("sv-SE");
const read = <T>(key: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
};
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
};

export const readSnap = () => read<Snap>(SNAP_KEY);
export const shownToday = () => read<string>(DAY_KEY) === today();
export const markShown = () => write(DAY_KEY, today());

/** The cards the player is after: ★ ones and the wishlists' ghosts, not owned */
function wantedKeys() {
  const { stars, binders, collection } = useStore.getState();
  const keys = new Set(Object.keys(stars));
  for (const b of wishBinders(binders)) {
    const kept = pocketsOf(b.id, collection);
    for (const [pocket, key] of wantsOf(b)) if (!kept.has(pocket)) keys.add(key);
  }
  return [...keys].filter((k) => !collection[k]?.length);
}

/**
 * A card's data, "wait" while its set file is coming, or "skip": a card of no set we know (an old import) or missing from
 * its loaded set. Those used to hold the whole snapshot back, so a collection with one of them never got a letter.
 */
function cardOrWait(key: string): CardData | "wait" | "skip" {
  const { cards, sets } = useSets.getState();
  if (cards[key]) return cards[key];
  const set = setIdOfCard(key);
  return !set || sets[set] ? "skip" : "wait";
}

/** Today's snapshot, or null while a card's data isn't loaded yet (its set file coming) */
export function takeSnap(): Snap | null {
  const { collection } = useStore.getState();
  const cards = useSets.getState().cards;
  const owned: Snap["owned"] = {};
  for (const [key, copies] of Object.entries(collection)) {
    const card = cardOrWait(key);
    if (card === "wait") return null;
    if (card === "skip") continue;
    const qty = new Map<Variant, number>();
    for (const c of copies) qty.set(c.variant, (qty.get(c.variant) ?? 0) + c.qty);
    for (const [variant, n] of qty) {
      const p = marketPrice(card, variant, "trend");
      if (p != null) owned[`${key}|${variant}`] = [p, n];
    }
  }
  const wants: Snap["wants"] = {};
  for (const key of wantedKeys()) {
    const card = cards[key];
    const p = card && marketPrice(card, card.variants[0] ?? "normal", "trend");
    if (p != null) wants[key] = p;
  }
  return { at: Date.now(), owned, wants };
}

export const saveSnap = (s: Snap) => write(SNAP_KEY, s);

/** The next set out within 14 days (France and the world: the cards the player collects) */
function nextRelease(lang: "fr" | "en"): Tile | null {
  const now = today();
  const next = (releasesData.items as { date: string; region: string; kind: string; fr: string; en: string; setId?: string }[])
    .filter((r) => r.kind === "set" && r.region === "intl" && r.date >= now)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!next) return null;
  const days = Math.round((Date.parse(`${next.date}T12:00:00`) - Date.parse(`${now}T12:00:00`)) / 86_400_000);
  return days <= 14 ? { kind: "release", name: lang === "en" ? next.en : next.fr, date: next.date, days, setId: next.setId } : null;
}

/**
 * The letter since `snap`, or null when nothing moved enough (or the cards aren't loaded yet: `ready` false).
 * Amounts in the player's money.
 */
export function writeLetter(snap: Snap, lang: "fr" | "en"): { ready: boolean; letter: Letter | null } {
  const { collection } = useStore.getState();
  const cards = useSets.getState().cards;
  const cur = playerCurrency();
  const inMoney = (n: number, card: CardData) => convert(n, cardCurrency(card), cur);
  let delta = 0;
  let then = 0;
  let best: { key: string; card: CardData; pct: number; delta: number } | null = null;
  for (const [key, copies] of Object.entries(collection)) {
    const card = cardOrWait(key);
    if (card === "wait") return { ready: false, letter: null };
    if (card === "skip") continue;
    const qty = new Map<Variant, number>();
    for (const c of copies) qty.set(c.variant, (qty.get(c.variant) ?? 0) + c.qty);
    for (const [variant, n] of qty) {
      const old = snap.owned[`${key}|${variant}`];
      const now = marketPrice(card, variant, "trend");
      if (!old || now == null) continue;
      // only the copies already there: a card added since isn't a gain
      const q = Math.min(n, old[1]);
      delta += inMoney((now - old[0]) * q, card);
      then += inMoney(old[0] * q, card);
      if (old[0] >= MIN_THEN) {
        const pct = ((now - old[0]) / old[0]) * 100;
        const d = inMoney(now - old[0], card);
        if (Math.abs(pct) >= 5 && Math.abs(d) >= 0.2 && (!best || Math.abs(d) > Math.abs(best.delta))) best = { key, card, pct, delta: d };
      }
    }
  }
  const tiles: Tile[] = [];
  const pct = then ? (delta / then) * 100 : 0;
  if (Math.abs(delta) >= 0.5 || (Math.abs(pct) >= 1 && Math.abs(delta) >= 0.1)) tiles.push({ kind: "value", delta, pct });
  if (best) tiles.push({ kind: "card", key: best.key, name: best.card.name, img: best.card.img || null, pct: best.pct, delta: best.delta });
  // the wanted cards that got cheaper (5 % or more)
  const cheaper: { key: string; card: CardData; pct: number }[] = [];
  for (const key of wantedKeys()) {
    const old = snap.wants[key];
    const card = cards[key];
    const now = card && marketPrice(card, card.variants[0] ?? "normal", "trend");
    if (!old || old < MIN_THEN || now == null) continue;
    const p = ((now - old) / old) * 100;
    if (p <= -5) cheaper.push({ key, card, pct: p });
  }
  if (cheaper.length) {
    const top = cheaper.sort((a, b) => a.pct - b.pct)[0];
    tiles.push({ kind: "wants", key: top.key, name: top.card.name, img: top.card.img || null, pct: top.pct, count: cheaper.length });
  }
  // never a letter of a release alone: it comes with news of the player's own cards
  if (!tiles.length) return { ready: true, letter: null };
  const release = nextRelease(lang);
  if (release) tiles.push(release);
  return { ready: true, letter: { day: today(), since: snap.at, tiles: tiles.slice(0, 4) } };
}

/** Dev (?courrier): a snapshot of the cards a little off today's prices, so there's a letter to see */
export function devSnap(): Snap | null {
  const s = takeSnap();
  if (!s) return null;
  let i = 0;
  for (const k of Object.keys(s.owned)) s.owned[k][0] = Math.round(s.owned[k][0] * (i++ % 3 ? 0.82 : 1.1) * 100) / 100;
  for (const k of Object.keys(s.wants)) s.wants[k] = Math.round(s.wants[k] * 1.3 * 100) / 100;
  return { ...s, at: Date.now() - 3 * 86_400_000 };
}

/** A snapshot with nothing to say for a long while: taken again (the cards added since go in it) */
export const isStale = (s: Snap) => Date.now() - s.at > STALE;

/** The letters read, pinned on the cork board (the last 4), and the one open */
export const useCourrier = create<{ pins: Letter[]; reading: Letter | null }>(() => ({
  pins: typeof window === "undefined" ? [] : (read<Letter[]>(PINS_KEY) ?? []),
  reading: null,
}));

/** A letter read: pinned on the board (the newest first), out of the envelope */
export function pinLetter(l: Letter) {
  const pins = [l, ...useCourrier.getState().pins.filter((p) => p.day !== l.day)].slice(0, PINS);
  write(PINS_KEY, pins);
  useCourrier.setState({ pins });
}

export const openPinned = (l: Letter) => useCourrier.setState({ reading: l });
