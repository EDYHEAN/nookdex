"use client";

import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { BINDER_COLORS, GRIDS, type Pocket } from "@/lib/binders";
import { formatMoney, marketName, type SetStats } from "@/lib/price";
import { SORT_LABEL, SORT_LABEL_EN } from "@/lib/rarity";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import type { BinderDef, BinderGrid, BinderSort, Copy } from "@/lib/types";
import styles from "./Binder.module.css";
import { useT } from "@/lib/lang";

export type BinderSummary = Omit<SetStats, "copies"> & {
  /** "112/245" for a set, "12" for a free binder, "3/12" found for a wishlist */
  count: string;
  pricesUpdated: string | null;
  /** a wishlist: what its wanted cards cost */
  left?: number;
};

interface Props {
  binder: BinderDef;
  title: string;
  stats: BinderSummary;
  pages: Pocket[][];
  collection: Record<string, Copy[]>;
  onJump: (page: number) => void;
  /** riffle to a pocket and make its card pulse */
  onFind: (pocket: number) => void;
}

export function StatsPage({ binder, title, stats, pages, collection, onJump, onFind }: Props) {
  const t = useT();
  const mapRef = useRef<HTMLDivElement>(null);
  const g = GRIDS[binder.grid];
  const mapCols = useMapCols(mapRef, pages.length, g.cols, g.rows, g.cols === 3 ? 0.074 : 0.05);
  const free = binder.kind === "free";
  const pct = stats.total ? stats.owned / stats.total : 0;
  const segments = 20;
  const lit = Math.round(pct * segments);
  const gain = stats.spentTrend - stats.spent;
  const wish = binder.wish;
  // a wishlist's ghost is a pocket still to fill
  const filled = (p: Pocket) => (free ? !!p.cardId && !p.wanted : !!(p.cardId && collection[p.cardId]?.length));

  return (
    <div className={styles.stats} style={{ ["--accent" as string]: binder.color }} data-tour="summary" data-narrow={binder.grid === 6 || undefined}>
      <div className={styles.statsHead}>
        {binder.logo && <img src={`${binder.logo}.png`} alt="" draggable={false} />}
        <div>
          <p className={styles.kicker}>
            {wish ? "★ wishlist" : free ? t("classeur libre", "free binder") : binder.code} · {t("sommaire", "summary")}
          </p>
          {free ? <Rename id={binder.id} name={title} /> : <h2>{title}</h2>}
        </div>
      </div>

      <Finder pages={pages} collection={collection} onFind={onFind} />
      {!free && <SortChips id={binder.id} current={binder.sort} />}
      <GridChips id={binder.id} current={binder.grid} />

      {wish ? (
        <>
          <div className={styles.bigCount}>
            <b>{stats.owned}</b>
            <span>
              / {stats.total} {t("trouvées", "found")}
            </span>
            <em>{Math.round(pct * 100)}%</em>
          </div>
          <div className={styles.segBar}>
            {Array.from({ length: segments }, (_, i) => (
              <span key={i} className={i < lit ? styles.segOn : ""} style={{ animationDelay: `${i * 30}ms` }} />
            ))}
          </div>
        </>
      ) : free ? (
        <div className={styles.bigCount}>
          <b>{stats.owned}</b>
          <span>{t(`carte${stats.owned > 1 ? "s" : ""} rangée${stats.owned > 1 ? "s" : ""}`, `card${stats.owned > 1 ? "s" : ""} filed`)}</span>
        </div>
      ) : (
        <>
          <div className={styles.bigCount}>
            <b>{stats.owned}</b>
            <span>
              / {stats.total} {t("cartes", "cards")}
            </span>
            <em>{Math.round(pct * 100)}%</em>
          </div>
          <div className={styles.segBar}>
            {Array.from({ length: segments }, (_, i) => (
              <span key={i} className={i < lit ? styles.segOn : ""} style={{ animationDelay: `${i * 30}ms` }} />
            ))}
          </div>
        </>
      )}

      <dl className={styles.kv}>
        {wish && (
          <>
            <div>
              <dt>{t("Il te manque", "Missing")}</dt>
              <dd>
                {stats.total - stats.owned} {t("cartes", "cards")}
              </dd>
            </div>
            <div>
              <dt>{t("Pour tout trouver ≈", "To find them all ≈")}</dt>
              <dd className={styles.money}>{formatMoney(stats.left ?? 0)}</dd>
            </div>
          </>
        )}
        {!free && (
          <>
            <div>
              <dt>Master set</dt>
              <dd>
                {stats.masterOwned}/{stats.masterTotal} {t("variantes", "variants")}
              </dd>
            </div>
            <div>
              <dt>{t("Il te manque", "Missing")}</dt>
              <dd>
                {stats.total - stats.owned} {t("cartes", "cards")}
              </dd>
            </div>
          </>
        )}
        <div>
          <dt>{t("Valeur tendance", "Trend value")}</dt>
          <dd className={styles.money}>{formatMoney(stats.trend)}</dd>
        </div>
        <div>
          <dt>{t("Valeur prix bas", "Low value")}</dt>
          <dd>{formatMoney(stats.low)}</dd>
        </div>
        <div>
          <dt>{t("Dépensé", "Spent")}</dt>
          <dd>{formatMoney(stats.spent)}</dd>
        </div>
        <div>
          <dt>{t("Plus-value", "Gain")}</dt>
          <dd className={gain >= 0 ? styles.up : styles.down}>
            {gain >= 0 ? "+" : ""}
            {formatMoney(gain)}
          </dd>
        </div>
      </dl>

      <div className={styles.mapHead}>
        <p className={styles.mapTitle}>{t("Carte du classeur", "Binder map")}</p>
        <Colors id={binder.id} current={binder.color} />
      </div>
      <div ref={mapRef} className={styles.map} style={{ gridTemplateColumns: `repeat(${mapCols}, 1fr)` }}>
        {pages.map((pockets, i) => {
          const owned = pockets.filter(filled).length;
          return (
            <button
              key={i}
              className={`${styles.mapPage} ${owned === pockets.length ? styles.mapDone : ""}`}
              style={{ gridTemplateColumns: `repeat(${g.cols}, 1fr)` }}
              onClick={(e) => {
                e.stopPropagation();
                sfx.click();
                onJump(i);
              }}
              onPointerEnter={sfx.hover}
              title={`Page ${i + 1} — ${owned}/${pockets.length}`}
            >
              {pockets.map((p) => (
                <span key={p.index} className={filled(p) ? styles.dotOn : ""} />
              ))}
            </button>
          );
        })}
      </div>
      {stats.pricesUpdated && (
        <p className={styles.foot}>
          {t("Prix", "")} {marketName(binder.lang ?? "fr")} {t("du", "prices of")} {new Date(stats.pricesUpdated).toLocaleDateString(t("fr-FR", "en-GB"))}
        </p>
      )}
    </div>
  );
}

/**
 * The binder map's mini pages a row: as many as it takes for all of them to fit in the room the summary leaves it (no
 * scroll: the wheel turns the binder's pages; Johan, 2026-10-17), no wider than `widest` of the map (their size on a
 * short set). A mini page: `cols` x `rows` pockets, 1 px apart, 2 px of padding.
 */
function useMapCols(ref: RefObject<HTMLDivElement | null>, count: number, cols: number, rows: number, widest: number) {
  const [n, setN] = useState(12);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const { clientWidth: W, clientHeight: H } = el;
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      const height = (k: number) => {
        const lines = Math.ceil(count / k);
        const pocket = ((W - (k - 1) * gap) / k - 4 - (cols - 1)) / cols;
        // (+3: its border and the pixels lost rounding each pocket)
        return lines * (rows * pocket * (88 / 63) + (rows - 1) + 4 + 3) + (lines - 1) * gap;
      };
      let k = Math.max(1, Math.floor((W + gap) / (W * widest + gap)));
      while (k < count && height(k) > H) k++;
      setN(k);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, count, cols, rows, widest]);
  return n;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "Où est mon Lugia ?": type a name (or a number), pick it, the binder riffles to it. */
function Finder({ pages, collection, onFind }: { pages: Pocket[][]; collection: Record<string, Copy[]>; onFind: (pocket: number) => void }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const pockets = useMemo(() => pages.flat().filter((p): p is Pocket & { card: NonNullable<Pocket["card"]> } => !!p.card), [pages]);
  const nq = norm(q.trim());
  const results = nq
    ? pockets
        .filter(({ card }) => norm(card.name).includes(nq) || norm(card.aka ?? "").includes(nq) || card.num.toLowerCase().replace(/^0+(?=\d)/, "") === nq.replace(/^0+(?=\d)/, ""))
        .slice(0, 6)
    : [];
  const pick = (index: number) => {
    sfx.riffle();
    setOpen(false);
    setQ("");
    // let go of the field: the arrow keys turn pages again
    (document.activeElement as HTMLElement | null)?.blur();
    onFind(index);
  };
  return (
    <div className={styles.finder} onPointerDown={(e) => e.stopPropagation()}>
      <label className={styles.finderBox}>
        <span aria-hidden>⌕</span>
        <input
          value={q}
          placeholder={t("chercher une carte…", "find a card…")}
          aria-label={t("Chercher une carte dans ce classeur", "Find a card in this binder")}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            sfx.hover();
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) pick(results[0].index);
            if (e.key === "Escape") {
              setQ("");
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </label>
      {open && nq && (
        <ul className={styles.finderList}>
          {results.map(({ index, card }) => (
            <li key={index}>
              <button onClick={() => pick(index)} onPointerEnter={sfx.hover}>
                <span className={collection[card.id]?.length ? styles.dotOn : styles.dotOff} />
                <b>{card.name}</b>
                <small>
                  #{card.num} · p.{Math.floor(index / 9) + 1}
                </small>
              </button>
            </li>
          ))}
          {!results.length && <li className={styles.finderNone}>{t("aucune carte", "no card")}</li>}
        </ul>
      )}
    </div>
  );
}

/** How the set binder is ordered: set number, rarest first, dearest first, or alphabetical. */
function SortChips({ id, current }: { id: string; current: BinderSort }) {
  const t = useT();
  const setSort = useStore((s) => s.setBinderSort);
  return (
    <div className={styles.sortChips} role="radiogroup" aria-label={t("Ordre des cartes", "Card order")}>
      <span>{t("Ranger par", "Sort by")}</span>
      {(Object.keys(SORT_LABEL) as BinderSort[]).map((k) => (
        <button
          key={k}
          role="radio"
          aria-checked={k === current}
          className={k === current ? styles.chipOn : ""}
          onClick={(e) => {
            e.stopPropagation();
            if (k === current) return;
            sfx.riffle();
            setSort(id, k);
          }}
          onPointerEnter={sfx.hover}
        >
          {t(SORT_LABEL[k], SORT_LABEL_EN[k])}
        </button>
      ))}
    </div>
  );
}

/** Pockets a page: 4, 6 or 9, each chip a little drawing of its page */
function GridChips({ id, current }: { id: string; current: BinderGrid }) {
  const t = useT();
  const setGrid = useStore((s) => s.setBinderGrid);
  return (
    <div className={styles.sortChips} role="radiogroup" aria-label={t("Cartes par page", "Cards a page")}>
      <span>{t("Par page", "A page")}</span>
      {([4, 6, 9] as BinderGrid[]).map((g) => (
        <button
          key={g}
          role="radio"
          aria-checked={g === current}
          className={`${styles.gridChip} ${g === current ? styles.chipOn : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (g === current) return;
            sfx.riffle();
            setGrid(id, g);
          }}
          onPointerEnter={sfx.hover}
        >
          <i className={styles.gridIcon} style={{ gridTemplateColumns: `repeat(${GRIDS[g].cols}, 1fr)` }} aria-hidden>
            {Array.from({ length: g }, (_, k) => (
              <b key={k} />
            ))}
          </i>
          {g}
        </button>
      ))}
    </div>
  );
}

/** The cover color: the binder on the shelf and its pages follow. */
function Colors({ id, current }: { id: string; current: string }) {
  const t = useT();
  const setColor = useStore((s) => s.setBinderColor);
  return (
    <div className={styles.colors} role="radiogroup" aria-label={t("Couleur du classeur", "Binder colour")}>
      {BINDER_COLORS.map((c) => (
        <button
          key={c}
          role="radio"
          aria-checked={c === current}
          aria-label={c}
          className={`${styles.swatch} ${c === current ? styles.swatchOn : ""}`}
          style={{ background: c }}
          onClick={(e) => {
            e.stopPropagation();
            if (c === current) return;
            sfx.pop();
            setColor(id, c);
          }}
          onPointerEnter={sfx.hover}
        />
      ))}
    </div>
  );
}

/** The free binder's name, written on the page: click to change it. */
function Rename({ id, name }: { id: string; name: string }) {
  const t = useT();
  const rename = useStore((s) => s.renameBinder);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  if (!editing)
    return (
      <h2>
        <button
          className={styles.renameBtn}
          onClick={(e) => {
            e.stopPropagation();
            sfx.pop();
            setDraft(name);
            setEditing(true);
          }}
          title={t("Clic : renommer", "Click: rename")}
        >
          {name} <span aria-hidden>✎</span>
        </button>
      </h2>
    );
  const commit = () => {
    setEditing(false);
    const n = draft.trim().slice(0, 28);
    if (!n || n === name) return;
    sfx.stamp();
    rename(id, n);
  };
  return (
    <input
      className={styles.renameInput}
      autoFocus
      value={draft}
      maxLength={28}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

/** Keep pressed to confirm: no binder thrown away by accident. */
/**
 * Taking a binder that holds cards off the shelf: a little card asks where they go, the box on the shelf (lib/binders
 * boxOf) or the bin (twice, the second time is the sure one).
 */
export function RemoveChoice({ label, cards, onConfirm }: { label: string; cards: number; onConfirm: (keep: boolean) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [arming, setArming] = useState(false);
  const many = cards > 1 ? "s" : "";
  return (
    <span className={styles.removeWrap}>
      <button
        className={styles.removeBtn}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          sfx.pop();
          setOpen(!open);
          setArming(false);
        }}
        onPointerEnter={sfx.hover}
      >
        <span className={styles.removeText}>{label}</span>
      </button>
      {open && (
        <span className={styles.removeAsk} role="dialog" onClick={(e) => e.stopPropagation()}>
          <span className={styles.removeQ}>{t(`Et ses ${cards} carte${many} ?`, `And its ${cards} card${many}?`)}</span>
          <button
            className={styles.removeKeep}
            onPointerEnter={sfx.hover}
            onClick={() => {
              sfx.drop();
              onConfirm(true);
            }}
          >
            {t("📦 Dans la boîte", "📦 Into the box")}
          </button>
          <button
            className={`${styles.removeBin} ${arming ? styles.removeArmed : ""}`}
            onPointerEnter={sfx.hover}
            onClick={() => {
              if (!arming) {
                sfx.click();
                setArming(true);
                return;
              }
              sfx.remove();
              onConfirm(false);
            }}
          >
            {arming ? t("Sûr ? Supprimer", "Sure? Delete") : t("🗑 Les supprimer", "🗑 Delete them")}
          </button>
        </span>
      )}
    </span>
  );
}

export function HoldToRemove({ label, hint, onConfirm }: { label: string; hint: string; onConfirm: () => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const start = (e: React.PointerEvent) => {
    e.stopPropagation();
    setHolding(true);
    sfx.click();
    timer.current = window.setTimeout(() => {
      setHolding(false);
      sfx.remove();
      onConfirm();
    }, 1100);
  };
  const stop = () => {
    setHolding(false);
    if (timer.current) clearTimeout(timer.current);
  };
  return (
    <button
      className={`${styles.removeBtn} ${holding ? styles.removeHolding : ""}`}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onClick={(e) => e.stopPropagation()}
      title={hint}
    >
      <span className={styles.removeFill} />
      <span className={styles.removeText}>{holding ? "Maintiens…" : label}</span>
    </button>
  );
}
