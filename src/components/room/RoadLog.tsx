"use client";

import { motion } from "motion/react";
import { useEffect } from "react";
import { CHANGELOG, type Release } from "@/data/changelog";
import { useLang, useT } from "@/lib/lang";
import { sfx } from "@/lib/sound";
import styles from "./RoadLog.module.css";

/** Per device, outside the save: the last version whose road log the player was shown. */
const SEEN_KEY = "nookdex:seen-version";

export const seenVersion = () => {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
};
export const markSeen = (version: string) => {
  try {
    localStorage.setItem(SEEN_KEY, version);
  } catch {
    // private window: it shows again next visit
  }
};

/** One version: its date, title and changes (folded, its summary already says the version and title). */
function Entry({ release, lang, folded }: { release: Release; lang: "fr" | "en"; folded?: boolean }) {
  const date = new Date(release.date).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <>
      <p className={styles.date}>
        {!folded && <b>v{release.version} · </b>}
        {date}
      </p>
      {!folded && <h3>{release.title[lang]}</h3>}
      <ul>
        {release.items.map((item) => (
          <li key={item.fr}>{item[lang]}</li>
        ))}
      </ul>
    </>
  );
}

/**
 * The road log: what changed in NookDex, version by version. The newest one is open, the older ones fold.
 * It pops once per version for a returning player, and opens from the version label in the room's corner.
 */
export function RoadLog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const [latest, ...older] = CHANGELOG;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const close = () => {
    sfx.click();
    onClose();
  };

  return (
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <motion.article
        className={styles.book}
        role="dialog"
        aria-label={t("Carnet de route", "Road log")}
        initial={{ y: 120, rotate: -4, scale: 0.8, opacity: 0 }}
        animate={{ y: 0, rotate: -0.6, scale: 1, opacity: 1 }}
        exit={{ y: 80, rotate: 3, opacity: 0, transition: { duration: 0.25 } }}
        transition={{ type: "spring", stiffness: 240, damping: 20 }}
      >
        <button className={styles.close} onClick={close} onPointerEnter={sfx.hover} aria-label={t("Refermer le carnet", "Close the notebook")}>
          ✕
        </button>
        <h2 className={styles.title}>{t("Carnet de route", "Road log")}</h2>
        <p className={styles.intro}>{t("Quoi de neuf sur le bureau ?", "What's new on the desk?")}</p>
        <span className={styles.stamp} aria-hidden>
          v{latest.version}
        </span>

        <section className={styles.latest}>
          <Entry release={latest} lang={lang} />
        </section>

        <h4 className={styles.olderTitle}>{t("Les versions d'avant", "Earlier versions")}</h4>
        {older.map((r) => (
          <details key={r.version} className={styles.older}>
            <summary onClick={() => sfx.click()}>
              <b>v{r.version}</b> {r.title[lang]}
            </summary>
            <Entry release={r} lang={lang} folded />
          </details>
        ))}

        <div className={styles.actions}>
          <button className={styles.ok} onClick={close} onPointerEnter={sfx.hover}>
            {t("C'est noté !", "Got it!")}
          </button>
        </div>
      </motion.article>
    </motion.div>
  );
}
