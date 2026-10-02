"use client";

import { useMemo, useRef, useState } from "react";
import { BINDER_COLORS, type Pocket } from "@/lib/binders";
import { formatMoney, type SetStats } from "@/lib/price";
import { SORT_LABEL, SORT_LABEL_EN } from "@/lib/rarity";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import type { BinderDef, BinderSort, Copy } from "@/lib/types";
import styles from "./Binder.module.css";
import { useT } from "@/lib/lang";

export type BinderSummary = Omit<SetStats, "copies"> & {
  /** "112/245" for a set, "12" for a free binder */
  count: string;
  pricesUpdated: string | null;
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
  const free = binder.kind === "free";
  const pct = stats.total ? stats.owned / stats.total : 0;
  const segments = 20;
  const lit = Math.round(pct * segments);
  const gain = stats.spentTrend - stats.spent;
  const filled = (p: Pocket) => (free ? !!p.cardId : !!(p.cardId && collection[p.cardId]?.length));

  return (
    <div className={styles.stats} style={{ ["--accent" as string]: binder.color }} data-tour="summary">
      <div className={styles.statsHead}>
        {binder.logo && <img src={`${binder.logo}.png`} alt="" draggable={false} />}
        <div>
          <p className={styles.kicker}>{free ? t("classeur libre", "free binder") : binder.code} · {t("sommaire", "summary")}</p>
          {free ? <Rename id={binder.id} name={title} /> : <h2>{title}</h2>}
        </div>
      </div>

      <Finder pages={pages} collection={collection} onFind={onFind} />
      {!free && <SortChips id={binder.id} current={binder.sort} />}

      {free ? (
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
      <div className={styles.map}>
        {pages.map((pockets, i) => {
          const owned = pockets.filter(filled).length;
          return (
            <button
              key={i}
              className={`${styles.mapPage} ${owned === pockets.length ? styles.mapDone : ""}`}
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
          {t("Prix Cardmarket du", "Cardmarket prices of")} {new Date(stats.pricesUpdated).toLocaleDateString(t("fr-FR", "en-GB"))}
        </p>
      )}
    </div>
  );
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
        .filter(({ card }) => norm(card.name).includes(nq) || card.num.toLowerCase().replace(/^0+(?=d)/, "") === nq.replace(/^0+(?=d)/, ""))
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

/** How the set binder is ordered: set number, rarest first, or alphabetical. */
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
