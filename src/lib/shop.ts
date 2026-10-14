"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import art from "@/data/skin-art.json";
import { useCloud } from "./cloud";
import type { AmbientMood } from "./sound";
import { STUDIO_EMAIL_HASHES } from "./site";

/*
 * The shop and its skins (docs/skins.md). Paid skins are NookDex's own art, never anything Pokémon.
 * Until it opens for everyone (NEXT_PUBLIC_SHOP=on in Vercel), the shop and every skin stay hidden in production but for
 * Johan's accounts (STUDIO_EMAIL_HASHES): nothing of it shows for players, an equipped skin included.
 */

/** A box in the painted room (scene px) */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A painted thing set in the room: its picture (cut out of a Gemini sheet), where, turned how much */
export interface Placed extends Box {
  src: string;
  /** degrees */
  rot?: number;
  /** a candle's flame or a lantern: a warm glow flickers around it at night */
  glow?: boolean;
  /** it stands on something: a soft shadow under it */
  shadow?: boolean;
  /** flames that dance over the painted ones: the bottom of each, and its height (scene px) */
  flames?: { x: number; y: number; h: number }[];
}

/** What a skin paints over the room: pictures cut by scripts/build-skins, placed in src/data/skin-art.json */
export interface SkinArt {
  /** the view through the window, night and day */
  sky?: string;
  skyDay?: string;
  /** decorations standing in the room, drawn over the painted backdrop and under the binders */
  decor?: Placed[];
  /** worn by Warwick, asleep and awake */
  hat?: { sleep: Placed; awake: Placed };
  /** Warwick himself in costume, asleep and awake (his pictures swapped) */
  cat?: { sleep: Placed; awake: Placed };
  /** a spider that drops down its thread from (x, top) to `drop` now and then, and climbs back */
  spider?: { src: string; w: number; h: number; x: number; top: number; drop: number };
}

export interface LavaTheme {
  name: string;
  nameEn: string;
  fill: string;
  light: string;
  line: string;
  glow: string;
}

export interface Skin {
  id: string;
  name: { fr: string; en: string };
  blurb: { fr: string; en: string };
  /** what's in it, one line each */
  contents: { fr: string; en: string }[];
  /** euros */
  price: number;
  /** the lava lamp's colour while it's worn (first in the lamp's cycle) */
  lava?: LavaTheme;
  /** a light laid over the whole room (CSS colour, soft-light) */
  tint?: string;
  /** the radio's tune while it's worn (lib/sound) */
  music?: AmbientMood;
  art: SkinArt;
}

const ART = art as Record<string, SkinArt>;

export const SKINS: Skin[] = [
  {
    id: "halloween",
    name: { fr: "Halloween", en: "Halloween" },
    blurb: { fr: "Le bureau se déguise : citrouilles, chauves-souris et pleine lune orange.", en: "The desk dresses up: pumpkins, bats and an orange full moon." },
    contents: [
      { fr: "Une nuit d'Halloween derrière la fenêtre", en: "A Halloween night through the window" },
      { fr: "Citrouilles, bougies et toiles d'araignée", en: "Pumpkins, candles and cobwebs" },
      { fr: "Warwick en sorcier", en: "Warwick as a witch" },
      { fr: "La lampe à lave citrouille", en: "The pumpkin lava lamp" },
      { fr: "Une radio lofi d'Halloween", en: "A Halloween lofi radio" },
    ],
    price: 2.99,
    tint: "rgba(255, 128, 40, 0.22)",
    music: "spooky",
    lava: { name: "citrouille", nameEn: "pumpkin", fill: "#ff8a1f", light: "#ffd08a", line: "#5a2a08", glow: "rgba(255,140,40,0.34)" },
    art: ART.halloween ?? {},
  },
];

export const SKIN = new Map(SKINS.map((s) => [s.id, s]));

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
  /** skins bought (from the server; every one in dev) */
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

export const ownsSkin = (id: string, owned: string[]) => process.env.NODE_ENV !== "production" || owned.includes(id);

/** The skin the room wears: the one tried on, else the one equipped and owned; none while the shop is closed. */
export function useActiveSkin(): Skin | null {
  const open = useShopOpen();
  const { equipped, owned, trying } = useSkins();
  if (!open) return null;
  const id = trying ?? (equipped && ownsSkin(equipped, owned) ? equipped : null);
  return (id && SKIN.get(id)) || null;
}

/** "2,99 €" / "€2.99" */
export const formatEuros = (n: number, lang: "fr" | "en") =>
  new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-IE", { style: "currency", currency: "EUR" }).format(n);
