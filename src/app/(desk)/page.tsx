import Link from "next/link";
import { serverLang } from "@/lib/serverLang";
import { SITE_DESCRIPTION, SITE_DESCRIPTION_EN, SITE_NAME } from "@/lib/site";

export default async function Home() {
  const en = (await serverLang()) === "en";
  return (
    <>
      {/* The room is drawn in the browser only: this text is what search engines and screen readers read first. */}
      {en ? (
        <div className="sr-only">
          <h1>{SITE_NAME}, your Pokémon card collection filed on your desk</h1>
          <p>{SITE_DESCRIPTION_EN}</p>
          <p>
            Pick a set (Sword &amp; Shield, Scarlet &amp; Violet, Mega Evolution) or create a free binder, tick the cards you own, follow your
            collection&apos;s value with Cardmarket prices updated every day, and share your wanted list.
          </p>
          <nav>
            <Link href="/a-propos">About</Link> · <Link href="/confidentialite">Privacy policy</Link> · <Link href="/conditions">Terms of use</Link> ·{" "}
            <Link href="/contact">Contact</Link>
          </nav>
        </div>
      ) : (
        <div className="sr-only">
          <h1>{SITE_NAME}, ta collection de cartes Pokémon rangée sur ton bureau</h1>
          <p>{SITE_DESCRIPTION}</p>
          <p>
            Choisis une extension (Épée et Bouclier, Écarlate et Violet, Méga-Évolution) ou crée un classeur libre, coche les cartes que tu
            possèdes, suis la valeur de ta collection avec les prix Cardmarket mis à jour chaque jour, et partage ta liste de recherche.
          </p>
          <nav>
            <Link href="/a-propos">À propos</Link> · <Link href="/confidentialite">Règles de confidentialité</Link> ·{" "}
            <Link href="/conditions">Conditions d&apos;utilisation</Link> · <Link href="/contact">Contact</Link>
          </nav>
        </div>
      )}
    </>
  );
}
