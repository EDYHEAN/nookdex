import art from "@/data/trophy-art.json";
import type { Trophy } from "@/lib/trophies";
import styles from "./Trophies.module.css";

const INDEX = art.index as Record<string, number>;

/**
 * A trophy: its painted trinket (one square of public/trophies.webp) on a plinth of its tier's metal. Not won: a dark
 * silhouette, or "?" for a secret. Sized by --size (CSS) or `size`.
 */
export function Medal({ trophy, won, size, className = "" }: { trophy: Trophy; won: boolean; size?: number; className?: string }) {
  const hidden = !won && trophy.secret;
  const i = INDEX[trophy.id] ?? 0;
  return (
    <span
      className={`${styles.medal} ${styles[trophy.tier]} ${won ? "" : styles.locked} ${className}`}
      style={size ? { ["--size" as string]: `${size}px` } : undefined}
      aria-hidden
    >
      <span className={styles.plinth} />
      {hidden ? (
        <span className={styles.mystery}>?</span>
      ) : (
        <span
          className={styles.art}
          style={{
            backgroundSize: `calc(var(--size) * ${art.cols}) calc(var(--size) * ${art.rows})`,
            backgroundPosition: `calc(var(--size) * ${-(i % art.cols)}) calc(var(--size) * ${-Math.floor(i / art.cols)})`,
          }}
        />
      )}
    </span>
  );
}
