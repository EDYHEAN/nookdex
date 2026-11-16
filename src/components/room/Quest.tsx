"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useAskUp, useOthersUp } from "@/lib/calm";
import { useLang, useT } from "@/lib/lang";
import { sfx } from "@/lib/sound";
import styles from "./Quest.module.css";

/** the cards that make a collection: past them a player comes back four times as often (business review, 2026-11-14) */
export const QUEST_GOAL = 10;
/** "min": folded to its pill; "done": the 10th card was celebrated, never again on this device (outside the save) */
const KEY = "nookdex:quest10";
const CHEER_MS = 4200;

const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const write = (v: string) => {
  try {
    localStorage.setItem(KEY, v);
  } catch {}
};

/**
 * « Quête : tes 10 premières cartes » (Johan, 2026-11-15, from the business review: 58 % of the players past 10 cards came
 * back another day, 15 % of the others, and the 10 are made in the first hour or never). From the end of the tour to the
 * 10th card, in the room and over an open binder: ten boxes filling, and the two ways to get there at once (« J'ai tout »
 * in a set binder, the Pokécardex import on the French site). It replaced the Pokécardex strip (room/ImportBar). ✕ folds
 * it to a pill; the 10th card gets its cheer, then it's gone for good.
 */
export function Quest({
  count,
  show: wanted,
  compact,
  canFill,
  onFill,
  onImport,
}: {
  /** the copies the player owns */
  count: number;
  /** nothing in the way: a profile, no welcome, no tour, no panel but a binder */
  show: boolean;
  compact: boolean;
  /** a set binder to fill exists */
  canFill: boolean;
  onFill: () => void;
  onImport: () => void;
}) {
  const t = useT();
  const fr = useLang() === "fr";
  // (the room is drawn in the browser only: localStorage is there from the first render)
  const [state, setState] = useState<string | null>(read);
  const [cheer, setCheer] = useState(false);
  // the quest was on screen under 10 this visit: only then is the 10th card cheered (not an old player's load)
  const seen = useRef(false);

  const reached = count >= QUEST_GOAL;
  const open = state !== "done" && !reached;
  // a phone has one bottom strip (lib/calm): the quest steps aside for the others, and holds them back while it's out
  const blocked = useOthersUp("quest");
  const show = wanted && !(compact && blocked);
  useAskUp("quest", compact && show && open && state !== "min");
  useEffect(() => {
    if (open && show) seen.current = true;
  }, [open, show]);

  useEffect(() => {
    if (!reached || state === "done") return;
    // (the quest itself closes with the count: `open`)
    write("done");
    if (!seen.current) return;
    seen.current = false;
    const on = setTimeout(() => {
      setCheer(true);
      sfx.trophy("gold");
    }, 250);
    const off = setTimeout(() => setCheer(false), 250 + CHEER_MS);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
    // (on reaching 10 only: an 11th card mid-cheer mustn't cut its timers)
  }, [reached, state]);

  const left = QUEST_GOAL - count;
  const min = state === "min";
  const boxes = (
    <span className={styles.boxes} aria-hidden>
      {Array.from({ length: QUEST_GOAL }, (_, i) => (
        <i key={i} className={i < count ? styles.on : undefined} style={{ animationDelay: `${i * 40}ms` }} />
      ))}
    </span>
  );

  return (
    <AnimatePresence>
      {show && cheer && (
        <motion.div
          key="cheer"
          className={`${styles.quest} ${styles.cheer} ${compact ? styles.phone : ""}`}
          role="status"
          initial={{ opacity: 0, scale: 0.6, rotate: -4 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 360, damping: 18 }}
        >
          <span className={styles.head}>🎉 {t("Quête réussie !", "Quest complete!")}</span>
          {boxes}
          <span className={styles.sub}>{t("10 cartes : ta collection a sa cote et ses courbes.", "10 cards: your collection has its value and its charts.")}</span>
        </motion.div>
      )}
      {show && open && min && (
        <motion.button
          key="pill"
          className={`${styles.pill} ${compact ? styles.pillPhone : ""}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ type: "spring", stiffness: 420, damping: 20 }}
          onClick={() => {
            sfx.pop();
            write("");
            setState(null);
          }}
          onPointerEnter={sfx.hover}
          title={t("Quête : tes 10 premières cartes", "Quest: your first 10 cards")}
        >
          🎯 <b>{count}</b>/{QUEST_GOAL}
        </motion.button>
      )}
      {show && open && !min && (
        <motion.div
          key="quest"
          className={`${styles.quest} ${compact ? styles.phone : ""}`}
          role="status"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
        >
          <span className={styles.head}>🎯 {t("Quête : tes 10 premières cartes", "Quest: your first 10 cards")}</span>
          <span className={styles.row}>
            {boxes}
            <b className={styles.count}>
              {count} / {QUEST_GOAL}
            </b>
          </span>
          {!compact && (
            <span className={styles.sub}>
              {left === 1
                ? t("Plus qu'une : ta collection aura sa cote !", "Just one more: your collection gets its value!")
                : t(`Encore ${left} : ta collection aura sa cote !`, `${left} to go: your collection gets its value!`)}
            </span>
          )}
          <span className={styles.btns}>
            {canFill && (
              <button
                className={styles.go}
                onClick={() => {
                  sfx.pop();
                  onFill();
                }}
                onPointerEnter={sfx.hover}
              >
                {t("J'ai tout ✓", "Got 'em all ✓")}
              </button>
            )}
            {fr && (
              <button
                className={`${styles.go} ${styles.alt}`}
                onClick={() => {
                  sfx.boot();
                  onImport();
                }}
                onPointerEnter={sfx.hover}
              >
                📦 Importer
              </button>
            )}
          </span>
          <button
            className={styles.close}
            onClick={() => {
              sfx.click();
              write("min");
              setState("min");
            }}
            aria-label={t("Réduire", "Fold")}
            title={t("Réduire", "Fold")}
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
