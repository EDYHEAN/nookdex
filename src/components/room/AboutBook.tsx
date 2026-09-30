"use client";

import { motion } from "motion/react";
import { useEffect } from "react";
import { ABOUT } from "@/data/about";
import { sfx } from "@/lib/sound";
import styles from "./AboutBook.module.css";

/** The notebook taken from the shelf: it rises, opens, and reads like a handwritten journal. */
export function AboutBook({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.article
        className={styles.book}
        initial={{ y: 120, rotateX: 25, scale: 0.8, opacity: 0 }}
        animate={{ y: 0, rotateX: 0, scale: 1, opacity: 1 }}
        exit={{ y: 80, rotate: 3, opacity: 0, transition: { duration: 0.25 } }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        aria-label={ABOUT.title}
      >
        <button
          className={styles.close}
          onClick={() => {
            sfx.click();
            onClose();
          }}
          onPointerEnter={sfx.hover}
          aria-label="Refermer le carnet"
        >
          ✕
        </button>
        <h2 className={styles.title}>{ABOUT.title}</h2>
        <div className={styles.pages}>
          {ABOUT.pages.map((page, i) => (
            <motion.section
              key={page.heading}
              className={styles.page}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.12 }}
            >
              <h3>{page.heading}</h3>
              {page.paragraphs.map((p) =>
                p.startsWith("— ") ? (
                  <p key={p} className={styles.signature}>
                    {p}
                  </p>
                ) : (
                  <p key={p}>{p}</p>
                ),
              )}
            </motion.section>
          ))}
        </div>
      </motion.article>
    </motion.div>
  );
}
