"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { claimAsk, useAskFree, useValued, useWantAsk } from "@/lib/calm";
import { useCloud } from "@/lib/cloud";
import { useT } from "@/lib/lang";
import { setMailOptin, useMailOptin } from "@/lib/mailOptin";
import { sfx } from "@/lib/sound";
import styles from "./ImportBar.module.css";

const CALM_MS = 2500;
/** Answered (yes or no): never again on this device. The switch in NookDex OS → Sauvegarde stays. */
const KEY = "nookdex:mail-ask";

const answered = () => {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
};

/**
 * « Le courrier du lundi » offered once to the players who have an account and haven't said yes (Johan, 2026-10-24: tell
 * the existing accounts it exists, without e-mailing them: their e-mail was given for signing in). The Pokécardex strip's
 * look, in the calm room, after the road log in the asks' order (lib/calm): the notebook says it's new, this asks.
 */
export function MailAsk({ compact, calm }: { compact: boolean; calm: boolean }) {
  const t = useT();
  const pathname = usePathname();
  const email = useCloud((c) => c.email);
  const on = useMailOptin((m) => m.on);
  const [shown, setShown] = useState(false);
  const [thanks, setThanks] = useState(false);

  const free = useAskFree("mail");
  const valued = useValued();
  const home = pathname === "/" || pathname === "/en";
  const wants = !!email && on === false && valued && home && !answered();
  useWantAsk("mail", wants);
  const eligible = calm && wants;

  useEffect(() => {
    if (!eligible) return;
    const id = setTimeout(() => claimAsk("mail") && setShown(true), CALM_MS);
    return () => clearTimeout(id);
  }, [eligible]);

  const done = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
  };

  return (
    <AnimatePresence>
      {shown && (eligible || thanks) && free && (
        <motion.div
          className={`${styles.bar} ${compact ? styles.phone : ""}`}
          role="status"
          initial={{ opacity: 0, y: compact ? 40 : -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: compact ? 40 : -40 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
        >
          {thanks ? (
            <span className={styles.text}>{t("📬 C'est noté : rendez-vous lundi !", "📬 Done: see you on Monday!")}</span>
          ) : (
            <>
              <span className={styles.text}>
                📬 <b>{t("Nouveau", "New")}</b> :{" "}
                {t("chaque lundi, la valeur de ta collec et tes cartes qui bougent, par e-mail.", "every Monday, your collection's value and your cards that move, by e-mail.")}
              </span>
              <button
                className={styles.go}
                onClick={() => {
                  sfx.click();
                  done();
                  void setMailOptin(true).then((ok) => {
                    if (!ok) return setShown(false);
                    sfx.coin();
                    setThanks(true);
                    setTimeout(() => setShown(false), 2600);
                  });
                }}
                onPointerEnter={sfx.hover}
              >
                {t("Je le veux ▶", "I want it ▶")}
              </button>
              <button
                className={styles.close}
                onClick={() => {
                  sfx.click();
                  done();
                  setShown(false);
                }}
                aria-label={t("Non merci", "No thanks")}
                title={t("Non merci", "No thanks")}
              >
                ✕
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
