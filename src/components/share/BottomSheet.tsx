"use client";

import { motion } from "motion/react";
import { type ReactNode, createContext, useContext, useEffect } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/lang";
import { sfx } from "@/lib/sound";
import styles from "./TradePanel.module.css";

/**
 * The trade binder's bottom sheet: a set's cards, slid up over the panel (not the whole page: in NookDex OS it stays in the
 * screen). Drawn in the panel's own layer (SheetHost), out of the views' slide transforms.
 */
export const SheetHost = createContext<HTMLElement | null>(null);

export function BottomSheet({ logo, title, sub, onClose, children }: { logo?: string | null; title: string; sub: ReactNode; onClose: () => void; children: ReactNode }) {
  const tr = useT();
  const host = useContext(SheetHost);

  useEffect(() => {
    // Escape closes the sheet, not the binder under it
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  if (!host) return null;
  return createPortal(
    <>
      <motion.div className={styles.dim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => (sfx.click(), onClose())} />
      <motion.div
        className={styles.sheet}
        role="dialog"
        aria-label={title}
        data-bottom-sheet
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
      >
        <span className={styles.grab} aria-hidden />
        <div className={styles.sheetHead}>
          {logo ? <img src={`${logo}.png`} alt="" /> : <span className={styles.sheetStar}>★</span>}
          <div>
            <b>{title}</b>
            {sub}
          </div>
          <button className={styles.x} onClick={() => (sfx.click(), onClose())} aria-label={tr("Fermer", "Close")}>
            ✕
          </button>
        </div>
        {children}
      </motion.div>
    </>,
    host,
  );
}
