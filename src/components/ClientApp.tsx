"use client";

import dynamic from "next/dynamic";
import { LoaderStill } from "./LoaderStill";

// Everything reads localStorage / canvas / WebAudio: render on the client only.
const App = dynamic(() => import("./App").then((m) => m.App), {
  ssr: false,
  // in the HTML: the loader's picture shows before any script has run
  loading: () => <LoaderStill />,
});

export function ClientApp() {
  return <App />;
}
