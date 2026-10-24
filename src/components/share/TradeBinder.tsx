"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { useT } from "@/lib/lang";
import { sfx } from "@/lib/sound";
import { type ListView, TradePanel } from "./TradePanel";
import styles from "./TradeBinder.module.css";

/**
 * « Mon classeur d'échange » open (Johan, 2026-10-23): the gold binder of the shelf, pulled out like a set binder. Its gold
 * edge frames the page that holds the public list (share/TradePanel, which has its own header and close button). Full
 * screen on a phone.
 */
export function TradeBinder({ onClose, focusSet, start }: { onClose: () => void; focusSet?: string; start?: ListView }) {
  const tr = useT();
  // App passes a new onClose on each render: kept in a ref so the effects below run once, not on every render
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  // The shelf already played its pull-out sound on the click: the cover opens once the binder has landed, like a set
  // binder's (BinderView), instead of both sounds at once.
  useEffect(() => {
    const t = setTimeout(() => sfx.coverOpen(), 380);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // (a bottom sheet open catches Escape first: share/BottomSheet)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className={styles.cover}
        role="dialog"
        aria-label={tr("Mon classeur d'échange", "My trade binder")}
        initial={{ y: "-30%", scale: 0.6, rotate: -6, opacity: 0 }}
        animate={{ y: 0, scale: 1, rotate: 0, opacity: 1 }}
        exit={{ y: "-20%", scale: 0.7, rotate: -4, opacity: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
      >
        <TradePanel onClose={onClose} focusSet={focusSet} start={start} />
      </motion.div>
    </motion.div>
  );
}
