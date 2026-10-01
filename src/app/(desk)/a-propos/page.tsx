import type { Metadata } from "next";
import Link from "next/link";
import { serverLang } from "@/lib/serverLang";
import { LegalPage } from "@/components/LegalPage";
import { SITE_DESCRIPTION, SITE_DESCRIPTION_EN, SITE_NAME } from "@/lib/site";
import styles from "@/components/LegalPage.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await serverLang()) === "en";
  return en ? { title: `About · ${SITE_NAME}`, description: SITE_DESCRIPTION_EN, alternates: { canonical: "/a-propos" } } : { title: `À propos · ${SITE_NAME}`, description: SITE_DESCRIPTION, alternates: { canonical: "/a-propos" } };
}

/** Public presentation of the app, readable without signing in (also the home page given to Google). */
function Fr() {
  return (
    <LegalPage path="/a-propos" title={`${SITE_NAME}, ta collection de cartes Pokémon`}>
      <p>
        {SITE_NAME} est un site gratuit pour ranger ta collection de cartes Pokémon (JCC) dans des classeurs, posés sur l&apos;étagère d&apos;un petit
        bureau peint à la main : la pluie contre la fenêtre, la lampe, le chat qui dort à côté.
      </p>
      <p>
        <Link href="/" className={styles.cta}>
          Ouvrir le bureau ▶
        </Link>
      </p>

      <h2>Ce que tu peux faire</h2>
      <ul>
        <li>
          <b>Un classeur par extension</b> (Épée et Bouclier, Écarlate et Violet, Méga-Évolution…) ou des classeurs libres où tu ranges ce que tu
          veux.
        </li>
        <li>
          <b>Coche les cartes que tu possèdes</b> : les cartes grises sont celles qui te manquent. Pour chaque exemplaire : variante (normale,
          reverse, holo), état Cardmarket, doublons, prix payé.
        </li>
        <li>
          <b>Suis la valeur de ta collection</b> avec les prix Cardmarket (prix bas et tendance) mis à jour chaque jour.
        </li>
        <li>
          <b>NookDex OS</b>, sur l&apos;écran du PC : tableau de bord, wishlist, doublons à échanger, recherche de carte, sauvegarde.
        </li>
      </ul>

      <h2>Ton compte</h2>
      <p>
        Connecte-toi avec ton e-mail (un lien de connexion, sans mot de passe) ou avec Google : ta collection est sauvegardée en ligne et te suit sur
        tous tes appareils. Avec Google, {SITE_NAME} ne reçoit que ton e-mail, ton nom et ta photo de profil, rien d&apos;autre. Tu peux aussi jouer
        sans compte : ta collection reste alors dans ton navigateur.
      </p>

      <h2>Qui fait {SITE_NAME}</h2>
      <p>
        Un projet de fan, fait par un collectionneur. Données des cartes : <a href="https://tcgdex.dev">TCGdex</a>. Prix : guide de prix Cardmarket.{" "}
        {SITE_NAME} n&apos;a aucun lien avec Nintendo, Creatures, GAME FREAK ou The Pokémon Company.
      </p>

      <p>
        <Link href="/confidentialite">Règles de confidentialité</Link> · <Link href="/conditions">Conditions d&apos;utilisation</Link> ·{" "}
        <Link href="/contact">Contact</Link>
      </p>
    </LegalPage>
  );
}

function En() {
  return (
    <LegalPage path="/a-propos" title={`${SITE_NAME}, your Pokémon card collection`} en>
      <p>
        {SITE_NAME} is a free site to file your Pokémon TCG collection in binders, standing on the shelf of a little hand-painted desk: rain on
        the window, the lamp, the cat asleep next to you.
      </p>
      <p>
        <Link href="/" className={styles.cta}>
          Open the desk ▶
        </Link>
      </p>

      <h2>What you can do</h2>
      <ul>
        <li>
          <b>One binder per set</b> (Sword &amp; Shield, Scarlet &amp; Violet, Mega Evolution…) or free binders for whatever you like.
        </li>
        <li>
          <b>Tick the cards you own</b>: grey cards are the ones you&apos;re missing. For each copy: variant (normal, reverse, holo), Cardmarket
          condition, duplicates, price paid.
        </li>
        <li>
          <b>Follow your collection&apos;s value</b> with Cardmarket prices (low and trend) updated every day.
        </li>
        <li>
          <b>NookDex OS</b>, on the computer screen: dashboard, wishlist, duplicates to trade, card search, save.
        </li>
      </ul>

      <h2>Your account</h2>
      <p>
        Sign in with your e-mail (a sign-in link, no password) or with Google: your collection is saved online and follows you on all your devices.
        With Google, {SITE_NAME} only gets your e-mail, name and profile picture, nothing else. You can also play without an account: your
        collection then stays in your browser.
      </p>

      <h2>Who makes {SITE_NAME}</h2>
      <p>
        A fan project, made by a collector. Card data: <a href="https://tcgdex.dev">TCGdex</a>. Prices: Cardmarket price guide. {SITE_NAME} has no
        link with Nintendo, Creatures, GAME FREAK or The Pokémon Company.
      </p>

      <p>
        <Link href="/confidentialite">Privacy policy</Link> · <Link href="/conditions">Terms of use</Link> · <Link href="/contact">Contact</Link>
      </p>
    </LegalPage>
  );
}

export default async function About() {
  return (await serverLang()) === "en" ? <En /> : <Fr />;
}
