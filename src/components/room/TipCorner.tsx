"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/lang";
import { SUPPORT_URL } from "@/lib/site";
import { sfx } from "@/lib/sound";
import styles from "./TipCorner.module.css";

/**
 * A computer's bottom-right corner: Warwick's portrait (the Instagram one) in a round frame, with a paper tag for a tip. Always there in the calm
 * room (the cat's pop-in, room/SupportCat, still asks once in a while); on a phone the pop-in is enough.
 */
export function TipCorner({ show }: { show: boolean }) {
  const t = useT();
  const pathname = usePathname();
  const [thanks, setThanks] = useState(false);
  const visible = show && (pathname === "/" || pathname === "/en");

  return (
    <AnimatePresence>
      {visible && (
        <motion.a
          key="tip"
          className={styles.corner}
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          onPointerEnter={sfx.hover}
          onClick={() => {
            sfx.coin();
            setTimeout(() => sfx.purr(), 350);
            setThanks(true);
          }}
          aria-label={t("Soutenir NookDex : un don pour Warwick, le chat du bureau", "Support NookDex: a tip for Warwick, the desk's cat")}
        >
          <span className={styles.tag}>
            <b>{thanks ? t("Merci, ça ronronne ♥", "Thank you, purr ♥") : t("Un bonbon pour Warwick ?", "A treat for Warwick?")}</b>
            <small>{t("NookDex est gratuit et sans pub", "NookDex is free and ad-free")}</small>
          </span>
          <span className={styles.cat} aria-hidden>
            {/* breathing, and the head tilts now and then */}
            <motion.img
              src="/warwick.webp"
              alt=""
              draggable={false}
              animate={thanks ? { y: [0, -12, 0, -6, 0] } : { scale: [1, 1.03, 1], rotate: [0, 0, -4, 0, 0] }}
              transition={thanks ? { duration: 0.8 } : { duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className={styles.heart}>♥</span>
          </span>
        </motion.a>
      )}
    </AnimatePresence>
  );
}
