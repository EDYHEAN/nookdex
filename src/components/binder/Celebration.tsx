"use client";

import { useEffect, useRef, useState } from "react";
import type { CardData } from "@/lib/types";
import styles from "./Binder.module.css";
import { useT } from "@/lib/lang";

const COLORS = ["#ffd35a", "#ff7aa8", "#6ae6ff", "#9dff7a", "#b28cff", "#ffffff"];

function makeConfetti() {
  return Array.from({ length: 90 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    dur: 1.6 + Math.random() * 1.4,
    size: 6 + Math.round(Math.random() * 8),
    color: COLORS[i % COLORS.length],
    drift: (Math.random() - 0.5) * 200,
    spin: Math.random() * 720 - 360,
  }));
}

/** Full-screen party when a very expensive card joins the collection. */
export function Celebration({ card, onDone }: { card: CardData; onDone: () => void }) {
  const tr = useT();
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    const t = setTimeout(() => done.current(), 3200);
    return () => clearTimeout(t);
  }, []);

  const [confetti] = useState(makeConfetti);

  return (
    <div className={styles.party} onClick={onDone}>
      <div className={styles.partyFlash} />
      {confetti.map((c, i) => (
        <span
          key={i}
          className={styles.confetto}
          style={{
            left: `${c.left}%`,
            width: c.size,
            height: c.size,
            background: c.color,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.dur}s`,
            ["--drift" as string]: `${c.drift}px`,
            ["--spin" as string]: `${c.spin}deg`,
          }}
        />
      ))}
      <div className={styles.partyBanner}>
        <span>★ PÉPITE ★</span>
        <b>{card.name}</b>
        <em>{tr("rejoint ta collection !", "joins your collection!")}</em>
      </div>
    </div>
  );
}
