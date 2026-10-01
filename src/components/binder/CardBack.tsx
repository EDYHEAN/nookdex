import styles from "./CardBack.module.css";
import { useT } from "@/lib/lang";

/**
 * The back of a card, for a card whose scan isn't available (TCGdex took it out for now):
 * it stays in the collection, with its last known prices, and comes back on its own once TCGdex has it again.
 */
export function CardBack({ label = true }: { label?: boolean }) {
  const t = useT();
  return (
    <span className={styles.back} title={t("Image momentanément indisponible chez notre fournisseur de cartes : on est dessus !", "Picture temporarily unavailable from our card provider: we're on it!")}>
      <span className={styles.ball} aria-hidden />
      {label && <span className={styles.stamp}>{t("Bientôt de retour", "Back soon")}</span>}
    </span>
  );
}
