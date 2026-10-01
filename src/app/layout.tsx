import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const vt = VT323({ variable: "--font-vt", weight: "400", subsets: ["latin"] });
const press = Press_Start_2P({ variable: "--font-press", weight: "400", subsets: ["latin"] });

const TITLE = `${SITE_NAME} · ta collection de cartes Pokémon`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["Pokémon", "cartes Pokémon", "collection", "classeur", "TCG", "Cardmarket", "master set", "wishlist"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: SITE_NAME,
    title: TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#221c36",
  width: "device-width",
  initialScale: 1,
  // iPhone zooms in on a text field written smaller than 16 px: the room is a drawn screen, it must stay put.
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${vt.variable} ${press.variable}`}>
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
