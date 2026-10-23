"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { pocketsOf, wantsOf, wishBinders } from "./binders";
import { setIdOfCard, useSets } from "./catalog";
import { supabase } from "./cloud";
import { funnelStep } from "./funnel";
import { currentLang } from "./lang";
import { SITE_DOMAIN } from "./site";
import { type WantMode, useStore } from "./store";
import type { Copy, SetData, UserBinder, Variant } from "./types";

/**
 * The player's public list, nookdex.com/c/<slug> (2026-10-23): « Je cherche » (the cards missing from the set binders they
 * picked, and their wishlists' cards) and « J'échange » (the doubles they ticked), to paste in a Facebook group's
 * "recherche / propose" thread or a Discord. It stays up to date by itself: a change of the collection sends the list again
 * a few seconds later. Card ids only go out (the page reads names, scans and prices from the sets' files), with the pseudo.
 * Without an account the list is the player's by a secret token kept in this browser (Supabase keeps its hash); with one,
 * by the account, and the slug rides the save (another device signed in updates the same list). docs/supabase.sql: shares.
 */

/** Lists the server takes at most (share_put says the same) */
const MAX_WANT = 1500;
const MAX_GIVE = 500;
/** A few seconds after the last change: ticking ten doubles in a row makes one write */
const DEBOUNCE = 5000;

const TOKEN_KEY = "nookdex:share-token";
const SENT_KEY = "nookdex:share-sent";

export type GiveItem = [key: string, variant: Variant, n: number];
export interface ShareData {
  v: 1;
  want: string[];
  give: GiveItem[];
}

/** A double: a card's version owned more than once. `ticked` of its `extra` copies are offered (never more than there are). */
export interface Double {
  key: string;
  variant: Variant;
  extra: number;
  ticked: number;
  /** its set follows « tout · les nouveaux suivent » */
  ruled: boolean;
}

/** The copies beyond the first of each version (a reverse and a plain one are two cards to a master-set collector). */
export function doublesOf(collection: Record<string, Copy[]>, tradable: Record<string, number>, rules: Record<string, true> = {}): Double[] {
  const out: Double[] = [];
  for (const [key, copies] of Object.entries(collection)) {
    // a set under « tout · les nouveaux suivent »: every double of it, but for the exceptions set by hand
    const ruled = !!rules[setIdOfCard(key) ?? ""];
    const qty = new Map<Variant, number>();
    for (const c of copies) qty.set(c.variant, (qty.get(c.variant) ?? 0) + c.qty);
    for (const [variant, n] of qty) {
      if (n < 2) continue;
      const set = tradable[`${key}|${variant}`];
      out.push({ key, variant, extra: n - 1, ticked: Math.min(n - 1, set ?? (ruled ? n - 1 : 0)), ruled });
    }
  }
  return out;
}

/**
 * The cards wanted (« je cherche »): the missing cards of the set binders in « toutes » (the default), the ★ cards not owned
 * (but those of a set binder in « aucune »), the wishlists' ghosts. A card the player gets leaves by itself. `ready` is
 * false while a set binder's file is still loading: its missing cards would be left out.
 */
export function wantedOf(
  binders: UserBinder[],
  collection: Record<string, Copy[]>,
  sets: Record<string, SetData>,
  modes: Record<string, WantMode>,
  stars: Record<string, number>,
) {
  const keys = new Set<string>();
  let ready = true;
  const off = new Set<string>();
  for (const b of binders) {
    if (b.kind !== "set") continue;
    const mode = modes[b.setId] ?? "all";
    if (mode === "none") off.add(b.setId);
    if (mode !== "all") continue;
    const set = sets[b.setId];
    if (!set) {
      ready = false;
      continue;
    }
    for (const card of set.cards) if (!card.unavailable && !collection[card.id]?.length) keys.add(card.id);
  }
  for (const key of Object.keys(stars)) if (!collection[key]?.length && !off.has(setIdOfCard(key) ?? "")) keys.add(key);
  for (const b of wishBinders(binders)) {
    const kept = pocketsOf(b.id, collection);
    for (const [pocket, key] of wantsOf(b)) if (!kept.has(pocket)) keys.add(key);
  }
  return { keys: [...keys], ready };
}

/** The ★ cards still wanted (not owned yet): the search's badge, « dont 12 ★ à la carte » */
export const starsWanted = (stars: Record<string, number>, collection: Record<string, Copy[]>) =>
  Object.keys(stars).filter((k) => !collection[k]?.length);

/** What the list holds today, or null when it can't be told yet (a set file loading) or there's no list. */
export function shareData(): ShareData | null {
  const s = useStore.getState();
  const share = s.share;
  if (!share) return null;
  const wanted = share.want ? wantedOf(s.binders, s.collection, useSets.getState().sets, s.wantModes, s.stars) : { keys: [], ready: true };
  if (!wanted.ready) return null;
  const give = share.give
    ? doublesOf(s.collection, s.tradable, s.tradeRules)
        .filter((d) => d.ticked > 0)
        .map((d): GiveItem => [d.key, d.variant, d.ticked])
    : [];
  return { v: 1, want: wanted.keys.slice(0, MAX_WANT), give: give.slice(0, MAX_GIVE) };
}

export const shareUrl = (slug: string) => (process.env.NODE_ENV === "production" ? `https://${SITE_DOMAIN}/c/${slug}` : `${location.origin}/c/${slug}`);

/** The list being sent: the OS shows it */
export const useShareSync = create<{ state: "idle" | "saving" | "saved" | "error"; error: string | null; at: number | null }>(() => ({
  state: "idle",
  error: null,
  at: null,
}));

function token(): string {
  try {
    const kept = localStorage.getItem(TOKEN_KEY);
    if (kept && kept.length >= 32) return kept;
    const made = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(TOKEN_KEY, made);
    return made;
  } catch {
    // no storage (a private window): a token for this visit only; an account still owns the list
    return (window as unknown as { __shareToken?: string }).__shareToken ??= crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  }
}

const readSent = () => {
  try {
    return localStorage.getItem(SENT_KEY);
  } catch {
    return null;
  }
};
const writeSent = (v: string | null) => {
  try {
    if (v) localStorage.setItem(SENT_KEY, v);
    else localStorage.removeItem(SENT_KEY);
  } catch {}
};

interface PutArgs {
  p_slug: string | null;
  p_token: string;
  p_name: string;
  p_lang: string;
  p_prices: boolean;
  p_data: ShareData;
}

/**
 * Dev only: Supabase doesn't have share_put yet (Johan pastes docs/supabase.sql once the PR is tested): the lists are kept
 * by /api/share-dev in .cache/share-dev, which the page reads the same way.
 */
const missingFunction = (e: { code?: string } | null) => process.env.NODE_ENV !== "production" && e?.code === "PGRST202";

async function put(args: PutArgs): Promise<{ slug: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("share_put", args);
  if (!error) return { slug: data as string, error: null };
  if (missingFunction(error)) {
    const r = await fetch("/api/share-dev", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args) });
    return r.ok ? { slug: ((await r.json()) as { slug: string }).slug, error: null } : { slug: null, error: `dev ${r.status}` };
  }
  return { slug: null, error: error.message };
}

let timer: ReturnType<typeof setTimeout> | undefined;
let pending = false;
let busy = false;

/**
 * Sends the list if it changed since the last time (or `force`). Returns its slug once the server has it. A list made
 * elsewhere (an export imported, someone else's save) isn't this browser's: a new one is made instead.
 */
export async function pushShare(force = false): Promise<string | null> {
  clearTimeout(timer);
  pending = false;
  const s = useStore.getState();
  const data = shareData();
  if (busy) {
    // a write is on its way: this change goes in the next one
    schedule();
    return s.share?.slug ?? null;
  }
  if (!s.share || !data) return s.share?.slug ?? null;
  const args: PutArgs = {
    p_slug: s.share.slug,
    p_token: token(),
    p_name: (s.profile?.name ?? "").trim().slice(0, 24),
    p_lang: currentLang(),
    p_prices: s.share.prices,
    p_data: data,
  };
  const content = JSON.stringify([args.p_name, args.p_lang, args.p_prices, data]);
  if (!force && s.share.slug && readSent() === `${s.share.slug}:${content}`) return s.share.slug;
  busy = true;
  useShareSync.setState({ state: "saving", error: null });
  let res = await put(args);
  if (res.error?.includes("not yours")) res = await put({ ...args, p_slug: null });
  busy = false;
  if (res.error || !res.slug) {
    // one write every 10 s on the server: try again just after
    if (res.error?.includes("too soon")) schedule(11000);
    useShareSync.setState({ state: "error", error: res.error });
    return null;
  }
  writeSent(`${res.slug}:${content}`);
  if (res.slug !== useStore.getState().share?.slug) {
    useStore.getState().setShare({ slug: res.slug });
    funnelStep("share");
  }
  useShareSync.setState({ state: "saved", error: null, at: Date.now() });
  return res.slug;
}

function schedule(ms = DEBOUNCE) {
  clearTimeout(timer);
  pending = true;
  timer = setTimeout(() => void pushShare(), ms);
}

/** « Supprimer mon lien »: the page is gone, the ticks stay (a new list starts from them). */
export async function removeShare() {
  clearTimeout(timer);
  pending = false;
  const slug = useStore.getState().share?.slug;
  if (slug) {
    const { error } = await supabase.rpc("share_delete", { p_slug: slug, p_token: token() });
    if (missingFunction(error)) await fetch(`/api/share-dev?slug=${slug}`, { method: "DELETE" });
  }
  writeSent(null);
  useStore.getState().setShare(null);
  useShareSync.setState({ state: "idle", error: null, at: null });
}

let started = false;

/** Keeps the list up to date: what it shows changed (or a set file came), it's sent again a few seconds later. */
export function startShareSync() {
  if (started) return;
  started = true;
  useStore.subscribe((s, prev) => {
    if (!s.share?.slug) return;
    if (s.collection === prev.collection && s.binders === prev.binders && s.tradable === prev.tradable && s.tradeRules === prev.tradeRules && s.stars === prev.stars && s.wantModes === prev.wantModes && s.share === prev.share && s.profile === prev.profile) return;
    schedule();
  });
  useSets.subscribe((s, prev) => {
    if (s.sets !== prev.sets && useStore.getState().share?.slug) schedule();
  });
  // leaving with a change still waiting: send it now
  window.addEventListener("pagehide", () => {
    if (pending) void pushShare();
  });
  if (useStore.getState().share?.slug) schedule();
}

/**
 * The trade binder on the shelf (Johan, 2026-10-23): it comes once there is something to put in it, a first double or a
 * first wished card (or a list already made), and its badge counts the cards « à échanger ».
 */
export function useTradeShelf(): { shown: boolean; count: number } {
  const collection = useStore((s) => s.collection);
  const tradable = useStore((s) => s.tradable);
  const rules = useStore((s) => s.tradeRules);
  const binders = useStore((s) => s.binders);
  const listed = useStore((s) => !!s.share);
  const starred = useStore((s) => Object.keys(s.stars).length > 0);
  const doubles = useMemo(() => doublesOf(collection, tradable, rules), [collection, tradable, rules]);
  const wished = useMemo(() => starred || wishBinders(binders).some((b) => Object.keys(b.wants ?? {}).length > 0), [binders, starred]);
  return { shown: listed || wished || doubles.length > 0, count: doubles.filter((d) => d.ticked > 0).length };
}
