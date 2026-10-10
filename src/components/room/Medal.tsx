import type { Trophy } from "@/lib/trophies";
import styles from "./Trophies.module.css";

/** A trophy's medal: its tier's metal, its picture, on a ribbon. Locked: a dark silhouette, or "?" for a secret. */
export function Medal({ trophy, won, size, className = "" }: { trophy: Trophy; won: boolean; size?: number; className?: string }) {
  const hidden = !won && trophy.secret;
  return (
    <span
      className={`${styles.medal} ${styles[trophy.tier]} ${won ? "" : styles.locked} ${className}`}
      style={size ? { ["--size" as string]: `${size}px` } : undefined}
      aria-hidden
    >
      <span className={styles.ribbon} />
      <span className={styles.coin}>
        <span className={styles.icon}>{hidden ? "?" : trophy.icon}</span>
      </span>
    </span>
  );
}
