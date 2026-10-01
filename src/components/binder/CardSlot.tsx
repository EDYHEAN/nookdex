"use client";

import { memo, useEffect, useRef, useState } from "react";
import { cardTier, formatEur, unitPrice, type Tier } from "@/lib/price";
import { sfx } from "@/lib/sound";
import type { CardData, Copy } from "@/lib/types";
import styles from "./CardSlot.module.css";

export interface AddResult {
  combo: number;
  gain: number;
  tier: Tier;
}

interface Props {
  card: CardData;
  copies: Copy[] | undefined;
  /** Pulses to show where a card searched from the PC is. */
  focused: boolean;
  onAdd: (card: CardData) => AddResult;
  onInspect: (id: string) => void;
  /** Owned but kept elsewhere, ex: "dans Fourre-tout" */
  tag?: string;
}

const BURST_COLORS: Record<Tier, string[]> = {
  common: ["#ffd35a", "#9dff7a", "#6ae6ff", "#efe3c8"],
  rare: ["#ffd35a", "#ff7aa8", "#6ae6ff", "#b28cff", "#ffffff"],
  legend: ["#ffd35a", "#ffec9a", "#ff9d4a", "#ffffff"],
};

interface Fx {
  id: number;
  gain: number;
  combo: number;
  tier: Tier;
  bits: { dx: number; dy: number; r: number; c: string; s: number }[];
}

export const CardSlot = memo(function CardSlot({ card, copies, focused, onAdd, onInspect, tag }: Props) {
  const owned = !!copies?.length;
  const [fx, setFx] = useState<Fx | null>(null);
  const lift = useRef<HTMLSpanElement>(null);
  const qty = copies?.reduce((n, c) => n + c.qty, 0) ?? 0;
  const variants = new Set(copies?.map((c) => c.variant));
  const price = unitPrice(card, card.variants[0], "trend");
  const tier = cardTier(card);

  useEffect(() => {
    if (!fx) return;
    const t = setTimeout(() => setFx(null), 1300);
    return () => clearTimeout(t);
  }, [fx]);

  const click = () => {
    if (owned) {
      sfx.pop();
      onInspect(card.id);
      return;
    }
    const res = onAdd(card);
    const n = res.tier === "common" ? 14 : 26;
    const cols = BURST_COLORS[res.tier];
    setFx({
      id: performance.now(),
      ...res,
      bits: Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        const d = 40 + Math.random() * (res.tier === "common" ? 50 : 90);
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d - 20, r: Math.random() * 360, c: cols[i % cols.length], s: 3 + Math.round(Math.random() * 4) };
      }),
    });
  };

  // The hit area (button) never moves: only the inner "lift" layer tilts, so hovering can't flicker.
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = lift.current;
    if (!el || !owned) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.setProperty("--rx", `${(0.5 - y) * 14}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 16}deg`);
  };
  const onLeave = () => {
    lift.current?.style.setProperty("--rx", "0deg");
    lift.current?.style.setProperty("--ry", "0deg");
  };

  return (
    <div
      className={`${styles.slot} ${owned ? styles.owned : styles.missing} ${fx ? styles.added : ""} ${focused ? styles.focused : ""}`}
      data-tier={tier}
      data-tour={owned ? "owned" : "missing"}
    >
      <button
        className={styles.pocket}
        onClick={click}
        onPointerEnter={sfx.hover}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        aria-label={owned ? `${card.name} — voir la fiche` : `${card.name} — je l'ai !`}
      >
        <span ref={lift} className={styles.lift}>
          <img
            className={styles.img}
            // The light scan only (245 px, ~20 KB): a phone or a retina screen would otherwise pick the 600 px one
            // for every pocket. Only the pages around the open one are drawn, so no lazy loading either.
            src={`${card.img}/low.webp`}
            alt={card.name}
            decoding="async"
            draggable={false}
          />
          {owned && <span className={styles.glare} />}
          {owned && variants.has("reverse") && <span className={styles.foil} />}
          {!owned && (
            <span className={styles.ghost}>
              <b>{card.num}</b>
            </span>
          )}
          {!owned && (
            <span className={styles.hint}>
              <b>{card.name}</b>
              <span>{price ? formatEur(price) : "—"}</span>
              <em>clic = je l&apos;ai !</em>
            </span>
          )}
        </span>
      </button>

      {!owned && (
        <button
          className={styles.peek}
          onClick={(e) => {
            e.stopPropagation();
            sfx.pop();
            onInspect(card.id);
          }}
          aria-label={`Fiche de ${card.name}`}
          title="Voir la fiche"
        >
          🔍
        </button>
      )}

      {owned && (
        <div className={styles.badges}>
          {card.variants.map((v) => (
            <span key={v} className={`${styles.gem} ${styles[v]} ${variants.has(v) ? styles.gemOn : ""}`} title={v} />
          ))}
          {qty > 1 && <span className={styles.qty}>×{qty}</span>}
        </div>
      )}

      {tag && (
        <span className={styles.tag} title={`Cette carte est rangée ${tag}`}>
          {tag}
        </span>
      )}

      <span className={styles.sleeve} />

      {fx && (
        <div key={fx.id} className={styles.fx}>
          {fx.bits.map((b, i) => (
            <span
              key={i}
              className={styles.bit}
              style={{
                ["--dx" as string]: `${b.dx}px`,
                ["--dy" as string]: `${b.dy}px`,
                ["--r" as string]: `${b.r}deg`,
                width: b.s,
                height: b.s,
                background: b.c,
              }}
            />
          ))}
          {fx.gain > 0 && <span className={styles.gain}>+{formatEur(fx.gain)}</span>}
          {fx.combo >= 2 && <span className={styles.combo}>COMBO ×{fx.combo}</span>}
        </div>
      )}
    </div>
  );
});

/** An empty pocket of a free binder: slip any card in it. */
export function EmptyPocket({ index, onPick }: { index: number; onPick: (pocket: number) => void }) {
  return (
    <div className={`${styles.slot} ${styles.empty}`}>
      <button
        className={styles.pocket}
        onClick={() => {
          sfx.pop();
          onPick(index);
        }}
        onPointerEnter={sfx.hover}
        aria-label={`Pochette ${(index % 9) + 1} : ranger une carte`}
      >
        <span className={styles.lift}>
          <span className={styles.emptyPlus}>+</span>
          <span className={styles.emptyHint}>ranger une carte</span>
        </span>
      </button>
      <span className={styles.sleeve} />
    </div>
  );
}

/** A pocket whose card is still on its way from the server. */
export function LoadingPocket() {
  return (
    <div className={`${styles.slot} ${styles.empty}`}>
      <span className={styles.pocket}>
        <span className={styles.lift}>
          <span className={styles.emptyHint}>…</span>
        </span>
      </span>
      <span className={styles.sleeve} />
    </div>
  );
}
