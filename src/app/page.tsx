import { ClientApp } from "@/components/ClientApp";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export default function Home() {
  return (
    <>
      {/* The room is drawn in the browser only: this text is what search engines and screen readers read first. */}
      <div className="sr-only">
        <h1>{SITE_NAME}, ta collection de cartes Pokémon rangée sur ton bureau</h1>
        <p>{SITE_DESCRIPTION}</p>
        <p>
          Choisis une extension (Épée et Bouclier, Écarlate et Violet, Méga-Évolution) ou crée un classeur libre, coche les cartes que tu
          possèdes, suis la valeur de ta collection avec les prix Cardmarket mis à jour chaque jour, et partage ta liste de recherche.
        </p>
      </div>
      <ClientApp />
    </>
  );
}
