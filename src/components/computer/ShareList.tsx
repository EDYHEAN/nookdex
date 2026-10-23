"use client";

import { motion } from "motion/react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/lang";
import { sfx } from "@/lib/sound";
import { ShareListPanel } from "../share/ShareListPanel";
import styles from "./ShareList.module.css";

/**
 * « Ma liste » as a paper sheet over NookDex OS or an open binder (the inside is share/ShareListPanel, which can be
 * mounted elsewhere). Drawn in <body>, out of their zoom transforms.
 */
export function ShareList({ onClose, focusSet }: { onClose: () => void; focusSet?: string }) {
  const tr = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className={styles.sheet}
        role="dialog"
        aria-label={tr("Ma liste d'échange", "My trade list")}
        initial={{ y: 60, scale: 0.9, rotate: -2 }}
        animate={{ y: 0, scale: 1, rotate: 0 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
      >
        <button className={styles.close} onClick={() => (sfx.click(), onClose())} aria-label={tr("Fermer", "Close")}>
          ✕
        </button>
        <h2>{tr("Ma liste d'échange", "My trade list")}</h2>
        <ShareListPanel focusSet={focusSet} />
      </motion.div>
    </motion.div>,
    document.body,
  );
}
