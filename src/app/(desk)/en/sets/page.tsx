import type { Metadata } from "next";
import { SetIndexView } from "@/components/SetPageView";
import { SITE_NAME } from "@/lib/site";

const description = "Every Pokémon TCG set in English: card lists, rarities and TCGplayer prices updated every day.";

export const metadata: Metadata = {
  title: `Pokémon TCG sets: card lists and prices · ${SITE_NAME}`,
  description,
  alternates: { canonical: "/en/sets", languages: { fr: "/extensions", en: "/en/sets" } },
  openGraph: { type: "website", url: "/en/sets", siteName: SITE_NAME, title: `Pokémon TCG sets · ${SITE_NAME}`, description, locale: "en_GB" },
};

/** The English set pages, by series. */
export default function Sets() {
  return <SetIndexView lang="en" />;
}
