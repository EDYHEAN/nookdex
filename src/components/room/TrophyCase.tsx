"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useLang, useT } from "@/lib/lang";
import { sfx } from "@/lib/sound";
import { CATS, TIER_POINTS, TROPHIES, type Trophy } from "@/lib/trophies";
import { useTrophyStore } from "@/lib/trophyStore";
import { Medal } from "./Medal";
import { trophyText } from "./TrophyToast";
import styles from "./Trophies.module.css";

const TIER_NOTE = { bronze: 0, silver: 1, gold: 2, platinum: 3 } as const;

/**
 * The trophy case, out of the Poké Ball on the shelf: a wooden cabinet, one velvet shelf per family of trophies,
 * the brass plate below tells the one picked. Secrets stay "???" until found. Opens from where the ball is.
 */
export function TrophyCase({ origin, onClose }: { origin: { x: number; y: number }; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const got = useTrophyStore((s) => s.got);
  // what was won since the last visit shines "new" this time (the store moves on at once)
  const [seenAt] = useState(() => useTrophyStore.getState().seenAt);
  useEffect(() => {
    useTrophyStore.setState({ seenAt: Date.now() });
    return () => {
      useTrophyStore.setState({ seenAt: Date.now() });
    };
  }, []);

  const [picked, setPicked] = useState<Trophy | null>(() => {
    const fresh = TROPHIES.filter((x) => (got[x.id] ?? 0) > seenAt).sort((a, b) => got[b.id] - got[a.id]);
    return fresh[0] ?? null;
  });
  const [flip, setFlip] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const won = TROPHIES.filter((x) => got[x.id]);
  const score = won.reduce((n, x) => n + TIER_POINTS[x.tier], 0);
  const max = TROPHIES.reduce((n, x) => n + TIER_POINTS[x.tier], 0);
  const shelves = useMemo(() => CATS.map((c) => ({ ...c, trophies: TROPHIES.filter((x) => x.cat === c.id) })), []);

  const close = () => {
    sfx.click();
    onClose();
  };

  // the cabinet comes out of the ball: from its place on screen to the middle
  const from = typeof window === "undefined" ? { x: 0, y: 0 } : { x: origin.x - window.innerWidth / 2, y: origin.y - window.innerHeight / 2 };
  const date = picked && got[picked.id] && new Date(got[picked.id]).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "long", year: "numeric" });
  const hidden = picked && picked.secret && !got[picked.id];

  return (
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { delay: 0.1 } }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {/* the ball's burst of light */}
      <motion.span
        className={styles.burst}
        style={{ left: origin.x, top: origin.y }}
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 1, opacity: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        aria-hidden
      />
      <motion.section
        className={styles.case}
        role="dialog"
        aria-label={t("Vitrine à trophées", "Trophy case")}
        initial={{ x: from.x, y: from.y, scale: 0.05, opacity: 0, rotate: -8 }}
        animate={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
        exit={{ x: from.x, y: from.y, scale: 0.05, opacity: 0, rotate: 6, transition: { duration: 0.32, ease: "easeIn" } }}
        transition={{ type: "spring", stiffness: 210, damping: 19, delay: 0.08 }}
      >
        <button className={styles.close} onClick={close} onPointerEnter={sfx.hover} aria-label={t("Refermer la vitrine", "Close the case")}>
          ✕
        </button>
        <header className={styles.caseHead}>
          <h2>{t("Vitrine à trophées", "Trophy case")}</h2>
          <p>
            <b>
              {won.length}/{TROPHIES.length}
            </b>{" "}
            {t("trophées", "trophies")} · <b>{score}</b> / {max} pts
          </p>
          <span className={styles.bar}>
            <motion.span initial={{ width: 0 }} animate={{ width: `${(score / max) * 100}%` }} transition={{ delay: 0.5, duration: 0.9, ease: "easeOut" }} />
          </span>
        </header>

        <div className={styles.shelves}>
          {shelves.map((shelf, si) => (
            <section key={shelf.id} className={styles.shelf}>
              <h3>
                {t(shelf.fr, shelf.en)}
                <span>
                  {shelf.trophies.filter((x) => got[x.id]).length}/{shelf.trophies.length}
                </span>
              </h3>
              <div className={styles.row}>
                {shelf.trophies.map((x, i) => {
                  const fresh = (got[x.id] ?? 0) > seenAt;
                  return (
                    <motion.button
                      key={x.id}
                      className={`${styles.slot} ${picked?.id === x.id ? styles.picked : ""}`}
                      initial={{ y: -24, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 + si * 0.06 + i * 0.025, type: "spring", stiffness: 500, damping: 18 }}
                      onPointerEnter={sfx.hover}
                      onClick={() => {
                        if (got[x.id]) sfx.spine(TIER_NOTE[x.tier] * 2 + 2);
                        else sfx.click();
                        setPicked(x);
                        setFlip((f) => f + 1);
                      }}
                      aria-label={x.secret && !got[x.id] ? "???" : t(x.name.fr, x.name.en)}
                    >
                      <motion.span
                        key={picked?.id === x.id ? flip : 0}
                        style={{ display: "inline-block" }}
                        initial={picked?.id === x.id ? { rotateY: 0 } : false}
                        animate={{ rotateY: picked?.id === x.id && got[x.id] ? 360 : 0 }}
                        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.3, 1.1] }}
                      >
                        <Medal trophy={x} won={!!got[x.id]} />
                      </motion.span>
                      {fresh && <span className={styles.fresh}>{t("NEW", "NEW")}</span>}
                    </motion.button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* the brass plate: the trophy picked */}
        <footer className={styles.plate}>
          {picked ? (
            <motion.div key={picked.id} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.2 }}>
              <p className={styles.plateName}>
                {hidden ? "???" : t(picked.name.fr, picked.name.en)}
                <span className={`${styles.tierTag} ${styles["tag_" + picked.tier]}`}>
                  {{ bronze: t("Bronze", "Bronze"), silver: t("Argent", "Silver"), gold: t("Or", "Gold"), platinum: t("Platine", "Platinum") }[picked.tier]} · {TIER_POINTS[picked.tier]} pts
                </span>
              </p>
              <p className={styles.plateDesc}>
                {hidden ? t("Un secret du bureau… continue d'explorer.", "A secret of the desk… keep exploring.") : trophyText(t(picked.desc.fr, picked.desc.en))}
              </p>
              <p className={styles.plateDate}>{date ? t(`Gagné le ${date}`, `Won on ${date}`) : t("Pas encore gagné", "Not won yet")}</p>
            </motion.div>
          ) : (
            <p className={styles.plateDesc}>{t("Choisis un trophée pour lire sa plaque.", "Pick a trophy to read its plate.")}</p>
          )}
        </footer>
      </motion.section>
    </motion.div>
  );
}
