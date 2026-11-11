"use client";

import { useSyncExternalStore } from "react";

/**
 * « Installer l'app »: NookDex on the home screen, full screen, its own icon (Chrome on Android even makes it a WebAPK).
 * Chrome shows its own install banner only when it decides to (and stays quiet for months once dismissed): a player's
 * friend couldn't find it (a player's mail, 2026-11-11). Chrome and Edge hand the page that prompt (`beforeinstallprompt`):
 * kept here, our button opens it whenever the player wants. Safari (iPhone) and Firefox have no such event: the button
 * shows the steps by hand instead. nookdex.com passed Chromium's installability check (2026-11-11): no service worker needed.
 */

interface PromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** prompt: Chrome's own window can open; ios / android: steps by hand; installed: running as the app; none: nothing to offer */
export type InstallWay = "prompt" | "ios" | "android" | "installed" | "none";

let deferred: PromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/** Listens from the first render on (ClientApp's Audience): the event can fire before the room is up. */
export function watchInstall() {
  const onPrompt = (e: Event) => {
    // keep it for our button instead of Chrome's mini bar
    e.preventDefault();
    deferred = e as PromptEvent;
    changed();
  };
  const onInstalled = () => {
    installed = true;
    deferred = null;
    changed();
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

function standalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function wayNow(): InstallWay {
  if (installed || standalone()) return "installed";
  if (deferred) return "prompt";
  const ua = navigator.userAgent;
  // an iPad says it's a Mac: told apart by its touch screen
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  // Firefox, Samsung Internet… on a phone: their menu has « Installer » / « Ajouter à l'écran d'accueil »
  if (/Android/.test(ua)) return "android";
  return "none";
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** How this device installs NookDex (`none` on the server and on a computer without Chrome's prompt). */
export function useInstallWay(): InstallWay {
  return useSyncExternalStore(subscribe, wayNow, () => "none");
}

/** Opens Chrome's install window; true if the player said yes. */
export async function promptInstall() {
  const e = deferred;
  if (!e) return false;
  // a prompt can be shown once: Chrome sends a new event if the player says no
  deferred = null;
  changed();
  await e.prompt();
  const { outcome } = await e.userChoice;
  return outcome === "accepted";
}
