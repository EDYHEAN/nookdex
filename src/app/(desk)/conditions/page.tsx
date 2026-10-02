import type { Metadata } from "next";
import { serverLang } from "@/lib/serverLang";
import { LegalPage } from "@/components/LegalPage";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await serverLang()) === "en";
  return en ? { title: `Terms of use · ${SITE_NAME}`, alternates: { canonical: "/conditions" } } : { title: `Conditions d'utilisation · ${SITE_NAME}`, alternates: { canonical: "/conditions" } };
}

function Fr() {
  return (
    <LegalPage path="/conditions" title="Conditions d'utilisation" updated="30 septembre 2026">
      <p>{SITE_NAME} est gratuit. En l&apos;utilisant, tu acceptes ces quelques règles.</p>

      <h2>Le service</h2>
      <p>
        {SITE_NAME} sert à suivre ta collection de cartes. Il est fourni tel quel, sans garantie : le site peut changer, être indisponible ou
        s&apos;arrêter. Exporte ta collection de temps en temps depuis NookDex OS → Sauvegarde.
      </p>

      <h2>Les prix</h2>
      <p>
        Les prix affichés viennent de Cardmarket (cartes françaises et japonaises) et de TCGplayer (cartes anglaises) via{" "}
        <a href="https://tcgdex.dev">TCGdex</a>. Ils sont indicatifs et peuvent être en retard ou faux :
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
        Une question ? Écris-nous via le <Link href="/contact">formulaire de contact</Link>.
      </p>
    </LegalPage>
  );
}

function En() {
  return (
    <LegalPage path="/conditions" title="Terms of use" updated="1 October 2026" en>
      <p>{SITE_NAME} is free. By using it, you accept these few rules.</p>

      <h2>The service</h2>
      <p>
        {SITE_NAME} helps you track your card collection. It comes as is, with no warranty: the site may change, be unavailable or stop. Export
        your collection now and then from NookDex OS → Save.
      </p>

      <h2>Prices</h2>
      <p>
        Prices come from Cardmarket (French and Japanese cards) and TCGplayer (English cards; Cardmarket, converted, for those TCGplayer doesn&apos;t
        sell) through{" "}
        <a href="https://tcgdex.dev">TCGdex</a>. They are a guide and may be late or wrong: don&apos;t use them as an official valuation.
      </p>

      <h2>Your account</h2>
      <p>One account per person, for your own collection. No abuse (bots, overloading the service). An account that abuses the service may be deleted.</p>

      <h2>Pokémon</h2>
      <p>
        {SITE_NAME} is an unofficial fan project, not affiliated with Nintendo, Creatures, GAME FREAK or The Pokémon Company. Pokémon and the card
        names and pictures belong to their owners.
      </p>

      <h2>Contact</h2>
      <p>
        A question? Write to us through the <Link href="/contact">contact form</Link>.
      </p>
    </LegalPage>
  );
}

export default async function Terms() {
  return (await serverLang()) === "en" ? <En /> : <Fr />;
}
