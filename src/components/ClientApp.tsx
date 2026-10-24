"use client";

import dynamic from "next/dynamic";
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

export function ClientApp() {
  return <App />;
}
