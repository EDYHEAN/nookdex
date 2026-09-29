"use client";

import dynamic from "next/dynamic";

// Everything reads localStorage / canvas / WebAudio: render on the client only.
const App = dynamic(() => import("./App").then((m) => m.App), {
  ssr: false,
  loading: () => <div style={{ position: "fixed", inset: 0, background: "#221c36" }} />,
});

export function ClientApp() {
  return <App />;
}
