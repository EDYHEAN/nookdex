import type { Metadata } from "next";
import { HomeText } from "@/components/HomeText";
import { SITE_DESCRIPTION_EN, SITE_NAME } from "@/lib/site";

const title = `${SITE_NAME} · your Pokémon card collection`;

// The English home: same room, English text and title whatever the browser says (lib/resolveLang starts the room in English).
export const metadata: Metadata = {
  title,
  description: SITE_DESCRIPTION_EN,
  alternates: { canonical: "/en", languages: { fr: "/", en: "/en", "x-default": "/" } },
  openGraph: { type: "website", locale: "en_GB", url: "/en", siteName: SITE_NAME, title, description: SITE_DESCRIPTION_EN },
};

export default function HomeEn() {
  return <HomeText en />;
}
