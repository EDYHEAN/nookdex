"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isRoomless } from "@/lib/roomless";
import { LoaderStill } from "./LoaderStill";

/**
 * The app's scripts (~200 KB) are asked for once the loader's logo has painted, not alongside it: the logo is the page's LCP,
 * and a phone on a slow line spent seconds on the scripts before showing it. The logo is in the HTML and preloaded, so this
 * only puts the scripts behind it in the queue (they follow a frame later), never behind anything else.
 */
function afterLogoPaint() {
  return new Promise<void>((resolve) => {
    const img = document.querySelector<HTMLImageElement>("img[data-logo]");
    const go = () => requestAnimationFrame(() => setTimeout(resolve, 60));
    if (!img || (img.complete && img.naturalWidth > 0)) return go();
    img.addEventListener("load", go, { once: true });
    img.addEventListener("error", go, { once: true });
    setTimeout(resolve, 3000);
  });
}

// Everything reads localStorage / canvas / WebAudio: render on the client only.
const App = dynamic(() => afterLogoPaint().then(() => import("./App")).then((m) => m.App), {
  ssr: false,
  // in the HTML: the loader's picture shows before any script has run
  loading: () => <LoaderStill />,
});

/**
 * The room, except on a page drawn without it (lib/roomless: the Amazon pages): there it waits until the visitor goes to the
 * desk (« Mon bureau »), and then stays, like for a visitor who came from the desk (back to it without a reload).
 */
export function ClientApp() {
  const path = usePathname();
  const [room, setRoom] = useState(() => !isRoomless(path));
  if (!room && !isRoomless(path)) setRoom(true);
  return (
    <>
      <Audience />
      {room && <App />}
    </>
  );
}

/**
 * The funnel's visit and the Amazon clicks (lib/funnel) on every page, room or not: the Amazon pages are drawn without
 * it. Their own chunk, asked for once the page is up.
 */
function Audience() {
  useEffect(() => {
    let stops: (() => void)[] = [];
    let gone = false;
    void import("@/lib/funnel").then((f) => {
      if (!gone) stops = [f.funnelVisit(), f.watchAmazonClicks()].filter((s): s is () => void => !!s);
    });
    return () => {
      gone = true;
      stops.forEach((s) => s());
    };
  }, []);
  return null;
}
