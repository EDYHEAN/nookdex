"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/lang";
import { sceneImg } from "@/lib/scene";
import { SUPPORT_URL } from "@/lib/site";
import { sfx } from "@/lib/sound";
import { unlock } from "@/lib/trophyStore";
import { useStore } from "@/lib/store";
import styles from "./SupportCat.module.css";

/** Cards the player must own before the cat asks: they've seen what the desk is worth. */
const MIN_CARDS = 10;
/** The room must have been calm this long (and the visit be this old) before the cat shows up. */
const CALM_MS = 2500;
const VISIT_MS = 20_000;
const DAY = 86_400_000;
/** Once shown, it waits three weeks; after a tip, half a year. Per device (localStorage), outside the save. */
const LATER_DAYS = 21;
const THANKS_DAYS = 180;
const KEY = "nookdex:support-next";

const nextShow = () => {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
};
const snooze = (days: number) => {
  try {
    localStorage.setItem(KEY, String(Date.now() + days * DAY));
  } catch {
    // private window: it may ask again next visit
  }
};

/** The empty bowl, drawn in the room's ink; kibble falls in once the player tipped. */
function Bowl({ full }: { full: boolean }) {
  return (
    <svg className={styles.bowl} viewBox="0 0 120 56" aria-hidden>
      {full &&
        [18, 34, 50, 66, 82, 98, 42, 58, 74].map((x, i) => (
          <motion.circle
            key={i}
            cx={x}
            cy={i < 6 ? 22 : 14}
            r={7}
            fill={i % 2 ? "#b8743a" : "#9c5a2a"}
            stroke="#2b2230"
            strokeWidth={2}
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 400, damping: 14 }}
          />
        ))}
      <path d="M6 22 H114 L102 50 Q60 58 18 50 Z" fill="#c9502f" stroke="#2b2230" strokeWidth="4" strokeLinejoin="round" />
      <path d="M14 30 H106" stroke="#fdf2e8" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      <text x="60" y="46" textAnchor="middle" fontSize="12" fill="#fdf2e8" fontFamily="var(--font-press), monospace">
        MIAM
      </text>
    </svg>
  );
}

/**
 * The cat asks for a tip, once the player has filled a binder a little: a pop-in on a computer, a toast on a phone.
 * Only in the calm room (nothing open, no tour), on the desk's own address, at most once every three weeks.
 */
export function SupportCat({ compact, calm }: { compact: boolean; calm: boolean }) {
  const t = useT();
  const pathname = usePathname();
  const owned = useStore((s) => Object.keys(s.collection).length);
  const [shown, setShown] = useState(false);
  const [thanks, setThanks] = useState(false);
  /** asked once this visit, whatever the answer */
  const [asked, setAsked] = useState(false);
  const since = useRef(0);

  const eligible = calm && owned >= MIN_CARDS && (pathname === "/" || pathname === "/en") && !asked;

  useEffect(() => {
    if (!since.current) since.current = Date.now();
    if (!eligible || Date.now() < nextShow()) return;
    const wait = Math.max(CALM_MS, VISIT_MS - (Date.now() - since.current));
    const id = setTimeout(() => {
      setAsked(true);
      snooze(LATER_DAYS);
      setShown(true);
      sfx.purr();
    }, wait);
    return () => clearTimeout(id);
  }, [eligible]);

  // the player opened a binder or the OS meanwhile: the cat steps aside, and waits for the room to be calm again
  const visible = shown && (calm || thanks);

  const later = () => {
    sfx.click();
    setShown(false);
  };
  const tip = () => {
    sfx.coin();
    unlock("treat");
    snooze(THANKS_DAYS);
    setThanks(true);
    setTimeout(() => sfx.purr(), 350);
    setTimeout(() => setShown(false), 2600);
  };

  const title = thanks ? t("Merci, ça ronronne !", "Thank you, purr!") : t("La gamelle du chat est vide…", "The cat's bowl is empty…");
  const text = t(
    "NookDex est gratuit, sans pub, fait à la main par un collectionneur. Si le bureau te plaît, un petit don aide à payer le serveur (et les croquettes).",
    "NookDex is free, ad-free and handmade by a collector. If you like the desk, a small tip helps pay for the server (and the kibble).",
  );
  const tipLabel = t("Remplir la gamelle ♥", "Fill the bowl ♥");

  const cat = (
    <div className={styles.cat} aria-hidden>
      <motion.img
        src={sceneImg("cat-awake.webp")}
        alt=""
        draggable={false}
        animate={thanks ? { y: [0, -14, 0, -8, 0], rotate: [0, -4, 3, 0] } : { rotate: [0, -2, 0] }}
        transition={thanks ? { duration: 0.8 } : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      {!thanks && <span className={styles.tear} />}
      {thanks && (
        <span className={styles.hearts}>
          <i>♥</i>
          <i>♥</i>
          <i>♥</i>
        </span>
      )}
      <Bowl full={thanks} />
    </div>
  );

  return (
    <AnimatePresence>
      {visible &&
        (compact ? (
          <motion.aside
            key="toast"
            className={styles.toast}
            role="dialog"
            aria-label={title}
            initial={{ y: 160 }}
            animate={{ y: 0 }}
            exit={{ y: 180 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
          >
            {cat}
            <div className={styles.toastText}>
              <b>{title}</b>
              {!thanks && (
                <a className={styles.tip} href={SUPPORT_URL} target="_blank" rel="noopener" onClick={tip}>
                  {t("Faire un don ♥", "Leave a tip ♥")}
                </a>
              )}
            </div>
            {!thanks && (
              <button className={styles.close} onClick={later} aria-label={t("Plus tard", "Maybe later")}>
                ✕
              </button>
            )}
          </motion.aside>
        ) : (
          <motion.div
            key="popin"
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !thanks) later();
            }}
          >
            <motion.aside
              className={styles.card}
              role="dialog"
              aria-label={title}
              initial={{ scale: 0.6, rotate: -6, y: 40 }}
              animate={{ scale: 1, rotate: -1, y: 0 }}
              exit={{ scale: 0.8, rotate: 4, y: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
            >
              {cat}
              <h2>{title}</h2>
              {!thanks && (
                <>
                  <p>{text}</p>
                  <div className={styles.actions}>
                    <a className={styles.tip} href={SUPPORT_URL} target="_blank" rel="noopener" onClick={tip} onPointerEnter={sfx.hover}>
                      {tipLabel}
                    </a>
                    <button className={styles.later} onClick={later} onPointerEnter={sfx.hover}>
                      {t("Plus tard", "Maybe later")}
                    </button>
                  </div>
                </>
              )}
            </motion.aside>
          </motion.div>
        ))}
    </AnimatePresence>
  );
}
