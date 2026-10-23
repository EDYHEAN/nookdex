"use client";

import { motion } from "motion/react";
import { useEffect } from "react";
import { useT } from "@/lib/lang";
import { sfx } from "@/lib/sound";
import { type ListTab, ShareListPanel } from "./ShareListPanel";
import styles from "./TradeBinder.module.css";

/**
 * « Mon classeur d'échange » open (Johan, 2026-10-23): the gold binder of the shelf, pulled out like a set binder. Its
 * cover frames the page that holds the public list (share/ShareListPanel). Full screen on a phone.
 */
export function TradeBinder({ onClose, focusSet, startTab }: { onClose: () => void; focusSet?: string; startTab?: ListTab }) {
  const tr = useT();

  useEffect(() => {
    sfx.coverOpen();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // (the shelf plays the binder going back in)
  const close = () => onClose();

  return (
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <motion.div
        className={styles.cover}
        role="dialog"
        aria-label={tr("Mon classeur d'échange", "My trade binder")}
        initial={{ y: "-30%", scale: 0.6, rotate: -6, opacity: 0 }}
        animate={{ y: 0, scale: 1, rotate: 0, opacity: 1 }}
        exit={{ y: "-20%", scale: 0.7, rotate: -4, opacity: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
      >
        {/* the binder's rings, down the left of the cover (a computer: a phone has no room for them) */}
        <span className={styles.rings} aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <div className={styles.page}>
          <header className={styles.head}>
            <h2>
              <span aria-hidden>⇄</span> {tr("Mon classeur d'échange", "My trade binder")}
            </h2>
            <button className={styles.close} onClick={close} onPointerEnter={sfx.hover}>
              {tr("Ranger", "Put away")} <kbd>{tr("Échap", "Esc")}</kbd>
            </button>
          </header>
          <ShareListPanel focusSet={focusSet} startTab={startTab} />
        </div>
      </motion.div>
    </motion.div>
  );
}
