"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { MAX_BINDERS, boxOf } from "@/lib/binders";
import { langLabel, langOfKey } from "@/lib/cardLang";
import { useSets } from "@/lib/catalog";
import { currentLang, useT } from "@/lib/lang";
import { copiesTotals, copiesValue, formatMoney } from "@/lib/price";
import { norm } from "@/lib/search";
import { sfx } from "@/lib/sound";
import { looseCopies, useStore } from "@/lib/store";
import { CardBack } from "../binder/CardBack";
import type { CardData } from "@/lib/types";
import styles from "./Box.module.css";

type Sort = "set" | "price" | "name" | "recent";
const SORTS: { k: Sort; fr: string; en: string }[] = [
  { k: "set", fr: "Extension", en: "Set" },
  { k: "price", fr: "Prix", en: "Price" },
  { k: "name", fr: "Nom", en: "Name" },
  { k: "recent", fr: "Récentes", en: "Recent" },
];

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
  // a search (name, number, set) and a sort: by set (the groups), or every card in one grid by price, name, date added
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("set");
  const q = norm(query.trim());
  const matches = (id: string, setName: string) => {
    if (!q) return true;
    const c = cards[id];
    return norm(`${c?.name ?? ""} ${c?.aka ?? ""} ${c?.num ?? ""} ${setName}`).includes(q);
  };
  const flat = useMemo(() => {
    if (sort === "set") return [];
    const rows = groups.flatMap((g) =>
      g.items
        .filter((x) => matches(x.cardId, g.set?.name ?? ""))
        .map((x) => {
          const card = cards[x.cardId];
          return { id: x.cardId, card, value: card ? copiesValue(card, x.copies, "trend") : 0, added: Math.max(...x.copies.map((c) => c.addedAt)) };
        }),
    );
    if (sort === "price") rows.sort((a, b) => b.value - a.value);
    if (sort === "name") rows.sort((a, b) => (a.card?.name ?? a.id).localeCompare(b.card?.name ?? b.id, "fr"));
    if (sort === "recent") rows.sort((a, b) => b.added - a.added);
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, cards, sort, q]);
  const flatKeys = flat.map((r) => r.id);

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

        {total > 0 && (
          <div className={styles.tools}>
            <input
              className={styles.search}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("🔍 Pokémon, numéro, extension…", "🔍 Pokémon, number, set…")}
              aria-label={t("Chercher dans la boîte", "Search the box")}
            />
            <div className={styles.sorts} role="radiogroup" aria-label={t("Trier", "Sort")}>
              {SORTS.map((o) => (
                <button
                  key={o.k}
                  role="radio"
                  aria-checked={sort === o.k}
                  className={`${styles.sort} ${sort === o.k ? styles.sortOn : ""}`}
                  onPointerEnter={sfx.hover}
                  onClick={() => {
                    sfx.click();
                    setSort(o.k);
                  }}
                >
                  {t(o.fr, o.en)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.inside}>
          {sort !== "set" && (
            <div className={`${styles.cards} ${styles.flat}`}>
              {flat.map((r) => (
                <BoxCard key={r.id} id={r.id} card={r.card} price={sort === "price" ? r.value : undefined} onOpen={() => onOpenCards(flatKeys, flatKeys.indexOf(r.id))} />
              ))}
              {!flat.length && <p className={styles.empty}>{t("Rien ne correspond.", "Nothing matches.")}</p>}
            </div>
          )}
          {!groups.length && (
            <p className={styles.empty}>
              {t(
                "Les cartes rangées sans classeur atterrissent ici, comme celles d'un classeur retiré de l'étagère.",
                "Cards put away with no binder land here, like those of a binder taken off the shelf.",
              )}
            </p>
          )}
          {sort === "set" &&
            groups.map((g, gi) => {
              const name = g.set?.name ?? g.setId;
              const ids = g.items.map((x) => x.cardId).filter((id) => norm(name).includes(q) || matches(id, name));
              if (!ids.length) return null;
              return (
            <Group
              key={g.setId}
              index={gi}
              setId={g.setId}
              name={g.set?.name ?? g.setId}
              logo={g.set?.logo ?? null}
              extra={!!g.set?.extra}
              ids={ids}
              count={g.count}
              value={copiesTotals(g.items.flatMap((x) => (cards[x.cardId] ? [{ card: cards[x.cardId], copies: x.copies }] : []))).trend}
              full={full}
              keys={keys}
              onOpenCards={onOpenCards}
            />
              );
            })}
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
        {shown.map((id) => (
          <BoxCard key={id} id={id} card={cards[id]} onOpen={() => onOpenCards(keys, keys.indexOf(id))} />
        ))}
      </div>
    </motion.section>
  );
}

/** A card in the box: opens its sheet; its ✕ throws it away (its copies in the box), the second tap being the sure one. */
function BoxCard({ id, card, price, onOpen }: { id: string; card: CardData | undefined; price?: number; onOpen: () => void }) {
  const t = useT();
  const qty = useStore((s) => looseCopies(s.collection[id]).reduce((n, c) => n + c.qty, 0));
  const [arming, setArming] = useState(false);
  useEffect(() => {
    if (!arming) return;
    const timer = setTimeout(() => setArming(false), 2500);
    return () => clearTimeout(timer);
  }, [arming]);
  return (
    <span className={styles.cardWrap}>
      <button
        className={styles.card}
        onPointerEnter={sfx.hover}
        onClick={() => {
          sfx.pop();
          onOpen();
        }}
        aria-label={card?.name ?? id}
        title={card ? `${card.name} · ${card.num}` : id}
      >
        {card?.img ? <img src={`${card.img}/low.webp`} alt="" loading="lazy" /> : <CardBack label={false} />}
        {qty > 1 && <span className={styles.qty}>×{qty}</span>}
        {price != null && price > 0 && <span className={styles.price}>{formatMoney(price)}</span>}
      </button>
      <button
        className={`${styles.bin} ${arming ? styles.binArmed : ""}`}
        aria-label={arming ? t("Sûr ? jeter cette carte", "Sure? bin this card") : t("Jeter cette carte", "Bin this card")}
        title={arming ? t("Sûr ?", "Sure?") : t("Jeter", "Bin")}
        onClick={() => {
          if (!arming) {
            sfx.click();
            setArming(true);
            return;
          }
          sfx.remove();
          useStore.getState().removeLooseCopies([id]);
        }}
      >
        {arming ? t("Jeter ?", "Bin?") : "✕"}
      </button>
    </span>
  );
}
