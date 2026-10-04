import Link from "next/link";
import { SITE_DESCRIPTION, SITE_DESCRIPTION_EN, SITE_NAME, SITE_URL } from "@/lib/site";
import styles from "./HomeText.module.css";

const ld = (data: object) => <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;

/**
 * The room is drawn in the browser only: this text is what search engines, AI assistants and screen readers read on the
 * home page ("/" in French, "/en" in English). The title is written on the loader's paper, the rest stays for them.
 */
export function HomeText({ en }: { en: boolean }) {
  return (
    <>
      {ld({
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: SITE_NAME,
        url: en ? `${SITE_URL}/en` : SITE_URL,
        description: en ? SITE_DESCRIPTION_EN : SITE_DESCRIPTION,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web browser",
        inLanguage: ["fr", "en"],
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: 0, priceCurrency: en ? "USD" : "EUR" },
        image: `${SITE_URL}/opengraph-image.jpg`,
      })}
      {en ? (
        <div className={styles.text}>
          <h1 className={styles.tagline}>Your Pokémon card collection, filed on your desk</h1>
          <div className="sr-only">
            <p>{SITE_DESCRIPTION_EN}</p>
            <p>
              Pick a set (Sword &amp; Shield, Scarlet &amp; Violet, Mega Evolution) in English, French or Japanese, or create a free binder,
              tick the cards you own, follow your collection&apos;s value with prices updated every day (TCGplayer, Cardmarket), and share
              your wanted list.
            </p>
            <nav>
              <Link href="/a-propos">About</Link> · <Link href="/en/sets">Sets: card lists and prices</Link> · <Link href="/en/release-calendar">Release calendar</Link> · <Link href="/blog">Blog</Link> ·{" "}
              <Link href="/confidentialite">Privacy policy</Link> · <Link href="/conditions">Terms of use</Link> · <Link href="/contact">Contact</Link> ·{" "}
              <Link href="/" hrefLang="fr">
                En français
              </Link>
            </nav>
          </div>
        </div>
      ) : (
        <div className={styles.text}>
          <h1 className={styles.tagline}>Ta collection de cartes Pokémon, rangée sur ton bureau</h1>
          <div className="sr-only">
            <p>{SITE_DESCRIPTION}</p>
            <p>
              Choisis une extension (Épée et Bouclier, Écarlate et Violet, Méga-Évolution) en français, en anglais ou en japonais, ou crée un
              classeur libre, coche les cartes que tu possèdes, suis la valeur de ta collection avec les prix mis à jour chaque jour (Cardmarket,
              TCGplayer), et partage ta liste de recherche.
            </p>
            <nav>
              <Link href="/a-propos">À propos</Link> · <Link href="/extensions">Extensions : listes des cartes et prix</Link> ·{" "}
              <Link href="/calendrier-des-sorties">Calendrier des sorties</Link> ·{" "}
              <Link href="/blog">Blog</Link> · <Link href="/confidentialite">Règles de confidentialité</Link> ·{" "}
              <Link href="/conditions">Conditions d&apos;utilisation</Link> · <Link href="/contact">Contact</Link> ·{" "}
              <Link href="/en" hrefLang="en">
                In English
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
