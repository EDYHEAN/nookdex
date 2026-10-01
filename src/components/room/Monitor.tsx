"use client";

import { useMemo, type CSSProperties } from "react";
import { formatEur } from "@/lib/price";
import { quadMatrix } from "@/lib/scene";
import { OS_NAME } from "@/lib/site";
import { sfx } from "@/lib/sound";
import { useTotals } from "@/lib/useTotals";
import styles from "./Monitor.module.css";
import { useT } from "@/lib/lang";

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
  // The layout is drawn flat on a 104px wide screen, then projected onto the painted glass.
  const innerW = 104;
  const glassW = (quad[1][0] - quad[0][0] + quad[2][0] - quad[3][0]) / 2;
  const glassH = (quad[3][1] - quad[0][1] + quad[2][1] - quad[1][1]) / 2;
  const innerH = Math.round((innerW * glassH) / glassW);
  const matrix = useMemo(() => quadMatrix(innerW, innerH, quad), [innerH, quad]);

  const totals = useTotals();
  const tr = useT();
  // Only free binders so far: count the cards instead of a set progress.
  const t = totals.total
    ? { big: `${totals.owned}/${totals.total}`, pct: Math.round((totals.owned / totals.total) * 100), trend: totals.trend }
    : { big: `${totals.cards}`, pct: 0, trend: totals.trend };

  return (
    <button
      className={styles.screen}
      style={style}
      data-tour="monitor"
      onPointerEnter={onHover}
      onPointerLeave={onLeave}
      onClick={(e) => {
        sfx.boot();
        onOpen(e.currentTarget.getBoundingClientRect());
      }}
      aria-label={tr(`Ouvrir ${OS_NAME}`, `Open ${OS_NAME}`)}
    >
      <div className={styles.inner} style={{ width: innerW, height: innerH, transform: matrix }}>
        <div className={styles.content}>
          <p className={styles.title}>{OS_NAME}</p>
          <p className={styles.big}>
            {t.big}
          </p>
          <p className={styles.bar}>
            <span style={{ width: `${t.pct}%` }} />
          </p>
          <p className={styles.money}>{formatEur(t.trend)}</p>
          <p className={styles.cta}>
            <span className={styles.ctaArrow}>▶</span>
            <span className={styles.ctaText}>{tr("OUVRIR", "OPEN")}</span>
            <span className={styles.ctaKey}>OS</span>
          </p>
        </div>
        <div className={styles.scan} />
      </div>
    </button>
  );
}
