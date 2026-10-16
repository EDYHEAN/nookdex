"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { catalogSet } from "@/lib/catalog";
import { useT } from "@/lib/lang";
import type { ImportResult } from "@/lib/pokecardex";
import { sfx } from "@/lib/sound";
import styles from "./ImportReport.module.css";

/**
 * After reading a Pokécardex export: what came in, set by set on tiles (a tap puts a set on the shelf or in the box), and
 * what wasn't found, grouped by why. Over NookDex OS, on paper like the room's notebooks.
 */
export function ImportReport({
  result,
  room,
  onShelf,
  initial,
  onConfirm,
  onCancel,
}: {
  result: ImportResult;
  /** free places on the shelf */
  room: number;
  /** sets that already have their binder */
  onShelf: Set<string>;
  /** sets picked for the shelf at first */
  initial: Set<string>;
  onConfirm: (shelf: Set<string>) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [shelf, setShelf] = useState(initial);
  const [open, setOpen] = useState(false);
  const copies = result.found.reduce((n, f) => n + f.qty, 0);
  const missed = result.missing.reduce((n, m) => n + m.qty, 0);
  const full = shelf.size >= room;
  const toggle = (id: string) => {
    const next = new Set(shelf);
    if (next.has(id)) {
      next.delete(id);
      sfx.shelfOut();
    } else if (!full) {
      next.add(id);
      sfx.shelfIn();
    } else return sfx.locked();
    setShelf(next);
  };
  // sets of the series NookDex makes binders of, then the older ones (no binder yet: the box)
  const binderable = result.sets.filter((s) => s.binder);
  const older = result.sets.filter((s) => !s.binder);
  const lang = result.missing.filter((m) => m.why === "lang");
  const notHere = result.missing.filter((m) => m.why !== "lang");

  return createPortal(
    <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section
        className={styles.sheet}
        role="dialog"
        aria-label={t("Ta collection Pokécardex", "Your Pokécardex collection")}
        initial={{ y: 40, scale: 0.95, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
      >
        <button className={styles.close} onClick={onCancel} onPointerEnter={sfx.hover} aria-label={t("Annuler l'import", "Cancel the import")}>
          ✕
        </button>
        <p className={styles.kicker}>{t("IMPORT POKECARDEX", "POKECARDEX IMPORT")}</p>
        <h2>{t("Ta collection est arrivée !", "Your collection is here!")}</h2>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <b>{copies.toLocaleString()}</b>
            <span>{t("cartes", "cards")}</span>
          </div>
          <div className={styles.stat}>
            <b>{result.sets.length}</b>
            <span>{t("extensions", "sets")}</span>
          </div>
          {missed > 0 && (
            <button className={`${styles.stat} ${styles.statMiss}`} onClick={() => setOpen(!open)}>
              <b>{missed}</b>
              <span>{t("absentes ▾", "missing ▾")}</span>
            </button>
          )}
        </div>

        <AnimatePresence>
          {open && (
            <motion.div className={styles.missing} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {lang.length > 0 && (
                <div>
                  <h3>{t(`🌏 Langue pas encore gérée · ${lang.length}`, `🌏 Language not handled yet · ${lang.length}`)}</h3>
                  <ul>{lang.map((m, i) => <li key={i}>{m.name}</li>)}</ul>
                </div>
              )}
              {notHere.length > 0 && (
                <div>
                  <h3>{t(`🔍 Pas encore sur NookDex · ${notHere.length}`, `🔍 Not on NookDex yet · ${notHere.length}`)}</h3>
                  <ul>
                    {notHere.map((m, i) => (
                      <li key={i}>
                        {m.name} <small>{m.set}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className={styles.rangeHead}>
          <h3>{t("Où ranger ?", "Where to?")}</h3>
          <span className={styles.legend}>
            <span className={styles.tagShelf}>📚 {t("étagère", "shelf")}</span> <span className={styles.tagBox}>📦 {t("boîte", "box")}</span> ·{" "}
            {t("touche pour changer", "tap to switch")} · {t(`${room - shelf.size} places libres`, `${room - shelf.size} free places`)}
          </span>
        </div>

        <ul className={styles.tiles}>
          {binderable.map((s) => {
            const has = onShelf.has(s.setId);
            const on = has || shelf.has(s.setId);
            const logo = catalogSet(s.setId)?.logo;
            const fixed = has || !s.binder;
            return (
              <li key={s.setId}>
                <button
                  className={`${styles.tile} ${on ? styles.tileOn : ""} ${fixed ? styles.tileFixed : ""}`}
                  disabled={fixed}
                  onPointerEnter={fixed ? undefined : sfx.hover}
                  onClick={() => toggle(s.setId)}
                  aria-pressed={on}
                >
                  <span className={styles.logo}>{logo ? <img src={`${logo}.png`} alt="" draggable={false} /> : <span>{s.name}</span>}</span>
                  <span className={styles.count}>{s.copies}</span>
                  <span className={on ? styles.tagShelf : styles.tagBox}>
                    {has ? t("📚 déjà là", "📚 already up") : on ? t("📚 étagère", "📚 shelf") : t("📦 boîte", "📦 box")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {older.length > 0 && (
          <div className={styles.older}>
            <h3>{t(`📦 Directement dans la boîte · ${older.length}`, `📦 Straight into the box · ${older.length}`)}</h3>
            <ul className={styles.chips}>
              {older.map((s) => (
                <li key={s.setId}>
                  {s.name} <small>{s.copies}</small>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.btn} onClick={onCancel} onPointerEnter={sfx.hover}>
            {t("Annuler", "Cancel")}
          </button>
          <button className={`${styles.btn} ${styles.primary}`} onClick={() => onConfirm(shelf)} onPointerEnter={sfx.hover}>
            {t(`Ranger mes ${copies.toLocaleString()} cartes`, `File my ${copies.toLocaleString()} cards`)}
          </button>
        </div>
      </motion.section>
    </motion.div>,
    document.body,
  );
}
