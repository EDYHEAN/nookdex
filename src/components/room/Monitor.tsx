"use client";

import { useMemo, type CSSProperties } from "react";
import { BINDERS } from "@/lib/binders";
import { formatEur, setStats } from "@/lib/price";
import { quadMatrix } from "@/lib/scene";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import styles from "./Monitor.module.css";

interface Props {
  style: CSSProperties;
  /** glass corners relative to the button (TL, TR, BR, BL) */
  quad: [number, number][];
  onOpen: (rect: DOMRect) => void;
  onHover: () => void;
  onLeave: () => void;
}

/** Glanceable summary on the desk CRT; the full OS opens on click. */
export function Monitor({ style, quad, onOpen, onHover, onLeave }: Props) {
  const collection = useStore((s) => s.collection);
  // The layout is drawn flat on a 104px wide screen, then projected onto the painted glass.
  const innerW = 104;
  const glassW = (quad[1][0] - quad[0][0] + quad[2][0] - quad[3][0]) / 2;
  const glassH = (quad[3][1] - quad[0][1] + quad[2][1] - quad[1][1]) / 2;
  const innerH = Math.round((innerW * glassH) / glassW);
  const matrix = useMemo(() => quadMatrix(innerW, innerH, quad), [innerH, quad]);

  const t = useMemo(() => {
    let owned = 0, total = 0, trend = 0;
    for (const b of BINDERS) {
      if (!b.set) continue;
      const s = setStats(b.set, collection);
      owned += s.owned;
      total += s.total;
      trend += s.trend;
    }
    return { owned, total, trend, pct: total ? Math.round((owned / total) * 100) : 0 };
  }, [collection]);

  return (
    <button
      className={styles.screen}
      style={style}
      onPointerEnter={onHover}
      onPointerLeave={onLeave}
      onClick={(e) => {
        sfx.boot();
        onOpen(e.currentTarget.getBoundingClientRect());
      }}
      aria-label="Ouvrir PokéPocket OS"
    >
      <div className={styles.inner} style={{ width: innerW, height: innerH, transform: matrix }}>
        <div className={styles.content}>
          <p className={styles.title}>POKEPOCKET OS</p>
          <p className={styles.big}>
            {t.owned}/{t.total}
          </p>
          <p className={styles.bar}>
            <span style={{ width: `${t.pct}%` }} />
          </p>
          <p className={styles.money}>{formatEur(t.trend)}</p>
          <p className={styles.cta}>
            <span className={styles.ctaArrow}>▶</span>
            <span className={styles.ctaText}>OUVRIR</span>
            <span className={styles.ctaKey}>OS</span>
          </p>
        </div>
        <div className={styles.scan} />
      </div>
    </button>
  );
}
