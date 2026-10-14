"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { supabase, useCloud } from "./cloud";
import { STUDIO_EMAIL_HASHES } from "./site";
import { SKIN, type Skin } from "./skins";

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
  /** the skin worn (one at a time), on this device */
  equipped: string | null;
  /** skins bought (from the server) */
  owned: string[];
  /** tried on from the shop: shown, not kept */
  trying: string | null;
}

export const useSkins = create<SkinState>()(
  persist(() => ({ equipped: null, owned: [], trying: null }) as SkinState, {
    name: "nookdex:skins",
    storage: createJSONStorage(() => localStorage),
    partialize: (s) => ({ equipped: s.equipped, owned: s.owned }),
  }),
);

export const ownsSkin = (id: string, owned: string[]) => owned.includes(id);

/** The skin the room wears: the one tried on, else the one equipped and owned; none while the shop is closed. */
export function useActiveSkin(): Skin | null {
  const open = useShopOpen();
  const { equipped, owned, trying } = useSkins();
  if (!open) return null;
  // in dev, ?skin= wears one without buying it (the shop still tells what's bought)
  const wearable = equipped && (ownsSkin(equipped, owned) || process.env.NODE_ENV !== "production");
  const id = trying ?? (wearable ? equipped : null);
  return (id && SKIN.get(id)) || null;
}


/**
 * Off to Stripe's payment page for a skin (app/api/shop/checkout): the player's session tells the server who buys.
 * "soon" while the payment isn't set up yet.
 */
export async function buySkin(id: string): Promise<"ok" | "soon" | "error"> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return "error";
    const r = await fetch("/api/shop/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ skin: id, lang: document.documentElement.lang === "en" ? "en" : "fr" }),
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
  const { data, error } = await supabase.from("purchases").select("skin");
  if (error) return;
  useSkins.setState({ owned: [...new Set((data ?? []).map((r: { skin: string }) => r.skin))] });
}
