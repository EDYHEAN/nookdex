"use client";

import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";
import { langLabel, langOfKey } from "@/lib/cardLang";
import { catalogSet, setIdOfCard, useSets } from "@/lib/catalog";
import { currentLang, useT } from "@/lib/lang";
import { currencySign, formatPrice, priceOf, variantLabel } from "@/lib/price";
import { type Row, cardRow, matcher } from "@/lib/search";
import { type Double, doublesOf } from "@/lib/share";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import type { CardData, Variant } from "@/lib/types";
import styles from "./ShareListPanel.module.css";

/**
 * « J'échange »: the doubles NookDex suggests (the copies beyond the first of a version), the player ticks those really up
 * for grabs. A big collection has 1,200 of them (Johan, 2026-10-23): they come by set, folded, each set ticked at once
 * with its « tout »; a search (name, number, set, like the rest of the app) and « ≥ 5 € » find the ones that matter.
 * Only the sets opened (or a search's first hits) draw their rows: a phone stays smooth.
 */

interface Item {
  d: Double;
  card: CardData | undefined;
  /** the trend in the player's money (the filter's "≥ 5 €"); null: not priced */
  price: number | null;
  setKey: string;
}

/** price filters, in the player's money */
const FLOORS = [0, 1, 5, 20];
/** a search draws its first hits only: past that, the player narrows it */
const HITS = 60;

const rows = new WeakMap<CardData, Row>();
const rowOf = (card: CardData) => {
  let r = rows.get(card);
  if (!r) rows.set(card, (r = cardRow(card)));
  return r;
};

/** How many copies of each double to tick: all of them, or none */
const tickAll = (items: Item[], on: boolean) =>
  useStore.getState().setTradableMany(items.map((i) => ({ key: i.d.key, variant: i.d.variant, n: on ? i.d.extra : 0 })));

export function GivePicker() {
  const tr = useT();
  const site = currentLang();
  const collection = useStore((s) => s.collection);
  const tradable = useStore((s) => s.tradable);
  const cards = useSets((s) => s.cards);
  const [q, setQ] = useState("");
  const query = useDeferredValue(q);
  const [floor, setFloor] = useState(0);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const items = useMemo<Item[]>(
    () =>
      doublesOf(collection, tradable).map((d) => {
        const card = cards[d.key];
        return { d, card, price: card ? priceOf(card, d.variant, "trend") : null, setKey: setIdOfCard(d.key) ?? "?" };
      }),
    [collection, tradable, cards],
  );
  const shown = useMemo(() => (floor ? items.filter((i) => (i.price ?? 0) >= floor) : items), [items, floor]);
  const hits = useMemo(() => {
    const match = matcher(query);
    return match ? shown.filter((i) => i.card && match(rowOf(i.card))).sort((a, b) => (b.price ?? -1) - (a.price ?? -1)) : null;
  }, [shown, query]);
  // by set, the newest first; in a set the priciest first
  const groups = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of shown) {
      const list = m.get(i.setKey);
      if (list) list.push(i);
      else m.set(i.setKey, [i]);
    }
    return [...m]
      .map(([key, list]) => ({ key, set: catalogSet(key), list: list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1)) }))
      .sort((a, b) => (b.set?.releaseDate ?? "").localeCompare(a.set?.releaseDate ?? ""));
  }, [shown]);

  // counted in doubles (a card's version), not copies: the same unit as the sets' « 64 doubles » and « tout cocher (1705) »
  const tickedIn = (list: Item[]) => list.reduce((n, i) => n + (i.d.ticked > 0 ? 1 : 0), 0);
  const fullIn = (list: Item[]) => list.every((i) => i.d.ticked === i.d.extra);
  const scope = hits ?? shown;
  const allOn = scope.length > 0 && fullIn(scope);
  const setOne = useCallback((d: Double, n: number) => {
    if (n > d.ticked) sfx.plus();
    else sfx.minus();
    useStore.getState().setTradable(d.key, d.variant, Math.max(0, Math.min(d.extra, n)));
  }, []);
  const money = (n: number) => (currencySign() === "$" ? `$${n}` : `${n} €`);

  if (!items.length) {
    return <p className={styles.muted}>{tr("Pas encore de doubles : le + sur la fiche d'une carte en ajoute un.", "No doubles yet: the + on a card's sheet adds one.")}</p>;
  }

  return (
    <div className={styles.give}>
      <label className={styles.search}>
        <span aria-hidden>⌕</span>
        <input
          type="search"
          value={q}
          placeholder={tr("un double : nom, numéro, extension…", "find a double: name, number, set…")}
          onChange={(e) => {
            setQ(e.target.value);
            sfx.hover();
          }}
        />
      </label>
      <div className={styles.floors} role="group" aria-label={tr("Prix minimum", "Minimum price")}>
        {FLOORS.map((f) => (
          <motion.button
            key={f}
            className={`${styles.floor} ${floor === f ? styles.floorOn : ""}`}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              sfx.click();
              setFloor(f);
            }}
            aria-pressed={floor === f}
          >
            {f ? `≥ ${money(f)}` : tr("tous", "all")}
          </motion.button>
        ))}
      </div>
      <div className={styles.giveBar}>
        <span>
          <b>{tickedIn(items)}</b> {tr("cochés sur", "ticked of")} {items.length}
          {(floor > 0 || hits) && (
            <small>
              {" "}
              · {scope.length} {tr("ici", "here")}
            </small>
          )}
        </span>
        <button
          className={styles.all}
          disabled={!scope.length}
          onClick={() => {
            sfx.stamp();
            tickAll(scope, !allOn);
          }}
        >
          {allOn ? tr("tout décocher", "untick all") : tr(`tout cocher (${scope.length})`, `tick all (${scope.length})`)}
        </button>
      </div>

      {hits ? (
        <>
          {!hits.length && <p className={styles.muted}>{tr("Aucun double ne correspond.", "No double matches.")}</p>}
          <ul className={styles.doubles}>
            {hits.slice(0, HITS).map((i) => (
              <DoubleRow key={`${i.d.key}|${i.d.variant}`} d={i.d} card={i.card} price={i.price} site={site} onSet={setOne} />
            ))}
          </ul>
          {hits.length > HITS && <p className={styles.muted}>{tr(`+ ${hits.length - HITS} autres : précise ta recherche`, `+ ${hits.length - HITS} more: narrow your search`)}</p>}
        </>
      ) : (
        <>
          {!groups.length && <p className={styles.muted}>{tr("Aucun double à ce prix.", "No double at that price.")}</p>}
          {groups.map((g) => {
            const ticked = tickedIn(g.list);
            const isOpen = open.has(g.key);
            const state = ticked === 0 ? "none" : fullIn(g.list) ? "all" : "some";
            return (
              <section key={g.key} className={styles.setGroup}>
                <div className={styles.setHead}>
                  <button
                    className={styles.setOpen}
                    aria-expanded={isOpen}
                    onClick={() => {
                      sfx.riffle();
                      setOpen((o) => {
                        const n = new Set(o);
                        if (n.has(g.key)) n.delete(g.key);
                        else n.add(g.key);
                        return n;
                      });
                    }}
                  >
                    <motion.span className={styles.caret} animate={{ rotate: isOpen ? 90 : 0 }} aria-hidden>
                      ▶
                    </motion.span>
                    {g.set?.logo ? <img src={`${g.set.logo}.png`} alt="" loading="lazy" /> : <span className={styles.noLogo} />}
                    <span className={styles.setName}>
                      {g.set?.name ?? g.key}
                      {langOfKey(g.key) !== site && <small className={styles.lang}>{langLabel(langOfKey(g.key), site)}</small>}
                      <small>
                        {g.list.length} {tr(g.list.length > 1 ? "doubles" : "double", g.list.length > 1 ? "doubles" : "double")}
                        {ticked > 0 && ` · ${ticked} ${tr(ticked > 1 ? "cochés" : "coché", "ticked")}`}
                      </small>
                    </span>
                  </button>
                  <motion.button
                    className={`${styles.setAll} ${state === "all" ? styles.stAll : state === "some" ? styles.stSome : ""}`}
                    whileTap={{ scale: 0.88 }}
                    aria-pressed={state === "all"}
                    onClick={() => {
                      sfx.stamp();
                      tickAll(g.list, state !== "all");
                    }}
                  >
                    <i aria-hidden>{state === "all" ? "✓" : state === "some" ? "–" : ""}</i>
                    {tr("tout", "all")}
                  </motion.button>
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.ul
                      className={styles.doubles}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {g.list.map((i) => (
                        <DoubleRow key={`${i.d.key}|${i.d.variant}`} d={i.d} card={i.card} price={i.price} site={site} onSet={setOne} />
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

/** One double: tick it (all its spare copies), or count them with − + */
const DoubleRow = memo(function DoubleRow({
  d,
  card,
  price,
  site,
  onSet,
}: {
  d: Double;
  card: CardData | undefined;
  price: number | null;
  site: "fr" | "en";
  onSet: (d: Double, n: number) => void;
}) {
  const lang = langOfKey(d.key);
  return (
    <li className={d.ticked ? styles.dOn : ""}>
      <button className={styles.tick} onClick={() => onSet(d, d.ticked ? 0 : d.extra)} aria-pressed={d.ticked > 0}>
        <motion.i key={d.ticked ? "on" : "off"} initial={{ scale: 0.4 }} animate={{ scale: 1 }} aria-hidden>
          {d.ticked ? "✓" : ""}
        </motion.i>
        {card?.img ? <img src={`${card.img}/low.webp`} alt="" loading="lazy" /> : <span className={styles.noImg} />}
        <span className={styles.dName}>
          {card?.name ?? d.key}
          <small>
            {card?.num ? `${card.num} · ` : ""}
            {variantLabel(d.variant as Variant)}
            {lang !== site ? ` · ${langLabel(lang, site)}` : ""}
            {price != null ? ` · ${formatPrice(price)}` : ""}
          </small>
        </span>
      </button>
      {d.extra > 1 ? (
        <span className={styles.step}>
          <button onClick={() => onSet(d, d.ticked - 1)} disabled={!d.ticked} aria-label="−">
            −
          </button>
          <b>
            {d.ticked}/{d.extra}
          </b>
          <button onClick={() => onSet(d, d.ticked + 1)} disabled={d.ticked >= d.extra} aria-label="+">
            +
          </button>
        </span>
      ) : (
        <b className={styles.one}>×1</b>
      )}
    </li>
  );
},
// a tick rebuilds every double: only the rows whose numbers moved draw again
(a, b) => a.d.ticked === b.d.ticked && a.d.extra === b.d.extra && a.card === b.card && a.price === b.price && a.site === b.site && a.onSet === b.onSet);
