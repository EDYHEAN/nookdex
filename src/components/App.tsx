"use client";

import { AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { BINDERS, binderOfCard } from "@/lib/binders";
import { setMuted, sfx, startAmbient, stopAmbient } from "@/lib/sound";
import { useStore } from "@/lib/store";
import type { BinderDef } from "@/lib/types";
import { isCompact, useViewport } from "@/lib/useViewport";
import { BinderView } from "./binder/BinderView";
import { Computer } from "./computer/Computer";
import { Loader } from "./Loader";
import { BoilFilter } from "./fx/Boil";
import { Grain } from "./fx/Grain";
import { PaintedRoom } from "./room/PaintedRoom";
import styles from "./App.module.css";

interface Open {
  binder: BinderDef;
  focusCardId?: string;
}

export function App() {
  const vp = useViewport();
  const compact = isCompact(vp);
  const [open, setOpen] = useState<Open | null>(null);
  const [computer, setComputer] = useState<{ x: number; y: number } | null>(null);
  const [entered, setEntered] = useState(false);
  const sound = useStore((s) => s.sound);
  const ambient = useStore((s) => s.ambient);
  const toggleSound = useStore((s) => s.toggleSound);
  const setAmbient = useStore((s) => s.setAmbient);

  useEffect(() => setMuted(!sound), [sound]);

  // Dev-only shortcuts for screenshots: ?skip  ?open=swsh12  ?demo  ?os
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const q = new URLSearchParams(window.location.search);
    if (q.has("demo") && !Object.keys(useStore.getState().collection).length) {
      const { addCard, addCopy, updateCopy } = useStore.getState();
      BINDERS.forEach((b) =>
        b.set?.cards.forEach((c, i) => {
          if ((i * 7) % 10 < 6) addCard(c.id, c.variants[0]);
          if (i % 9 === 0 && c.variants[1]) addCopy(c.id, c.variants[1]);
          const copy = useStore.getState().collection[c.id]?.[0];
          if (copy && i % 4 === 0) updateCopy(c.id, copy.id, { paid: i % 8 === 0 ? 0 : Math.round((c.price.trend ?? 0) * 80) / 100 });
        }),
      );
    }
    const t = setTimeout(() => {
      if (q.has("skip") || q.has("open") || q.has("os")) setEntered(true);
      const b = BINDERS.find((x) => x.id === q.get("open"));
      if (b) setOpen({ binder: b });
      if (q.has("os")) setComputer({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }, 50);
    return () => clearTimeout(t);
  }, []);

  const goToCard = (cardId: string) => {
    const binder = binderOfCard(cardId);
    if (!binder) return;
    sfx.shelfOut();
    setComputer(null);
    setTimeout(() => setOpen({ binder, focusCardId: cardId }), 350);
  };

  const openId = open?.binder.id ?? null;

  return (
    <>
      <BoilFilter paused={!!open || !!computer} />
      <PaintedRoom
        openId={openId}
        compact={compact}
        paused={!!open || !!computer}
        onOpen={(binder) => setOpen({ binder })}
        onOpenComputer={(r) => setComputer({ x: r.left + r.width / 2, y: r.top + r.height / 2 })}
      />

      {open && <BinderView key={open.binder.id} binder={open.binder} focusCardId={open.focusCardId} onClosed={() => setOpen(null)} />}

      <AnimatePresence>
        {computer && <Computer key="os" origin={computer} onClose={() => setComputer(null)} onGoToCard={goToCard} />}
      </AnimatePresence>

      <div className={styles.corner}>
        {compact && (
          <>
            <button
              className={styles.iconBtn}
              onClick={() => {
                sfx.boot();
                setComputer({ x: window.innerWidth - 40, y: 30 });
              }}
              aria-label="PokéPocket OS"
              title="PokéPocket OS"
            >
              <span className={styles.os}>OS</span>
            </button>
            <button
              className={`${styles.iconBtn} ${ambient ? styles.on : ""}`}
              onClick={() => {
                sfx.click();
                if (ambient) stopAmbient();
                else startAmbient();
                setAmbient(!ambient);
              }}
              aria-label="Musique"
              title="Musique lofi"
            >
              ♪
            </button>
          </>
        )}
        <button
          className={`${styles.iconBtn} ${sound ? styles.on : ""}`}
          onClick={() => {
            toggleSound();
            if (!sound) setTimeout(() => sfx.pop(), 60);
          }}
          aria-label={sound ? "Couper le son" : "Activer le son"}
          title={sound ? "Couper le son" : "Activer le son"}
        >
          <span className={`${styles.speaker} ${sound ? "" : styles.muted}`} />
        </button>
      </div>

      {!entered && <Loader onEnter={() => setEntered(true)} />}
      <Grain />
    </>
  );
}
