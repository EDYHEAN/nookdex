import styles from "./CardBack.module.css";
import { useT } from "@/lib/lang";

/**
 * The back of a card, for a card whose scan isn't available (TCGdex took it out for now):
 * it stays in the collection, with its last known prices, and comes back on its own once TCGdex has it again.
 * `fresh`: a card of a set just out, whose picture nobody has yet (fetch-set EARLY): it comes within days.
 */
export function CardBack({ label = true, fresh = false }: { label?: boolean; fresh?: boolean }) {
  const t = useT();
  const title = fresh
    ? t("Extension toute fraîche : l'image de la carte arrive dans quelques jours.", "Brand-new set: the card's picture comes within days.")
    : t("Image momentanément indisponible chez notre fournisseur de cartes : on est dessus !", "Picture temporarily unavailable from our card provider: we're on it!");
  return (
    <span className={styles.back} title={title}>
      <span className={styles.ball} aria-hidden />
      {label && <span className={styles.stamp}>{fresh ? t("Image à venir", "Picture soon") : t("Bientôt de retour", "Back soon")}</span>}
    </span>
  );
}
