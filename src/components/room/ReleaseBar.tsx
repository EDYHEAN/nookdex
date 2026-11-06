"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { claimAsk, useAskFree, useAskUp, useWantAsk } from "@/lib/calm";
import { useT } from "@/lib/lang";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import styles from "./ImportBar.module.css";

/** The release weekend (Johan, 2026-11-06): Delta Reign came out on Friday, the bar goes on Monday at midnight in Paris. */
const SET = "me06";
const UNTIL = Date.parse("2026-11-10T00:00:00+01:00");
const CALM_MS = 1500;
/** Closed or used: not again on this device. */
const KEY = `nookdex:release-bar:${SET}`;

const closed = () => {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
};

/**
 * « Bon opening » for a release weekend: a strip in the calm room, at the top on a computer, at the bottom on a phone, that
 * opens the set's binder (or the new-binder sheet with it on top, like ?classeur=). One of lib/calm's gifts: it waits for
 * whatever is on screen to be put away, and never takes an ask's turn.
 */
export function ReleaseBar({ compact, calm, onOpen }: { compact: boolean; calm: boolean; onOpen: (set: string) => void }) {
  const t = useT();
  const pathname = usePathname();
  const profile = useStore((s) => !!s.profile);
  const [shown, setShown] = useState(false);
  const [over] = useState(() => Date.now() >= UNTIL);
  const eligible = calm && profile && !over && (pathname === "/" || pathname === "/en");
  useWantAsk("release", eligible && !shown && !closed());
  const free = useAskFree("release");
  useAskUp("release", shown && eligible);

  useEffect(() => {
    if (!eligible || !free || shown || closed()) return;
    const id = setTimeout(() => claimAsk("release") && setShown(true), CALM_MS);
    return () => clearTimeout(id);
  }, [eligible, free, shown]);

  const done = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
    setShown(false);
  };

  return (
    <AnimatePresence>
      {shown && eligible && (
        <motion.div
          className={`${styles.bar} ${compact ? styles.phone : ""}`}
          role="status"
          initial={{ opacity: 0, y: compact ? 40 : -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: compact ? 40 : -40 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
        >
          <span className={styles.text}>
            {t(
              <>
                🎉 <b>Règne Delta</b> est sorti : bon opening ce week-end !
              </>,
              <>
                🎉 <b>Delta Reign</b> is out: happy opening this weekend!
              </>,
            )}
          </span>
          <button
            className={styles.go}
            onClick={() => {
              sfx.boot();
              done();
              onOpen(SET);
            }}
            onPointerEnter={sfx.hover}
          >
            {t("Mon classeur ▶", "My binder ▶")}
          </button>
          <button
            className={styles.close}
            onClick={() => {
              sfx.click();
              done();
            }}
            aria-label={t("Fermer", "Close")}
            title={t("Fermer", "Close")}
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
