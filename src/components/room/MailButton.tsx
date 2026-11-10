"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { openPinned, useCourrier } from "@/lib/courrier";
import { useLang, useT } from "@/lib/lang";
import { sfx } from "@/lib/sound";
import styles from "./MailButton.module.css";

/**
 * The letters read (room/Courrier), kept in the top corner by the shop's bag: one letter opens at once, several unfold
 * a little list of their days. They used to be envelopes pinned on the cork board, over Warwick (Johan, 2026-11-10).
 */
export function MailButton({ className }: { className: string }) {
  const tr = useT();
  const lang = useLang();
  const pins = useCourrier((s) => s.pins);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // a click anywhere else, or Escape, folds the list
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  if (!pins.length) return null;
  const dayOf = (day: string) =>
    new Date(`${day}T12:00:00`).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long" });

  return (
    <div className={styles.box} ref={box}>
      <button
        className={`${className} ${styles.btn}`}
        onClick={() => {
          if (pins.length === 1) {
            sfx.flip();
            openPinned(pins[0]);
            return;
          }
          sfx.pop();
          setOpen(!open);
        }}
        aria-label={tr("Le courrier", "The mail")}
        aria-expanded={pins.length > 1 ? open : undefined}
        title={tr("Le courrier", "The mail")}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <path d="M3 6h18v13H3z" fill="currentColor" />
          <path d="M3 6l9 7 9-7" fill="none" stroke="#150f1f" strokeWidth="2" />
        </svg>
        {pins.length > 1 && <span className={styles.count}>{pins.length}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            className={styles.list}
            initial={{ opacity: 0, y: -8, scaleY: 0.6 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
          >
            {pins.map((l, i) => (
              <li key={l.day}>
                <button
                  onPointerEnter={sfx.hover}
                  onClick={() => {
                    sfx.flip();
                    setOpen(false);
                    openPinned(l);
                  }}
                >
                  <span className={styles.env} aria-hidden>
                    ✉
                  </span>
                  {dayOf(l.day)}
                  {i === 0 && <small>{tr("le dernier", "latest")}</small>}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
