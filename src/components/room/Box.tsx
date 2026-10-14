"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { MAX_BINDERS, boxOf } from "@/lib/binders";
import { langLabel, langOfKey } from "@/lib/cardLang";
import { useSets } from "@/lib/catalog";
import { currentLang, useT } from "@/lib/lang";
import { copiesTotals, formatMoney } from "@/lib/price";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import { CardBack } from "../binder/CardBack";
import styles from "./Box.module.css";

/**
 * The purple box on the top shelf: the cards no binder holds (lib/binders boxOf), by set. A set can go back on the shelf
 * as a binder (its cards with it) or be thrown away; a card opens its sheet. Opens from where the box is.
 */
export function Box({
  origin,
  paused,
  onClose,
  onOpenCards,
}: {
  origin: { x: number; y: number };
  /** a card's sheet is open over it: Escape is the sheet's */
  paused: boolean;
  onClose: () => void;
  onOpenCards: (keys: string[], index: number) => void;
}) {
  const t = useT();
  const collection = useStore((s) => s.collection);
  const binders = useStore((s) => s.binders);
  const cards = useSets((s) => s.cards);
  const groups = useMemo(() => boxOf(collection, binders), [collection, binders]);
  const keys = useMemo(
    () => groups.flatMap((g) => g.items.map((x) => x.cardId).sort((a, b) => (cards[a]?.num ?? a).localeCompare(cards[b]?.num ?? b, "en", { numeric: true }))),
    [groups, cards],
  );
  const total = groups.reduce((n, g) => n + g.count, 0);
  const value = copiesTotals(groups.flatMap((g) => g.items.flatMap((x) => (cards[x.cardId] ? [{ card: cards[x.cardId], copies: x.copies }] : [])))).trend;
  const full = binders.length >= MAX_BINDERS;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !paused) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, paused]);

  const close = () => {
    sfx.click();
    onClose();
  };
  const from = typeof window === "undefined" ? { x: 0, y: 0 } : { x: origin.x - window.innerWidth / 2, y: origin.y - window.innerHeight / 2 };

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
      <motion.section
        className={styles.box}
        role="dialog"
        aria-label={t("La boîte", "The box")}
        initial={{ x: from.x, y: from.y, scale: 0.05, opacity: 0, rotate: 8 }}
        animate={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
        exit={{ x: from.x, y: from.y, scale: 0.05, opacity: 0, rotate: -6, transition: { duration: 0.32, ease: "easeIn" } }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
      >
        <button className={styles.close} onClick={close} onPointerEnter={sfx.hover} aria-label={t("Refermer la boîte", "Close the box")}>
          ✕
        </button>
        <header className={styles.head}>
          <h2>{t("La boîte", "The box")}</h2>
          <p>
            {total ? (
              <>
                <b>{total}</b> {t(`carte${total > 1 ? "s" : ""} sans classeur`, `card${total > 1 ? "s" : ""} with no binder`)} · <b>{formatMoney(value)}</b>
              </>
            ) : (
              t("Vide pour l'instant.", "Empty for now.")
            )}
          </p>
        </header>

        <div className={styles.inside}>
          {!groups.length && (
            <p className={styles.empty}>
              {t(
                "Les cartes rangées sans classeur atterrissent ici, comme celles d'un classeur retiré de l'étagère.",
                "Cards put away with no binder land here, like those of a binder taken off the shelf.",
              )}
            </p>
          )}
          {groups.map((g, gi) => (
            <Group
              key={g.setId}
              index={gi}
              setId={g.setId}
              name={g.set?.name ?? g.setId}
              logo={g.set?.logo ?? null}
              extra={!!g.set?.extra}
              ids={g.items.map((x) => x.cardId)}
              count={g.count}
              value={copiesTotals(g.items.flatMap((x) => (cards[x.cardId] ? [{ card: cards[x.cardId], copies: x.copies }] : []))).trend}
              full={full}
              keys={keys}
              onOpenCards={onOpenCards}
            />
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}

function Group({
  index,
  setId,
  name,
  logo,
  extra,
  ids,
  count,
  value,
  full,
  keys,
  onOpenCards,
}: {
  index: number;
  setId: string;
  name: string;
  logo: string | null;
  extra: boolean;
  ids: string[];
  count: number;
  value: number;
  full: boolean;
  keys: string[];
  onOpenCards: (keys: string[], index: number) => void;
}) {
  const t = useT();
  const cards = useSets((s) => s.cards);
  const [arming, setArming] = useState(false);
  useEffect(() => {
    if (!arming) return;
    const id = setTimeout(() => setArming(false), 3000);
    return () => clearTimeout(id);
  }, [arming]);
  const lang = langOfKey(setId);
  const shown = keys.filter((k) => ids.includes(k));

  return (
    <motion.section
      className={styles.group}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 + Math.min(index, 8) * 0.05, type: "spring", stiffness: 320, damping: 26 }}
    >
      <div className={styles.groupHead}>
        {logo ? <img className={styles.logo} src={`${logo}.png`} alt="" /> : <span className={styles.logo} />}
        <span className={styles.name}>
          {name}
          {lang !== currentLang() && <small className={styles.langTag}>{langLabel(lang, currentLang())}</small>}
        </span>
        <span className={styles.count}>
          {count} · {formatMoney(value)}
        </span>
        <span className={styles.actions}>
          {!extra && (
            <button
              className={styles.btn}
              disabled={full}
              title={full ? t("L'étagère est pleine", "The shelf is full") : undefined}
              onPointerEnter={sfx.hover}
              onClick={() => {
                sfx.shelfIn();
                useStore.getState().addBinder({ kind: "set", setId });
              }}
            >
              {t("En faire un classeur", "Make it a binder")}
            </button>
          )}
          <button
            className={`${styles.btn} ${arming ? styles.danger : ""}`}
            onPointerEnter={sfx.hover}
            onClick={() => {
              if (!arming) {
                sfx.click();
                setArming(true);
                return;
              }
              sfx.remove();
              useStore.getState().removeLooseCopies(ids);
            }}
          >
            {arming ? t(`Sûr ? jeter ${count} carte${count > 1 ? "s" : ""}`, `Sure? bin ${count} card${count > 1 ? "s" : ""}`) : t("Jeter", "Bin")}
          </button>
        </span>
      </div>
      <div className={styles.cards}>
        {shown.map((id) => {
          const card = cards[id];
          return (
            <button
              key={id}
              className={styles.card}
              onPointerEnter={sfx.hover}
              onClick={() => {
                sfx.pop();
                onOpenCards(keys, keys.indexOf(id));
              }}
              aria-label={card?.name ?? id}
              title={card ? `${card.name} · ${card.num}` : id}
            >
              {card?.img ? <img src={`${card.img}/low.webp`} alt="" loading="lazy" /> : <CardBack label={false} />}
            </button>
          );
        })}
      </div>
    </motion.section>
  );
}
