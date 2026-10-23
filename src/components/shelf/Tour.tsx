"use client";

import { motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/lang";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import styles from "./Tour.module.css";

/**
 * First visit, once the first binder is open: a short guided tour that dims everything but what it shows (a spotlight on
 * elements tagged data-tour="…"), with a note right next to it. The first step waits for the player to tick a card:
 * learning by doing.
 * It can't be skipped, but it never gets stuck: a target that can't be found lets the player go on.
 * It ends back in the binder, open, with the card it had the player tick (Johan, 2026-10-20: it used to have them remove
 * it, and end on the closed desk with an empty collection).
 */

interface Step {
  /** Tried in order: the first visible element is spotlighted. */
  target: string[];
  text: ReactNode;
  /** Shown instead when the target isn't on screen yet (e.g. "turn the page"). */
  detour?: { target: string; text: ReactNode };
  /** The player has to do it: the tour goes on by itself once this is true (no "next" button). */
  done?: () => boolean;
  /** Not relevant here (a free binder has no grey cards…): skipped. */
  skip?: () => boolean;
  /** Before leaving the step with "next". */
  leave?: () => void;
}

const $ = (sel: string) => document.querySelector<HTMLElement>(sel);

/**
 * The element is on screen and seen whole: its top, middle and bottom aren't behind anything (a page, a modal, the tour
 * itself aside). Checking the middle only spotlighted a card half under the phone's page bar (its bottom hidden).
 */
function seen(el: HTMLElement, layer: HTMLElement | null) {
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
  const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
  const inset = Math.min(10, r.height / 4);
  return [r.top + inset, r.top + r.height / 2, r.bottom - inset].every((py) => {
    const y = Math.min(Math.max(py, 1), innerHeight - 1);
    const top = document.elementsFromPoint(x, y).find((n) => !layer?.contains(n));
    return !!top && (el === top || el.contains(top));
  });
}

function find(selectors: string[], layer: HTMLElement | null) {
  for (const sel of selectors) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${sel}"]`)) if (seen(el, layer)) return el;
  }
  return null;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 8;
const GAP = 14;

/** Where the note goes: under the spotlight, else above, beside, or at the bottom of the screen. */
function placeNote(hole: Box | null, w: number, h: number) {
  const vw = innerWidth;
  const vh = innerHeight;
  const clampX = (x: number) => Math.min(Math.max(x, 10), vw - w - 10);
  const clampY = (y: number) => Math.min(Math.max(y, 10), vh - h - 10);
  if (!hole) return { left: clampX((vw - w) / 2), top: clampY((vh - h) / 2) };
  const cx = hole.x + hole.w / 2;
  const cy = hole.y + hole.h / 2;
  if (hole.y + hole.h + GAP + h <= vh - 10) return { left: clampX(cx - w / 2), top: hole.y + hole.h + GAP };
  if (hole.y - GAP - h >= 10) return { left: clampX(cx - w / 2), top: hole.y - GAP - h };
  if (hole.x + hole.w + GAP + w <= vw - 10) return { left: hole.x + hole.w + GAP, top: clampY(cy - h / 2) };
  if (hole.x - GAP - w >= 10) return { left: hole.x - GAP - w, top: clampY(cy - h / 2) };
  return { left: clampX(cx - w / 2), top: vh - h - 12 };
}

/** Copies in the collection: the first step goes on once the player ticked a card (one more than when the tour began). */
const copies = () => Object.values(useStore.getState().collection).reduce((n, c) => n + c.length, 0);

/**
 * The steps (Johan, 2026-10-23: 12 steps were a lot before the first card; 3 now, cards first): tick a grey card, see « J'ai
 * tout », your turn. The rest of the desk (NookDex OS, the notebook, the trophies) shows itself when the player meets it.
 */
function buildSteps(en: boolean, start: number): Step[] {
  const t = (fr: ReactNode, english: ReactNode) => (en ? english : fr);
  return [
    {
      target: ["missing"],
      text: t(
        <>
          🃏 Une carte <b>grise</b> = une carte qui te manque. <b>Touche une carte que tu as</b> : elle se colore, elle est à toi !
        </>,
        <>
          🃏 A <b>grey</b> card = a card you&apos;re missing. <b>Tap one you have</b>: it colours in, it&apos;s yours!
        </>,
      ),
      detour: { target: "next-page", text: t(<>Tourne la page ▶</>, <>Turn the page ▶</>) },
      done: () => copies() > start,
      skip: () => !$('[data-tour="missing"]'),
    },
    {
      target: ["fill-set"],
      text: t(
        <>
          ✓ Tu as <b>tout le set</b>, ou presque ? <b>J&apos;ai tout</b> coche chaque carte d&apos;un coup, et tu retires celles qui manquent.
        </>,
        <>
          ✓ Got <b>the whole set</b>, or nearly? <b>Got &apos;em all</b> ticks every card at once, then untick the missing ones.
        </>,
      ),
      skip: () => !$('[data-tour="fill-set"]'),
    },
    {
      // the end, in the binder: no spotlight, the player's turn
      target: [],
      text: t(
        <>
          🎉 <b>À toi !</b> Coche les cartes que tu as. Le reste du bureau se découvre en chemin ✨
        </>,
        <>
          🎉 <b>Your turn!</b> Tick the cards you have. The rest of the desk shows itself along the way ✨
        </>,
      ),
    },
  ];
}

export function Tour({ onDone }: { onDone: () => void }) {
  /** the copies when the tour began: one more, and the first step is done */
  const [start] = useState(copies);
  const layer = useRef<HTMLDivElement>(null);
  const note = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [hole, setHole] = useState<Box | null>(null);
  const [detour, setDetour] = useState(false);
  const [lost, setLost] = useState(false);
  const [pos, setPos] = useState({ left: -9999, top: -9999 });
  // Steps left out (not relevant here: a free binder has no grey card, no « J'ai tout ») are out of the count too
  const [skipped, setSkipped] = useState<number[]>(() => buildSteps(false, 0).flatMap((s, k) => (s.skip?.() ? [k] : [])));

  const en = useLang() === "en";
  const steps = buildSteps(en, start);
  const step = steps[i];
  const last = i === steps.length - 1;
  const interactive = !!step.done && !lost;
  const shown = steps.filter((_, k) => k <= i && !skipped.includes(k)).length;

  // Follows the target every frame (binders flip, the OS zooms in…), and moves on when the player did the thing.
  useEffect(() => {
    const all = buildSteps(false, start);
    const s = all[i];
    if (s.skip?.()) {
      const t = setTimeout(() => {
        setSkipped((k) => (k.includes(i) ? k : [...k, i]));
        setI((n) => Math.min(n + 1, all.length - 1));
      }, 0);
      return () => clearTimeout(t);
    }
    let raf = 0;
    let missingSince = performance.now();
    let advanced = false;
    let scrolled = false;
    const tick = () => {
      if (s.done?.() && !advanced) {
        advanced = true;
        s.leave?.();
        sfx.pop();
        // the next step starts from a dimmed screen (a step with no target keeps no old hole)
        setHole(null);
        setI((n) => Math.min(n + 1, all.length - 1));
        return;
      }
      const main = find(s.target, layer.current);
      // There but not seen whole (off screen, or under the phone's page bar at the bottom of the binder's column): bring
      // it to the middle, once.
      if (!main && !scrolled) {
        const el = s.target.map((t) => $(`[data-tour="${t}"]`)).find(Boolean);
        const r = el?.getBoundingClientRect();
        if (el && r && r.width > 0) {
          scrolled = true;
          el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
        }
      }
      const alt = !main && s.detour ? find([s.detour.target], layer.current) : null;
      const el = main ?? alt;
      setDetour(!main && !!alt);
      if (el) {
        missingSince = performance.now();
        const r = el.getBoundingClientRect();
        const box = { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
        setHole((h) => (h && Math.abs(h.x - box.x) < 0.5 && Math.abs(h.y - box.y) < 0.5 && Math.abs(h.w - box.w) < 0.5 && Math.abs(h.h - box.h) < 0.5 ? h : box));
        setLost(false);
      } else if (performance.now() - missingSince > 1500) {
        setHole(null);
        setLost(true);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [i, start]);

  // The note sits next to the spotlight.
  useEffect(() => {
    const n = note.current;
    if (!n) return;
    const next = placeNote(hole, n.offsetWidth, n.offsetHeight);
    setPos((p) => (Math.abs(p.left - next.left) < 0.5 && Math.abs(p.top - next.top) < 0.5 ? p : next));
  }, [hole, i, detour, lost]);

  // Escape would close the binder or the OS under the tour: not now.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const next = () => {
    step.leave?.();
    if (last) {
      sfx.add(0, "rare");
      onDone();
      return;
    }
    sfx.pop();
    setHole(null);
    setI(i + 1);
  };

  // Four panels around the hole catch the clicks; the hole itself stays clickable.
  const panels = hole
    ? [
        { left: 0, top: 0, width: "100%", height: Math.max(hole.y, 0) },
        { left: 0, top: hole.y + hole.h, width: "100%", bottom: 0 },
        { left: 0, top: hole.y, width: Math.max(hole.x, 0), height: hole.h },
        { left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h },
      ]
    : [{ left: 0, top: 0, right: 0, bottom: 0 }];

  return (
    <div ref={layer} className={styles.layer} role="dialog" aria-modal="true" aria-label={en ? "Guided tour" : "Visite guidée"}>
      {panels.map((p, n) => (
        <div key={n} className={styles.block} style={p} />
      ))}
      <div
        className={`${styles.hole} ${hole ? "" : styles.noHole}`}
        style={hole ? { left: hole.x, top: hole.y, width: hole.w, height: hole.h } : undefined}
      />

      <motion.div
        ref={note}
        key={i}
        className={styles.note}
        style={{ left: pos.left, top: pos.top }}
        initial={{ opacity: 0, scale: 0.92, rotate: -1.5 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 22, delay: 0.1 }}
      >
        <p className={styles.text}>{detour && step.detour ? step.detour.text : step.text}</p>
        <div className={styles.foot}>
          <span className={styles.count}>
            {shown}/{steps.length - skipped.length}
          </span>
          {interactive ? (
            <span className={styles.todo}>{en ? "your turn!" : "à toi !"}</span>
          ) : (
            <button className={styles.next} onClick={next} autoFocus>
              {last ? (en ? "Your turn ▶" : "À toi de jouer ▶") : "OK ▶"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
