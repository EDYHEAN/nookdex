import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import { serverLang } from "@/lib/serverLang";
import { SITE_DESCRIPTION, SITE_DESCRIPTION_EN, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const vt = VT323({ variable: "--font-vt", weight: "400", subsets: ["latin"] });
const press = Press_Start_2P({ variable: "--font-press", weight: "400", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const en = (await serverLang()) === "en";
  const title = en ? `${SITE_NAME} · your Pokémon card collection` : `${SITE_NAME} · ta collection de cartes Pokémon`;
  const description = en ? SITE_DESCRIPTION_EN : SITE_DESCRIPTION;
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    applicationName: SITE_NAME,
    keywords: en
      ? ["Pokémon", "Pokémon cards", "collection", "binder", "TCG", "TCGplayer", "master set", "wishlist"]
      : ["Pokémon", "cartes Pokémon", "collection", "classeur", "TCG", "Cardmarket", "master set", "wishlist"],
    alternates: { canonical: "/" },
    openGraph: { type: "website", locale: en ? "en_GB" : "fr_FR", url: "/", siteName: SITE_NAME, title, description },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  themeColor: "#221c36",
  width: "device-width",
  initialScale: 1,
  // iPhone zooms in on a text field written smaller than 16 px: the room is a drawn screen, it must stay put.
  maximumScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={await serverLang()} className={`${vt.variable} ${press.variable}`}>
      <body>
        {/* card scans come from TCGdex: open the connection early */}
        <link rel="preconnect" href="https://assets.tcgdex.net" />
        <link rel="dns-prefetch" href="https://assets.tcgdex.net" />
        {children}
        {/* Vercel Web Analytics: visitors and page views, no cookies */}
        <Analytics />
      </body>
    </html>
  );
}
