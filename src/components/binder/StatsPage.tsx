"use client";

import { useRef, useState } from "react";
import { BINDER_COLORS, type Pocket } from "@/lib/binders";
import { formatEur, type SetStats } from "@/lib/price";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import type { BinderDef, Copy } from "@/lib/types";
import styles from "./Binder.module.css";

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
  onRemove: () => void;
}

export function StatsPage({ binder, title, stats, pages, collection, onJump, onRemove }: Props) {
  const free = binder.kind === "free";
  const pct = stats.total ? stats.owned / stats.total : 0;
  const segments = 20;
  const lit = Math.round(pct * segments);
  const gain = stats.spentTrend - stats.spent;
  const filled = (p: Pocket) => (free ? !!p.cardId : !!(p.cardId && collection[p.cardId]?.length));

  return (
    <div className={styles.stats} style={{ ["--accent" as string]: binder.color }}>
      <div className={styles.statsHead}>
        {binder.logo && <img src={`${binder.logo}.png`} alt="" draggable={false} />}
        <div>
          <p className={styles.kicker}>{free ? "classeur libre" : binder.code} · sommaire</p>
          {free ? <Rename id={binder.id} name={title} /> : <h2>{title}</h2>}
        </div>
      </div>

      {free ? (
        <div className={styles.bigCount}>
          <b>{stats.owned}</b>
          <span>carte{stats.owned > 1 ? "s" : ""} rangée{stats.owned > 1 ? "s" : ""}</span>
        </div>
      ) : (
        <>
          <div className={styles.bigCount}>
            <b>{stats.owned}</b>
            <span>/ {stats.total} cartes</span>
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
                {stats.masterOwned}/{stats.masterTotal} variantes
              </dd>
            </div>
            <div>
              <dt>Il te manque</dt>
              <dd>{stats.total - stats.owned} cartes</dd>
            </div>
          </>
        )}
        <div>
          <dt>Valeur tendance</dt>
          <dd className={styles.money}>{formatEur(stats.trend)}</dd>
        </div>
        <div>
          <dt>Valeur prix bas</dt>
          <dd>{formatEur(stats.low)}</dd>
        </div>
        <div>
          <dt>Dépensé</dt>
          <dd>{formatEur(stats.spent)}</dd>
        </div>
        <div>
          <dt>Plus-value</dt>
          <dd className={gain >= 0 ? styles.up : styles.down}>
            {gain >= 0 ? "+" : ""}
            {formatEur(gain)}
          </dd>
        </div>
      </dl>

      <Colors id={binder.id} current={binder.color} />

      <p className={styles.mapTitle}>Carte du classeur</p>
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
      <div className={styles.foot}>
        {stats.pricesUpdated && <span>Prix Cardmarket du {new Date(stats.pricesUpdated).toLocaleDateString("fr-FR")}</span>}
        <HoldToRemove
          label={free ? "Jeter ce classeur" : "Retirer de l'étagère"}
          hint={
            free
              ? stats.owned
                ? `Maintiens : le classeur part avec ses ${stats.owned} carte${stats.owned > 1 ? "s" : ""}`
                : "Maintiens pour jeter ce classeur vide"
              : "Maintiens : tes cartes restent dans ta collec, tu pourras le remettre"
          }
          onConfirm={onRemove}
        />
      </div>
    </div>
  );
}

/** The cover color: the binder on the shelf and its pages follow. */
function Colors({ id, current }: { id: string; current: string }) {
  const setColor = useStore((s) => s.setBinderColor);
  return (
    <div className={styles.colors} role="radiogroup" aria-label="Couleur du classeur">
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
          title="Clic : renommer"
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
function HoldToRemove({ label, hint, onConfirm }: { label: string; hint: string; onConfirm: () => void }) {
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
