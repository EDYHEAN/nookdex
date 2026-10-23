"use client";

import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { langLabel, langOfKey } from "@/lib/cardLang";
import { catalogSet, setIdOfCard, useSets } from "@/lib/catalog";
import { currentLang, useT } from "@/lib/lang";
import { currencySign, formatPrice, priceOf, variantLabel } from "@/lib/price";
import { rarityRank } from "@/lib/rarity";
import { type Row, cardRow, matcher } from "@/lib/search";
import { type Double, doublesOf } from "@/lib/share";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import type { CardData } from "@/lib/types";
import styles from "./ShareListPanel.module.css";

/**
 * « J'échange »: the doubles NookDex suggests (the copies beyond the first of a version), the player ticks those really up
 * for grabs. A big collection has 1,200 of them (Johan, 2026-10-23): they come by set, folded. A set's box is
 * « tout · les nouveaux suivent »: a rule kept in the save (store tradeRules), every double of it listed, the ones to come
 * too, but for the cards taken out by hand. Search, price floors, ★ Rares+ and Holo narrow the list; « ✓ les N » ticks
 * what's shown, once. Only the sets opened (or a search's first hits) draw their scans: a phone stays smooth.
 */

interface Item {
  d: Double;
  card: CardData | undefined;
  /** the trend in the player's money; null: not priced */
  price: number | null;
  setKey: string;
}

/** price floors, in the player's money */
const FLOORS = [0, 1, 5, 20];
/** the one-line offer of a first visit: every double at this price or more */
const OFFER_FLOOR = 2;
const OFFER_KEY = "nookdex:trade-offer";
/** a search draws its first hits only: past that, the player narrows it */
const HITS = 60;
/** ★ Rares+: double rare and up (lib/rarity ranks) */
const RARE_RANK = 4;
/** how long a press counts copies instead of ticking */
const LONG_PRESS = 450;

const rows = new WeakMap<CardData, Row>();
const rowOf = (card: CardData) => {
  let r = rows.get(card);
  if (!r) rows.set(card, (r = cardRow(card)));
  return r;
};

/** Every spare copy of these doubles, or none: one change of the store */
const tickAll = (items: Item[], on: boolean) =>
  useStore.getState().setTradableMany(items.map((i) => ({ key: i.d.key, variant: i.d.variant, n: on ? i.d.extra : 0 })));

const readOffer = () => {
  try {
    return !!localStorage.getItem(OFFER_KEY);
  } catch {
    return true;
  }
};

export function GivePicker() {
  const tr = useT();
  const site = currentLang();
  const collection = useStore((s) => s.collection);
  const tradable = useStore((s) => s.tradable);
  const rules = useStore((s) => s.tradeRules);
  const cards = useSets((s) => s.cards);
  const [q, setQ] = useState("");
  const query = useDeferredValue(q);
  const [floor, setFloor] = useState(0);
  const [rare, setRare] = useState(false);
  const [holo, setHolo] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [offerDone, setOfferDone] = useState(readOffer);

  const items = useMemo<Item[]>(
    () =>
      doublesOf(collection, tradable, rules).map((d) => {
        const card = cards[d.key];
        return { d, card, price: card ? priceOf(card, d.variant, "trend") : null, setKey: setIdOfCard(d.key) ?? "?" };
      }),
    [collection, tradable, rules, cards],
  );
  const filtered = !!(floor || rare || holo);
  const keep = useCallback(
    (i: Item) => (!floor || (i.price ?? 0) >= floor) && (!rare || (!!i.card && rarityRank(i.card) >= RARE_RANK)) && (!holo || i.d.variant !== "normal"),
    [floor, rare, holo],
  );
  const shown = useMemo(() => (filtered ? items.filter(keep) : items), [items, filtered, keep]);
  const hits = useMemo(() => {
    const match = matcher(query);
    return match ? shown.filter((i) => i.card && match(rowOf(i.card))).sort((a, b) => (b.price ?? -1) - (a.price ?? -1)) : null;
  }, [shown, query]);
  // by set, the newest first; in a set the priciest first. `all`: the whole set (its box and rule), `list`: what's shown
  const groups = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of items) {
      const list = m.get(i.setKey);
      if (list) list.push(i);
      else m.set(i.setKey, [i]);
    }
    return [...m]
      .map(([key, all]) => {
        all.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
        return { key, set: catalogSet(key), all, list: filtered ? all.filter(keep) : all };
      })
      .filter((g) => g.list.length)
      .sort((a, b) => (b.set?.releaseDate ?? "").localeCompare(a.set?.releaseDate ?? ""));
  }, [items, filtered, keep]);

  const ticked = (list: Item[]) => list.filter((i) => i.d.ticked > 0).length;
  const full = (list: Item[]) => list.every((i) => i.d.ticked === i.d.extra);
  const scope = hits ?? shown;
  const allOn = scope.length > 0 && full(scope);
  const offer = useMemo(() => items.filter((i) => (i.price ?? 0) >= OFFER_FLOOR), [items]);
  const showOffer = !offerDone && offer.length > 0 && !Object.keys(rules).length && items.every((i) => !i.d.ticked);
  const closeOffer = () => {
    setOfferDone(true);
    try {
      localStorage.setItem(OFFER_KEY, "1");
    } catch {}
  };

  const setOne = useCallback((d: Double, n: number) => {
    if (n > d.ticked) sfx.plus();
    else sfx.minus();
    useStore.getState().setTradable(d.key, d.variant, Math.max(0, Math.min(d.extra, n)));
  }, []);
  const money = (n: number) => (currencySign() === "$" ? `$${n}` : `${n} €`);
  const chip = (on: boolean, label: string, act: () => void, key: string) => (
    <motion.button
      key={key}
      className={`${styles.floor} ${on ? styles.floorOn : ""}`}
      whileTap={{ scale: 0.9 }}
      onClick={() => {
        sfx.click();
        act();
      }}
      aria-pressed={on}
    >
      {label}
    </motion.button>
  );

  if (!items.length) {
    return <p className={styles.muted}>{tr("Pas encore de doubles : le + sur la fiche d'une carte en ajoute un.", "No doubles yet: the + on a card's sheet adds one.")}</p>;
  }

  return (
    <div className={styles.give}>
      {showOffer && (
        <motion.div className={styles.offer} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <span>
            {tr(`Cocher tous mes doubles à ${money(OFFER_FLOOR)} et plus ?`, `Tick all my doubles at ${money(OFFER_FLOOR)} or more?`)} <small>({offer.length})</small>
          </span>
          <button
            className={styles.offerYes}
            onClick={() => {
              sfx.coin();
              tickAll(offer, true);
              closeOffer();
            }}
          >
            {tr("Oui", "Yes")}
          </button>
          <button
            className={styles.offerNo}
            aria-label={tr("Non merci", "No thanks")}
            onClick={() => {
              sfx.click();
              closeOffer();
            }}
          >
            ✕
          </button>
        </motion.div>
      )}
      <label className={styles.search}>
        <span aria-hidden>⌕</span>
        <input
          type="search"
          value={q}
          placeholder={tr("dracaufeu, 151, n° 199…", "charizard, 151, no. 199…")}
          onChange={(e) => {
            setQ(e.target.value);
            sfx.hover();
          }}
        />
      </label>
      <div className={styles.floors} role="group" aria-label={tr("Filtres", "Filters")}>
        {FLOORS.map((f) => chip(floor === f && (f > 0 || !filtered), f ? `≥ ${money(f)}` : tr("Tout", "All"), () => (f ? setFloor(f) : (setFloor(0), setRare(false), setHolo(false))), `f${f}`))}
        {chip(rare, "★ Rares+", () => setRare(!rare), "rare")}
        {chip(holo, "Holo", () => setHolo(!holo), "holo")}
      </div>
      <div className={styles.giveBar}>
        <span>
          {items.length} {tr("doubles", "doubles")}
          {(filtered || hits) && (
            <>
              {" · "}
              <b>{scope.length}</b> {tr("ici", "here")}
            </>
          )}
        </span>
        <button
          className={`${styles.bulk} ${allOn ? styles.bulkOff : ""}`}
          disabled={!scope.length}
          onClick={() => {
            sfx.stamp();
            tickAll(scope, !allOn);
          }}
        >
          {allOn ? `✕ ${tr("les", "the")} ${scope.length}` : `✓ ${tr("les", "the")} ${scope.length}`}
        </button>
      </div>

      {hits ? (
        <>
          {!hits.length && <p className={styles.muted}>{tr("Aucun double ne correspond.", "No double matches.")}</p>}
          <ul className={styles.tiles}>
            {hits.slice(0, HITS).map((i) => (
              <Tile key={`${i.d.key}|${i.d.variant}`} d={i.d} card={i.card} price={i.price} site={site} onSet={setOne} />
            ))}
          </ul>
          {hits.length > HITS && <p className={styles.muted}>{tr(`+ ${hits.length - HITS} autres : précise ta recherche`, `+ ${hits.length - HITS} more: narrow your search`)}</p>}
        </>
      ) : (
        <>
          {!groups.length && <p className={styles.muted}>{tr("Aucun double ici.", "No double here.")}</p>}
          {groups.map((g) => {
            const isOpen = open.has(g.key);
            const rule = !!rules[g.key];
            const on = ticked(g.all);
            const kept = rule ? g.all.filter((i) => i.d.ticked < i.d.extra).length : 0;
            const state = rule ? (kept ? "some" : "all") : on === 0 ? "none" : full(g.all) ? "all" : "some";
            const toggle = () =>
              setOpen((o) => {
                const n = new Set(o);
                if (n.has(g.key)) n.delete(g.key);
                else n.add(g.key);
                return n;
              });
            return (
              <section key={g.key} className={`${styles.setGroup} ${rule ? styles.setRuled : ""}`}>
                <div className={styles.setHead}>
                  <button
                    className={styles.setOpen}
                    aria-expanded={isOpen}
                    onClick={() => {
                      sfx.riffle();
                      toggle();
                    }}
                  >
                    {g.set?.logo ? <img src={`${g.set.logo}.png`} alt="" loading="lazy" /> : <span className={styles.noLogo} />}
                    <span className={styles.setName}>
                      <span>
                        {g.set?.name ?? g.key}
                        {langOfKey(g.key) !== site && <small className={styles.lang}>{langLabel(langOfKey(g.key), site)}</small>}
                      </span>
                      <small>
                        {rule
                          ? `${tr("tout · les nouveaux suivent ✓", "all · new ones follow ✓")}${kept ? ` · ${kept} ${tr(kept > 1 ? "gardés" : "gardé", "kept")}` : ""}`
                          : `${filtered ? g.list.length : g.all.length} ${tr("doubles", "doubles")} · ${on ? `${on} ${tr(on > 1 ? "cochés" : "coché", "ticked")}` : tr("aucun coché", "none ticked")}`}
                      </small>
                    </span>
                  </button>
                  <motion.button
                    className={`${styles.setAll} ${state === "all" ? styles.stAll : state === "some" ? styles.stSome : ""}`}
                    whileTap={{ scale: 0.85 }}
                    aria-pressed={rule}
                    aria-label={rule ? tr("Ne plus tout échanger", "Stop trading all") : tr("Tout échanger, les nouveaux aussi", "Trade all, new ones too")}
                    title={tr("tout · les nouveaux suivent", "all · new ones follow")}
                    onClick={() => {
                      // the box is the set's rule: on, every double and the ones to come; off, none
                      if (rule || state === "all") sfx.minus();
                      else sfx.stamp();
                      useStore.getState().setTradeRule(g.key, !(rule || state === "all"));
                    }}
                  >
                    {state === "all" ? "✓" : state === "some" ? "–" : ""}
                  </motion.button>
                  <motion.button className={styles.caret} animate={{ rotate: isOpen ? 90 : 0 }} onClick={() => (sfx.riffle(), toggle())} aria-hidden tabIndex={-1}>
                    ▶
                  </motion.button>
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                      <ul className={styles.tiles}>
                        {g.list.map((i) => (
                          <Tile key={`${i.d.key}|${i.d.variant}`} d={i.d} card={i.card} price={i.price} site={site} onSet={setOne} />
                        ))}
                      </ul>
                      <p className={styles.hint}>{tr("tap = coché · appui long = combien", "tap = ticked · long press = how many")}</p>
                    </motion.div>
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

/**
 * One double as its scan: a tap ticks all its spare copies (or none), a long press (or a right click) counts them one by
 * one. Unticked, it greys out.
 */
const Tile = memo(
  function Tile({ d, card, price, site, onSet }: { d: Double; card: CardData | undefined; price: number | null; site: "fr" | "en"; onSet: (d: Double, n: number) => void }) {
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const longDone = useRef(false);
    const lang = langOfKey(d.key);
    const count = () => onSet(d, d.ticked >= d.extra ? 0 : d.ticked + 1);
    return (
      <li>
        <motion.button
          className={`${styles.tile} ${d.ticked ? styles.tileOn : ""}`}
          whileTap={{ scale: 0.93 }}
          aria-pressed={d.ticked > 0}
          aria-label={`${card?.name ?? d.key} · ${variantLabel(d.variant)} · ${d.ticked}/${d.extra}`}
          onPointerDown={() => {
            longDone.current = false;
            clearTimeout(timer.current);
            timer.current = setTimeout(() => {
              longDone.current = true;
              count();
            }, LONG_PRESS);
          }}
          onPointerUp={() => clearTimeout(timer.current)}
          onPointerLeave={() => clearTimeout(timer.current)}
          onContextMenu={(e) => {
            e.preventDefault();
            if (!longDone.current) count();
          }}
          onClick={() => {
            if (longDone.current) return;
            onSet(d, d.ticked ? 0 : d.extra);
          }}
        >
          {card?.img ? <img src={`${card.img}/low.webp`} alt="" loading="lazy" draggable={false} /> : <span className={styles.tileNoImg}>{card?.name ?? d.key}</span>}
          {d.ticked > 0 && <i className={styles.tileCheck}>{d.ticked < d.extra ? `${d.ticked}/${d.extra}` : "✓"}</i>}
          {d.extra > 1 && d.ticked === d.extra && <i className={styles.tileQty}>×{d.extra}</i>}
          {lang !== site && <i className={styles.tileLang}>{langLabel(lang, site)}</i>}
          {d.variant !== "normal" && <i className={styles.tileVariant}>{variantLabel(d.variant)}</i>}
          {price != null && <i className={styles.tilePrice}>{formatPrice(price)}</i>}
        </motion.button>
        <span className={styles.tileName}>{card?.name ?? d.key}</span>
      </li>
    );
  },
  // a tick rebuilds every double: only the tiles whose numbers moved draw again
  (a, b) => a.d.ticked === b.d.ticked && a.d.extra === b.d.extra && a.card === b.card && a.price === b.price && a.site === b.site && a.onSet === b.onSet,
);
