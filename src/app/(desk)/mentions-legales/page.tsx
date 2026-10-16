import type { Metadata } from "next";
import Link from "next/link";
import { serverLang } from "@/lib/serverLang";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL, MANAGED_PAYMENTS, SITE_DOMAIN, SITE_NAME } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await serverLang()) === "en";
  return en ? { title: `Legal notice · ${SITE_NAME}`, alternates: { canonical: "/mentions-legales" } } : { title: `Mentions légales · ${SITE_NAME}`, alternates: { canonical: "/mentions-legales" } };
}

function Fr() {
  return (
    <LegalPage path="/mentions-legales" title="Mentions légales" updated="16 octobre 2026">
      <h2>Éditeur</h2>
      <p>
        {SITE_DOMAIN} est édité par {LEGAL.name}, entrepreneur individuel (micro-entreprise).
        <br />
        SIRET : {LEGAL.siret}
        <br />
        Adresse : {LEGAL.address}
        <br />
        E-mail : <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>, ou le <Link href="/contact">formulaire de contact</Link>.
      </p>
      <p>Directeur de la publication : {LEGAL.name}.</p>

      <h2>Hébergement</h2>
      <p>
        Le site est hébergé par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (<a href="https://vercel.com">vercel.com</a>).
        Les comptes et les sauvegardes sont stockés chez Supabase (<a href="https://supabase.com">supabase.com</a>), voir les{" "}
        <Link href="/confidentialite">règles de confidentialité</Link>.
      </p>

      <h2>Boutique</h2>
      <p>
        {MANAGED_PAYMENTS
          ? "Les objets de décoration de la boutique sont vendus via Link, le service de paiement de Stripe, qui encaisse le paiement et envoie les reçus."
          : `Les objets de décoration de la boutique sont vendus par ${LEGAL.name} (TVA non applicable, article 293 B du CGI), paiement par Stripe.`}{" "}
        Voir les <Link href="/conditions-de-vente">conditions de vente</Link>.
      </p>

      <h2>Propriété</h2>
      <p>
        Les illustrations, le code et les textes de {SITE_NAME} appartiennent à leur éditeur, sauf mention contraire (crédits du jeu, données de
        cartes de <a href="https://tcgdex.dev">TCGdex</a>, prix de Cardmarket et TCGplayer).
      </p>
      <p>
        {SITE_NAME} est un projet de fan, non officiel, sans lien avec Nintendo, Creatures, GAME FREAK ou The Pokémon Company. Pokémon et les noms et
        images des cartes appartiennent à leurs propriétaires.
      </p>
    </LegalPage>
  );
}

function En() {
  return (
    <LegalPage path="/mentions-legales" title="Legal notice" updated="16 October 2026" en>
      <h2>Publisher</h2>
      <p>
        {SITE_DOMAIN} is published by {LEGAL.name}, sole trader (French micro-entreprise).
        <br />
        SIRET: {LEGAL.siret}
        <br />
        Address: {LEGAL.address}
        <br />
        E-mail: <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>, or the <Link href="/contact">contact form</Link>.
      </p>
      <p>Publication director: {LEGAL.name}.</p>

      <h2>Hosting</h2>
      <p>
        The site is hosted by Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, United States (<a href="https://vercel.com">vercel.com</a>).
        Accounts and saves are stored with Supabase (<a href="https://supabase.com">supabase.com</a>), see the{" "}
        <Link href="/confidentialite">privacy policy</Link>.
      </p>

      <h2>Shop</h2>
      <p>
        {MANAGED_PAYMENTS
          ? "The shop's decorations are sold through Link, Stripe's payment service, which takes the payment and sends the receipts."
          : `The shop's decorations are sold by ${LEGAL.name} (VAT not applicable, article 293 B of the French tax code), payment by Stripe.`}{" "}
        See the <Link href="/conditions-de-vente">terms of sale</Link>.
      </p>

      <h2>Ownership</h2>
      <p>
        {SITE_NAME}&apos;s pictures, code and texts belong to its publisher, unless stated otherwise (the game&apos;s credits, card data from{" "}
        <a href="https://tcgdex.dev">TCGdex</a>, prices from Cardmarket and TCGplayer).
      </p>
      <p>
        {SITE_NAME} is an unofficial fan project, not affiliated with Nintendo, Creatures, GAME FREAK or The Pokémon Company. Pokémon and the card
        names and pictures belong to their owners.
      </p>
    </LegalPage>
  );
}

export default async function LegalNotice() {
  return (await serverLang()) === "en" ? <En /> : <Fr />;
}
