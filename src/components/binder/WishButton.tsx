"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { wishBinders } from "@/lib/binders";
import { useT } from "@/lib/lang";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import type { CardData } from "@/lib/types";
import styles from "./Inspector.module.css";

/**
 * ☆ « Je la cherche » on a card's sheet (Johan, 2026-10-23): a tap stars it, and it goes in « je cherche » of the trade
 * binder (its public list) until the player gets it. No binder is made for it on the shelf. A player who keeps wishlists
 * can still put the card in one of them (▾).
 */
export function WishButton({ card }: { card: CardData }) {
  const t = useT();
  const binders = useStore((s) => s.binders);
  const starred = useStore((s) => !!s.stars[card.id]);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const lists = wishBinders(binders);
  const wantedIn = lists.filter((b) => Object.values(b.wants ?? {}).includes(card.id));
  const { wishCard, setStars } = useStore.getState();

  const toggle = () => {
    setOpen(false);
    setStars([card.id], !starred);
    if (starred) {
      sfx.minus();
      setNote(t("plus dans « je cherche »", "out of « wanted »"));
    } else {
      sfx.wish();
      setNote(t("★ dans ton classeur d'échange", "★ in your trade binder"));
    }
  };

  return (
    <div className={styles.wishWrap}>
      <motion.button
        className={`${styles.wishBtn} ${starred || wantedIn.length ? styles.wishOn : ""}`}
        aria-pressed={starred}
        onClick={toggle}
        onPointerEnter={sfx.hover}
        whileTap={{ scale: 0.9 }}
      >
        <motion.span key={starred ? "on" : "off"} initial={{ scale: 0.4, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} style={{ display: "inline-block" }}>
          {starred ? "★" : "☆"}
        </motion.span>{" "}
        {t("Je la cherche", "I'm after it")}
      </motion.button>
      {lists.length > 0 && (
        <button
          className={styles.wishBtn}
          aria-expanded={open}
          aria-label={t("Dans une wishlist", "In a wishlist")}
          onClick={() => {
            sfx.pop();
            setNote(null);
            setOpen(!open);
          }}
          onPointerEnter={sfx.hover}
        >
          ▾
        </button>
      )}
      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.wishMenu}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
          >
            <p className={styles.hint}>{t("… ou dans une de tes wishlists :", "… or in one of your wishlists:")}</p>
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
                    sfx.wish();
                    setOpen(false);
                    setNote(t(`★ ajoutée à ${b.name}`, `★ added to ${b.name}`));
                  }}
                >
                  <b>★ {b.name}</b>
                  <small>{has ? t("elle y est déjà", "already in it") : t("wishlist", "wishlist")}</small>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
      {note && <span className={styles.wishNote}>{note}</span>}
    </div>
  );
}
