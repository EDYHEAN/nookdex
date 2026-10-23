"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/lang";
import { sfx } from "@/lib/sound";
import { claimAsk, useAskFree } from "@/lib/calm";
import { useStore } from "@/lib/store";
import styles from "./ImportBar.module.css";

/** Past this many cards the player has started filing by hand: the bar is no news to them. */
const MAX_CARDS = 10;
const CALM_MS = 2500;
/** Closed or used: never again on this device (outside the save). */
const KEY = "nookdex:pokecardex-bar";

const closed = () => {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
};

/**
 * A strip saying the Pokécardex import exists (Johan, 2026-10-20: it sat at the bottom of the OS's Save tab, where a
 * newcomer never looks, and a collector won't tick hundreds of cards again by hand). French site only: Pokécardex is
 * French. In the calm room, to a player with fewer than 10 cards; at the top on a computer, at the bottom on a phone.
 */
export function ImportBar({ compact, calm, onImport }: { compact: boolean; calm: boolean; onImport: () => void }) {
  const fr = useLang() === "fr";
  const pathname = usePathname();
  const owned = useStore((s) => Object.keys(s.collection).length);
  const profile = useStore((s) => !!s.profile);
  const [shown, setShown] = useState(false);

  // (App: only from the 3rd day of visits, before 10 cards it's the only way it can show: lib/calm)
  const free = useAskFree("import");
  const eligible = fr && calm && profile && owned < MAX_CARDS && pathname === "/";

  useEffect(() => {
    if (!eligible || closed()) return;
    const id = setTimeout(() => claimAsk("import") && setShown(true), CALM_MS);
    return () => clearTimeout(id);
  }, [eligible]);

  const done = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
    setShown(false);
  };

  return (
    <AnimatePresence>
      {shown && eligible && free && (
        <motion.div
          className={`${styles.bar} ${compact ? styles.phone : ""}`}
          role="status"
          initial={{ opacity: 0, y: compact ? 40 : -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: compact ? 40 : -40 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
        >
          <span className={styles.text}>
            📦 Ta collection est sur <b>Pokécardex</b> ? Importe-la en 2 minutes, sans tout recocher.
          </span>
          <button
            className={styles.go}
            onClick={() => {
              sfx.boot();
              done();
              onImport();
            }}
            onPointerEnter={sfx.hover}
          >
            Importer ▶
          </button>
          <button
            className={styles.close}
            onClick={() => {
              sfx.click();
              done();
            }}
            aria-label="Fermer"
            title="Fermer"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
