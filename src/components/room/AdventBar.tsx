"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdvent, useAdventToday } from "@/lib/advent";
import { claimAsk, useAskFree, useAskUp, useWantAsk } from "@/lib/calm";
import { useT } from "@/lib/lang";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import styles from "./ImportBar.module.css";

const CALM_MS = 1200;
/** Closed today: not again until tomorrow's box (per device) */
const key = (day: number) => `nookdex:advent-bar:${day}`;
const closedToday = (day: number) => {
  try {
    return !!localStorage.getItem(key(day));
  } catch {
    return false;
  }
};

/**
 * « Ta case du jour t'attend » (Johan, 2026-11-16): in December, while today's Advent box is shut, a strip in the calm room,
 * at the top on a computer, at the bottom on a phone (where the tree is out of frame), that opens the calendar. One of
 * lib/calm's gifts: it waits for whatever is on screen, and never takes an ask's turn.
 */
export function AdventBar({ compact, calm, onOpen }: { compact: boolean; calm: boolean; onOpen: () => void }) {
  const t = useT();
  const pathname = usePathname();
  const profile = useStore((s) => !!s.profile);
  // a newcomer's first steps come first (the welcome, the tour, a binder and a card): the calendar after
  const settled = useStore((s) => s.binders.length > 0 && Object.keys(s.collection).length > 0);
  const today = useAdventToday();
  const opened = useAdvent();
  const [shown, setShown] = useState(false);
  const waiting = !!today && !opened.includes(today) && !closedToday(today);
  const eligible = calm && profile && settled && waiting && (pathname === "/" || pathname === "/en");
  useWantAsk("advent", eligible && !shown);
  const free = useAskFree("advent");
  useAskUp("advent", shown && eligible);

  const done = () => {
    try {
      if (today) localStorage.setItem(key(today), "1");
    } catch {}
    setShown(false);
  };

  // nothing opened yet: the calendar opens by itself, its first box brings the tree (Johan, 2026-11-16: make it obvious)
  const fresh = opened.length === 0;
  useEffect(() => {
    if (!eligible || !free || shown) return;
    const id = setTimeout(() => {
      if (!claimAsk("advent")) return;
      if (fresh) {
        done();
        onOpen();
      } else setShown(true);
    }, CALM_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- done and onOpen: the moment it's claimed only
  }, [eligible, free, shown, fresh]);

  return (
    <AnimatePresence>
      {shown && eligible && today && (
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
                🎄 La case <b>{today}</b> du calendrier de l&apos;Avent t&apos;attend !
              </>,
              <>
                🎄 Door <b>{today}</b> of the Advent calendar is waiting for you!
              </>,
            )}
          </span>
          <button
            className={styles.go}
            onClick={() => {
              sfx.boot();
              setShown(false);
              onOpen();
            }}
            onPointerEnter={sfx.hover}
          >
            {t("Ouvrir ▶", "Open ▶")}
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
