import styles from "./CardBack.module.css";

/**
 * The back of a card, for a card whose scan isn't available (TCGdex took it out for now):
 * it stays in the collection, with its last known prices, and comes back on its own once TCGdex has it again.
 */
export function CardBack({ label = true }: { label?: boolean }) {
  return (
    <span className={styles.back} title="Image momentanément indisponible chez notre fournisseur de cartes : on est dessus !">
      <span className={styles.ball} aria-hidden />
      {label && <span className={styles.stamp}>Bientôt de retour</span>}
    </span>
  );
}
