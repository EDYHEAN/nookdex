import type { Metadata } from "next";
import { SetIndexView } from "@/components/SetPageView";
import { SITE_NAME } from "@/lib/site";

const description = "Toutes les extensions du JCC Pokémon en français : liste des cartes, raretés et prix Cardmarket mis à jour chaque jour.";

export const metadata: Metadata = {
  title: `Extensions Pokémon : listes des cartes et prix · ${SITE_NAME}`,
  description,
  alternates: { canonical: "/extensions", languages: { fr: "/extensions", en: "/en/sets" } },
  openGraph: { type: "website", url: "/extensions", siteName: SITE_NAME, title: `Extensions Pokémon · ${SITE_NAME}`, description, locale: "fr_FR" },
};

/** The French set pages, by series (their cards are French, whatever the visitor's language). */
export default function Extensions() {
  return <SetIndexView lang="fr" />;
}
