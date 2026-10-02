"use client";

import { motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useCloud } from "@/lib/cloud";
import { useLang } from "@/lib/lang";
import { OS_NAME } from "@/lib/site";
import { sfx } from "@/lib/sound";
import styles from "./Tour.module.css";

/**
 * First visit, once the first binder is open: a guided tour that dims everything but the feature it shows
 * (a spotlight on elements tagged data-tour="…"), with a short note right next to it.
 * Some steps wait for the player to do the thing (click the grey card, open the OS…): learning by doing.
 * It can't be skipped, but it never gets stuck: a target that can't be found lets the player go on.
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
const click = (sel: string) => $(sel)?.click();

/** The element is on screen and actually seen (not behind a page, a modal… the tour itself aside). */
function seen(el: HTMLElement, layer: HTMLElement | null) {
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
  const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
  const y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
  const top = document.elementsFromPoint(x, y).find((n) => !layer?.contains(n));
  return !!top && (el === top || el.contains(top));
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

/** The steps (only the texts depend on the account and the language). */
function buildSteps(email: string | null, en: boolean): Step[] {
  const t = (fr: ReactNode, english: ReactNode) => (en ? english : fr);
  return [
    {
      target: ["summary"],
      text: t(
        <>
          📒 <b>Ton classeur.</b> Ici : ton avancement et la valeur Cardmarket de ta collec.
        </>,
        <>
          📒 <b>Your binder.</b> Here: your progress and the TCGplayer value of your collection.
        </>,
      ),
    },
    {
      target: ["missing"],
      text: t(
        <>
          🃏 Une carte <b>grise</b> = une carte qui te manque. <b>Clique dessus</b> : elle est à toi !
        </>,
        <>
          🃏 A <b>grey</b> card = a card you&apos;re missing. <b>Click it</b>: it&apos;s yours!
        </>,
      ),
      detour: { target: "next-page", text: t(<>Tourne la page ▶</>, <>Turn the page ▶</>) },
      done: () => !!$('[data-tour="owned"]'),
      skip: () => !$('[data-tour="missing"]') && !$('[data-tour="owned"]'),
    },
    {
      target: ["owned"],
      text: t(
        <>
          Bien joué ! <b>Clique sur ta carte</b> pour ouvrir sa fiche.
        </>,
        <>
          Nice! <b>Click your card</b> to open its sheet.
        </>,
      ),
      done: () => !!$('[data-tour="inspector"]'),
      skip: () => !$('[data-tour="owned"]'),
    },
    {
      target: ["remove-card"],
      text: t(
        <>
          🔍 Variante, état, prix payé : tout se règle sur la fiche. Pour retirer la carte, <b>maintiens ce bouton</b>.
        </>,
        <>
          🔍 Variant, condition, price paid: it&apos;s all on the sheet. To remove the card, <b>hold this button</b>.
        </>,
      ),
      // held long enough: the card is gone, the button with it
      done: () => !$('[data-tour="remove-card"]'),
      skip: () => !$('[data-tour="inspector"]'),
      leave: () => setTimeout(() => click('[data-tour="inspector-close"]'), 400),
    },
    {
      target: ["close-binder"],
      text: t(
        <>
          <b>Range ton classeur</b> sur l&apos;étagère.
        </>,
        <>
          <b>Put your binder away</b> on the shelf.
        </>,
      ),
      done: () => !$('[data-tour="binder"]'),
      skip: () => !$('[data-tour="binder"]'),
    },
    {
      target: ["os-button", "monitor"],
      text: t(
        <>
          🖥️ <b>Clique ici</b> pour allumer {OS_NAME}.
        </>,
        <>
          🖥️ <b>Click here</b> to switch {OS_NAME} on.
        </>,
      ),
      done: () => !!$('[data-tour="os"]'),
    },
    {
      target: ["tab-wish"],
      text: t(
        <>
          ⭐ <b>Ta wishlist</b> : toutes les cartes qui te manquent, avec leur prix. Clique !
        </>,
        <>
          ⭐ <b>Your wishlist</b>: every card you&apos;re missing, with its price. Click!
        </>,
      ),
      done: () => !!$('[data-tour="tab-wish"][aria-selected="true"]'),
      skip: () => !$('[data-tour="os"]'),
    },
    {
      target: ["tab-save"],
      text: t(
        <>
          ☁️ Et ta <b>sauvegarde</b>, juste là. Clique !
        </>,
        <>
          ☁️ And your <b>save</b>, right there. Click!
        </>,
      ),
      done: () => !!$('[data-tour="tab-save"][aria-selected="true"]'),
      skip: () => !$('[data-tour="os"]'),
    },
    {
      target: ["account"],
      text: email
        ? t(
            <>
              Connecté : ta collec se <b>sauvegarde toute seule</b> en ligne, sur tous tes appareils.
            </>,
            <>
              Signed in: your collection <b>saves itself</b> online, on all your devices.
            </>,
          )
        : t(
            <>
              Sans compte, ta collec reste dans ce navigateur. <b>Connecte-toi ici</b> pour la garder en ligne.
            </>,
            <>
              Without an account, your collection stays in this browser. <b>Sign in here</b> to keep it online.
            </>,
          ),
      skip: () => !$('[data-tour="account"]'),
    },
    {
      target: ["quit-os"],
      text: t(
        <>
          <b>Quitte l&apos;OS</b> pour revenir au bureau.
        </>,
        <>
          <b>Quit the OS</b> to get back to the desk.
        </>,
      ),
      done: () => !$('[data-tour="os"]'),
      skip: () => !$('[data-tour="os"]'),
    },
    {
      target: ["about"],
      text: t(
        <>
          ✉️ <b>Le carnet</b> : l&apos;histoire du site, et le formulaire de contact si besoin. Le reste, à toi de le découvrir !
        </>,
        <>
          ✉️ <b>The notebook</b>: the story of the site, and the contact form if you need it. The rest is yours to discover!
        </>,
      ),
    },
  ];
}

export function Tour({ onDone }: { onDone: () => void }) {
  const email = useCloud((c) => c.email);
  const layer = useRef<HTMLDivElement>(null);
  const note = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [hole, setHole] = useState<Box | null>(null);
  const [detour, setDetour] = useState(false);
  const [lost, setLost] = useState(false);
  const [pos, setPos] = useState({ left: -9999, top: -9999 });

  const en = useLang() === "en";
  const steps = buildSteps(email, en);
  const step = steps[i];
  const last = i === steps.length - 1;
  const interactive = !!step.done && !lost;

  // Follows the target every frame (binders flip, the OS zooms in…), and moves on when the player did the thing.
  useEffect(() => {
    const all = buildSteps(null, false);
    const s = all[i];
    if (s.skip?.()) {
      const t = setTimeout(() => setI((n) => Math.min(n + 1, all.length - 1)), 0);
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
        setI((n) => Math.min(n + 1, all.length - 1));
        return;
      }
      const main = find(s.target, layer.current);
      // There but off screen (a tab strip scrolled sideways, the bottom of the card sheet on a phone): bring it in.
      if (!main && !scrolled) {
        const el = s.target.map((t) => $(`[data-tour="${t}"]`)).find(Boolean);
        const r = el?.getBoundingClientRect();
        // only when really out of the screen, and at once: a button that slides away under the finger cancels a hold
        if (el && r && r.width > 0 && (r.bottom > innerHeight || r.top < 0 || r.right > innerWidth || r.left < 0)) {
          scrolled = true;
          el.scrollIntoView({ block: "center", inline: "center" });
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
  }, [i]);

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
            {i + 1}/{steps.length}
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
