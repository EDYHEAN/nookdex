"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { supabase, useCloud } from "./cloud";
import { STUDIO_EMAIL_HASHES } from "./site";
import { BUNDLES, ITEM, ITEMS, itemsOf, lookOf, onSale, type Look, type Slot } from "./skins";

export * from "./skins";

/*
 * The shop, in the browser: who sees it, the skins owned and worn, buying (the catalogue: lib/skins).
 * Until it opens for everyone (NEXT_PUBLIC_SHOP=on in Vercel), the shop and every skin stay hidden in production but for
 * Johan's accounts (STUDIO_EMAIL_HASHES): nothing of it shows for players, an equipped skin included.
 */

const sha256 = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s.trim().toLowerCase())))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

let preloaded = false;
/** The shop's pictures fetched and decoded while the room is idle, so the shop opens at once */
export function preloadShop() {
  if (preloaded || typeof window === "undefined") return;
  preloaded = true;
  const go = () => [...ITEMS, ...BUNDLES].forEach((x) => void Object.assign(new Image(), { src: x.icon }).decode().catch(() => {}));
  if ("requestIdleCallback" in window) window.requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 2000);
}

/** The shop is there: in dev, for everyone once launched, else for Johan's accounts only. */
export function useShopOpen() {
  const email = useCloud((s) => s.email);
  // the address checked last, and whether it's one of Johan's
  const [seen, setSeen] = useState<{ email: string; ok: boolean } | null>(null);
  const always = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SHOP === "on";
  useEffect(() => {
    if (always || !email) return;
    let live = true;
    void sha256(email).then((h) => live && setSeen({ email, ok: STUDIO_EMAIL_HASHES.includes(h) }));
    return () => {
      live = false;
    };
  }, [always, email]);
  return always || (!!email && seen?.email === email && seen.ok);
}

interface SkinState {
  /** the items on (the locker): one per slot, on this device */
  equipped: string[];
  /** items bought (from the server: a bundle counts as its items) */
  owned: string[];
  /** an item or a bundle tried on from the shop: shown over what's worn, not kept */
  trying: string | null;
}

export const useSkins = create<SkinState>()(
  persist(() => ({ equipped: [], owned: [], trying: null }) as SkinState, {
    name: "nookdex:skins",
    version: 1,
    storage: createJSONStorage(() => localStorage),
    partialize: (s) => ({ equipped: s.equipped, owned: s.owned }),
    // v0 wore one whole skin: its items now
    migrate: (old, v) => {
      const o = old as { equipped?: string | string[] | null; owned?: string[] };
      if (v >= 1) return o as SkinState;
      const one = typeof o.equipped === "string" ? itemsOf(o.equipped) : [];
      return { equipped: one, owned: (o.owned ?? []).flatMap(itemsOf), trying: null };
    },
  }),
);

/**
 * Where the shop was left (its tab, the card open, the locker's slot): it opens there again after a try-on. `signIn`
 * opens the card's sign-in box at once (Buy from the try-on strip without an account).
 */
export const shopView: { tab: "shop" | "locker"; open: string | null; slot: Slot | null; signIn: boolean } = { tab: "shop", open: null, slot: null, signIn: false };
/** Where the shop opens next */
export const setShopView = (v: Partial<typeof shopView>) => void Object.assign(shopView, v);

const back = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
/** Back from Stripe's payment page (?shop=paid|back, read before App cleans the address): no loader again. */
export const backFromShop = !!back?.has("shop");
/** What was just paid for (?shop=paid&bought=<id>), if it's in the catalogue */
export const paidFor = back?.get("shop") === "paid" && itemsOf(back.get("bought") ?? "").length ? back.get("bought") : null;

const SEEN_KEY = "nookdex:shop-seen";
/** What's on sale, as one string: a new pack brings the shop button's "new" sticker back */
const saleKey = () => [...BUNDLES, ...ITEMS].filter(onSale).map((x) => x.id).join(",");

/** The shop button's "new" sticker: until the shop is opened once with what's on sale now (per device). */
export function useShopNews(): [boolean, () => void] {
  // the room is client-only: storage can be read at once
  const [news, setNews] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY) !== saleKey();
    } catch {
      return false;
    }
  });
  const seen = useCallback(() => {
    try {
      localStorage.setItem(SEEN_KEY, saleKey());
    } catch {}
    setNews(false);
  }, []);
  return [news, seen];
}

/** Puts an item on (taking off the one in its slot), or takes it off */
export function wear(id: string, on: boolean) {
  const slot = ITEM.get(id)?.slot;
  useSkins.setState((s) => ({ equipped: [...s.equipped.filter((x) => x !== id && ITEM.get(x)?.slot !== slot), ...(on ? [id] : [])], trying: null }));
}

/** The room's look: the items worn and owned, with the one tried on over them; none while the shop is closed. */
export function useLook(): Look | null {
  const open = useShopOpen();
  const { equipped, owned, trying } = useSkins();
  return useMemo(() => {
    if (!open) return null;
    // in dev, ?skin= wears items without buying them (the shop still tells what's bought)
    const worn = equipped.filter((id) => owned.includes(id) || process.env.NODE_ENV !== "production");
    return lookOf([...worn, ...(trying ? itemsOf(trying) : [])]);
  }, [open, equipped, owned, trying]);
}

/**
 * Off to Stripe's payment page for a skin (app/api/shop/checkout): the player's session tells the server who buys.
 * "soon" while the payment isn't set up yet. Buying waives withdrawal (Johan sells), as Stripe's page says by its pay
 * button: the server wants that said (`waiver`).
 */
export async function buySkin(id: string): Promise<"ok" | "soon" | "error"> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return "error";
    const r = await fetch("/api/shop/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ skin: id, lang: document.documentElement.lang === "en" ? "en" : "fr", waiver: true }),
    });
    if (r.status === 503) return "soon";
    const { url } = (await r.json()) as { url?: string };
    if (!r.ok || !url) return "error";
    window.location.href = url;
    return "ok";
  } catch {
    return "error";
  }
}

/** The skins this account bought (Supabase purchases, read by the player only): kept for the next visit. */
export async function refreshOwned() {
  // Johan's accounts own the whole shop (Johan, 2026-10-16)
  const email = useCloud.getState().email;
  if (email && STUDIO_EMAIL_HASHES.includes(await sha256(email))) {
    useSkins.setState({ owned: ITEMS.map((i) => i.id) });
    return;
  }
  const { data, error } = await supabase.from("purchases").select("skin");
  if (error) return;
  useSkins.setState({ owned: [...new Set((data ?? []).flatMap((r: { skin: string }) => itemsOf(r.skin)))] });
}
