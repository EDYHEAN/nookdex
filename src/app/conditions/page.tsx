import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Conditions d'utilisation · ${SITE_NAME}`,
  alternates: { canonical: "/conditions" },
};

export default function Terms() {
  return (
    <LegalPage title="Conditions d'utilisation" updated="30 septembre 2026">
      <p>{SITE_NAME} est gratuit. En l&apos;utilisant, tu acceptes ces quelques règles.</p>

      <h2>Le service</h2>
      <p>
        {SITE_NAME} sert à suivre ta collection de cartes. Il est fourni tel quel, sans garantie : le site peut changer, être indisponible ou
        s&apos;arrêter. Exporte ta collection de temps en temps depuis NookDex OS → Sauvegarde.
      </p>

      <h2>Les prix</h2>
      <p>
        Les prix affichés viennent de Cardmarket via <a href="https://tcgdex.dev">TCGdex</a>. Ils sont indicatifs et peuvent être en retard ou faux :
        ne t&apos;en sers pas comme d&apos;une estimation officielle.
      </p>

      <h2>Ton compte</h2>
      <p>
        Un compte par personne, pour ta propre collection. Pas d&apos;usage abusif (robots, surcharge du service). Un compte qui abuse du service peut
        être supprimé.
      </p>

      <h2>Pokémon</h2>
      <p>
        {SITE_NAME} est un projet de fan, non officiel, sans lien avec Nintendo, Creatures, GAME FREAK ou The Pokémon Company. Pokémon et les noms et
        images des cartes appartiennent à leurs propriétaires.
      </p>

      <h2>Contact</h2>
      <p>
        Une question ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalPage>
  );
}
