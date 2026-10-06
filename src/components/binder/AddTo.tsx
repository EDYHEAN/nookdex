"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { MAX_BINDERS, pocketsOf } from "@/lib/binders";
import { catalogSet, setIdOfCard } from "@/lib/catalog";
import { useT } from "@/lib/lang";
import { cardTier } from "@/lib/price";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import type { CardData, Copy } from "@/lib/types";
import styles from "./Inspector.module.css";

/** First empty pocket of a free binder. */
function firstFree(binderId: string, collection: Record<string, Copy[]>) {
  const used = pocketsOf(binderId, collection);
  let i = 0;
  while (used.has(i)) i++;
  return i;
}

interface Place {
  id: string;
  label: string;
  hint: string;
  go: () => void;
  disabled?: boolean;
}

/**
 * "Got it!" on a card found in NookDex OS: a copy lives in one place (lib/binders), so the player says which. Its set's
 * binder when it's on the shelf, a free binder, or a new binder for it (a newcomer's first one).
 */
export function AddTo({ card }: { card: CardData }) {
  const t = useT();
  const binders = useStore((s) => s.binders);
  const [open, setOpen] = useState(false);
  const setId = setIdOfCard(card.id);
  const set = setId ? catalogSet(setId) : undefined;
  const setBinder = binders.find((b) => b.kind === "set" && b.setId === setId);
  const frees = binders.flatMap((b) => (b.kind === "free" ? [b] : []));
  const full = binders.length >= MAX_BINDERS;
  const variant = card.variants[0];
  const { addBinder, addCard, placeCard } = useStore.getState();

  const places: Place[] = [];
  if (setBinder) places.push({ id: "set", label: set?.name ?? "?", hint: t("son classeur", "its binder"), go: () => addCard(card.id, variant) });
  for (const b of frees) {
    places.push({
      id: b.id,
      label: b.name,
      hint: t("classeur libre", "free binder"),
      go: () => placeCard(b.id, firstFree(b.id, useStore.getState().collection), card.id, variant),
    });
  }
  // extra sets (old series, promos) are search-only: no binder of their own
  if (!setBinder && setId && set && !set.extra) {
    places.push({
      id: "new-set",
      label: set.name,
      hint: t("nouveau classeur", "new binder"),
      disabled: full,
      go: () => {
        addBinder({ kind: "set", setId });
        addCard(card.id, variant);
      },
    });
  }
  if (!frees.length) {
    places.push({
      id: "new-free",
      label: t("Mes cartes", "My cards"),
      hint: t("nouveau classeur libre", "new free binder"),
      disabled: full,
      go: () => {
        const id = addBinder({ kind: "free", name: t("Mes cartes", "My cards") });
        placeCard(id, 0, card.id, variant);
      },
    });
  }

  return (
    <section className={styles.copies}>
      <button
        className={styles.gotIt}
        aria-expanded={open}
        onClick={() => {
          sfx.pop();
          setOpen(!open);
        }}
        onPointerEnter={sfx.hover}
      >
        {t("★ Je l'ai !", "★ Got it!")}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="where"
            className={styles.where}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <p className={styles.hint}>{t("Je la range dans…", "I put it in…")}</p>
            {places.map((p, i) => (
              <motion.button
                key={p.id}
                className={styles.placeBtn}
                disabled={p.disabled}
                initial={{ opacity: 0, x: -16, rotate: -2 }}
                animate={{ opacity: 1, x: 0, rotate: 0 }}
                transition={{ delay: 0.04 + i * 0.05, type: "spring", stiffness: 420, damping: 22 }}
                whileTap={{ scale: 0.95 }}
                onPointerEnter={sfx.hover}
                onClick={() => {
                  p.go();
                  sfx.add(0, cardTier(card));
                }}
              >
                <b>{p.label}</b>
                <small>{p.hint}</small>
              </motion.button>
            ))}
            {full && places.some((p) => p.disabled) && <p className={styles.hint}>{t(`L'étagère est pleine (${MAX_BINDERS} classeurs).`, `The shelf is full (${MAX_BINDERS} binders).`)}</p>}
          </motion.div>
        ) : (
          <motion.p key="hint" className={styles.hint} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {t("Tu choisis ensuite dans quel classeur la ranger.", "Then you pick the binder it goes in.")}
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}
