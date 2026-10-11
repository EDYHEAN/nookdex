"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { MAX_BINDERS, wishBinders } from "@/lib/binders";
import { useT } from "@/lib/lang";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import type { CardData } from "@/lib/types";
import styles from "./Inspector.module.css";

/**
 * ☆ on a card's sheet: puts it in one of the player's wishlists (the first free pocket), or in a new one. A wishlist
 * that already wants it says so. Nothing else changes: a wished card is never owned, nor counted anywhere.
 */
export function WishButton({ card }: { card: CardData }) {
  const t = useT();
  const binders = useStore((s) => s.binders);
  const [open, setOpen] = useState(false);
  const lists = wishBinders(binders);
  const wantedIn = lists.filter((b) => Object.values(b.wants ?? {}).includes(card.id));
  const full = binders.length >= MAX_BINDERS;
  const { wishCard, addBinder } = useStore.getState();

  const [note, setNote] = useState<string | null>(null);
  const done = (name: string) => {
    sfx.wish();
    setOpen(false);
    setNote(t(`★ ajoutée à ${name}`, `★ added to ${name}`));
  };

  return (
    <div className={styles.wishWrap}>
      <button
        className={`${styles.wishBtn} ${wantedIn.length ? styles.wishOn : ""}`}
        aria-expanded={open}
        onClick={() => {
          sfx.pop();
          setNote(null);
          setOpen(!open);
        }}
        onPointerEnter={sfx.hover}
      >
        {wantedIn.length ? "★" : "☆"} {t("Wishlist", "Wishlist")}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.wishMenu}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
          >
            <p className={styles.hint}>{t("Je la cherche, je la mets dans…", "I'm after it, I put it in…")}</p>
            {lists.map((b, i) => {
              const has = wantedIn.includes(b);
              return (
                <motion.button
                  key={b.id}
                  className={styles.placeBtn}
                  disabled={has}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.03 + i * 0.04 }}
                  whileTap={{ scale: 0.95 }}
                  onPointerEnter={sfx.hover}
                  onClick={() => {
                    wishCard(b.id, card.id);
                    done(b.name);
                  }}
                >
                  <b>★ {b.name}</b>
                  <small>{has ? t("elle y est déjà", "already in it") : t("wishlist", "wishlist")}</small>
                </motion.button>
              );
            })}
            <motion.button
              className={styles.placeBtn}
              disabled={full}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.03 + lists.length * 0.04 }}
              whileTap={{ scale: 0.95 }}
              onPointerEnter={sfx.hover}
              onClick={() => {
                const name = t("Ma wishlist", "My wishlist");
                addBinder({ kind: "free", name, wish: true, wants: { 0: card.id } });
                done(name);
              }}
            >
              <b>+ {t("Nouvelle wishlist", "New wishlist")}</b>
              <small>{full ? t(`l'étagère est pleine (${MAX_BINDERS})`, `the shelf is full (${MAX_BINDERS})`) : t("sur l'étagère", "on the shelf")}</small>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
      {note && <span className={styles.wishNote}>{note}</span>}
    </div>
  );
}
