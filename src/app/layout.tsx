import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";

const vt = VT323({ variable: "--font-vt", weight: "400", subsets: ["latin"] });
const press = Press_Start_2P({ variable: "--font-press", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PokéPocket",
  description: "Ta collection de cartes Pokémon, rangée dans des classeurs, sur ton bureau.",
};

export const viewport: Viewport = {
  themeColor: "#221c36",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${vt.variable} ${press.variable}`}>
      <body>
        {children}
        {/* Vercel Web Analytics: visitors and page views, no cookies */}
        <Analytics />
      </body>
    </html>
  );
}
