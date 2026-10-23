"use client";

// The funnel (Johan, 2026-10-17): since the welcome no longer asks for an account, the players without one were out of
// sight. A random id per device (no name, no e-mail, no IP kept) ties its visits together: where it first came from
// (utm_source, else the referrer's site, else "direct"), the page it landed on, the days it came back, and the steps it
// reached. Supabase `funnel` behind `funnel_ping` (docs/supabase.sql); read by `funnel_stats`, counts only. A pure
// audience measure of the site's own (no consent needed: the id lives 13 months at most, the rows as long).

import { supabase } from "@/lib/cloud";
import { useStore } from "@/lib/store";

export type FunnelStep = "profile" | "binder" | "cards10" | "account" | "game" | "share" | "tour_done";

const DEVICE_KEY = "nookdex:device";
const SENT_KEY = "nookdex:funnel";
/** an id is drawn again after 13 months (the audience-measure rule) */
const ID_LIFE = 395 * 864e5;

interface Sent {
  /** the last day a visit was sent (YYYY-MM-DD, local) */
  day: string;
  steps: FunnelStep[];
  source: string;
  landing: string;
}

/** Big sources by one name: their apps and mobile sites send odd referrers (l.instagram.com, com.linkedin.android…) */
const SOURCES: [RegExp, string][] = [
  [/instagram/, "instagram"],
  [/linkedin|lnkd\.in/, "linkedin"],
  [/facebook|fb\.com/, "facebook"],
  [/tiktok/, "tiktok"],
  [/(^|\.)t\.co$|twitter|x\.com/, "x"],
  [/reddit/, "reddit"],
  [/youtube|youtu\.be/, "youtube"],
  [/chatgpt|openai/, "chatgpt"],
  [/perplexity/, "perplexity"],
  [/googlequicksearchbox|(^|\.)google\./, "google"],
  [/bing\./, "bing"],
  [/duckduckgo/, "duckduckgo"],
  [/discord/, "discord"],
];

function sourceOf() {
  const utm = new URLSearchParams(location.search).get("utm_source");
  if (utm) return utm.toLowerCase().slice(0, 40);
  let host = "";
  try {
    host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
  } catch {}
  if (!host || host.endsWith("nookdex.com")) return "direct";
  return SOURCES.find(([re]) => re.test(host))?.[1] ?? host.slice(0, 40);
}

/**
 * A search engine rendering the page runs its scripts too: Googlebot crawling the card pages counted as 817 new
 * "direct" devices in a week (report of 2026-10-19, all en-US, landing on a card page, never back). Robots aren't counted.
 */
const ROBOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly|bingpreview/i;
const live = () =>
  process.env.NODE_ENV === "production" && location.hostname.endsWith("nookdex.com") && !navigator.webdriver && !ROBOT.test(navigator.userAgent);

function device(): string | null {
  try {
    const kept = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? "null") as { id: string; at: number } | null;
    if (kept?.id && Date.now() - kept.at < ID_LIFE) return kept.id;
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    localStorage.setItem(DEVICE_KEY, JSON.stringify({ id, at: Date.now() }));
    localStorage.removeItem(SENT_KEY);
    return id;
  } catch {
    return null;
  }
}

function sent(): Sent {
  try {
    const s = JSON.parse(localStorage.getItem(SENT_KEY) ?? "null") as Sent | null;
    if (s) return s;
  } catch {}
  // the first visit: where it came from, where it landed (a player from before the funnel: "existing", not a newcomer)
  return { day: "", steps: [], source: useStore.getState().profile ? "existing" : sourceOf(), landing: location.pathname.slice(0, 120) };
}

function save(s: Sent) {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(s));
  } catch {}
}

async function ping(s: Sent, step?: FunnelStep) {
  const id = device();
  if (!id) return;
  await supabase.rpc("funnel_ping", { p_device: id, p_source: s.source, p_landing: s.landing, p_lang: navigator.language.slice(0, 5), p_step: step ?? null });
}

/** A visit: once a day per device. */
export function funnelVisit() {
  // (the id first: a new one starts over what was sent)
  if (!live() || !device()) return;
  const s = sent();
  const today = new Date().toLocaleDateString("sv-SE");
  if (s.day === today) return;
  s.day = today;
  save(s);
  void ping(s).catch(() => {});
}

/**
 * A click on an Amazon link (the affiliate links, lib/amazon): counted by day and by the page it was on (its first path
 * segment: calendrier-des-sorties, extensions, blog), nothing else (Supabase amazon_click). The sales are in Johan's
 * Amazon dashboard (no API for it); this says which links get clicked.
 */
export function watchAmazonClicks() {
  const on = (e: MouseEvent) => {
    if (!(e.target as Element | null)?.closest?.('a[href*="amazon.fr"]') || !live()) return;
    const place = (location.pathname.split("/")[1] || "home").slice(0, 40);
    void supabase.rpc("amazon_click", { p_place: place }).then(
      () => {},
      () => {},
    );
  };
  // a middle click opens the link too
  document.addEventListener("click", on, true);
  document.addEventListener("auxclick", on, true);
  return () => {
    document.removeEventListener("click", on, true);
    document.removeEventListener("auxclick", on, true);
  };
}

/** A step reached: sent once per device. */
export function funnelStep(step: FunnelStep) {
  if (!live() || !device()) return;
  const s = sent();
  if (s.steps.includes(step)) return;
  s.steps.push(step);
  save(s);
  void ping(s, step).catch(() => {});
}
