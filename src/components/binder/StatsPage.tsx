"use client";

import { formatEur, type SetStats } from "@/lib/price";
import { sfx } from "@/lib/sound";
import type { BinderDef, CardData, Copy } from "@/lib/types";
import styles from "./Binder.module.css";

interface Props {
  binder: BinderDef;
  stats: SetStats;
  pages: CardData[][];
  collection: Record<string, Copy[]>;
  onJump: (page: number) => void;
}

export function StatsPage({ binder, stats, pages, collection, onJump }: Props) {
  const set = binder.set!;
  const pct = stats.total ? stats.owned / stats.total : 0;
  const segments = 20;
  const lit = Math.round(pct * segments);
  const updated = new Date(set.pricesUpdated).toLocaleDateString("fr-FR");
  const gain = stats.spentTrend - stats.spent;

  return (
    <div className={styles.stats} style={{ ["--accent" as string]: binder.color }}>
      <div className={styles.statsHead}>
        <img src={`${binder.logo}.png`} alt="" draggable={false} />
        <div>
          <p className={styles.kicker}>{binder.code} · sommaire</p>
          <h2>{set.name}</h2>
        </div>
      </div>

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

      <dl className={styles.kv}>
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

      <p className={styles.mapTitle}>Carte du classeur</p>
      <div className={styles.map}>
        {pages.map((cards, i) => {
          const owned = cards.filter((c) => collection[c.id]?.length).length;
          return (
            <button
              key={i}
              className={`${styles.mapPage} ${owned === cards.length ? styles.mapDone : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                sfx.click();
                onJump(i);
              }}
              onPointerEnter={sfx.hover}
              title={`Page ${i + 1} — ${owned}/${cards.length}`}
            >
              {cards.map((c) => (
                <span key={c.id} className={collection[c.id]?.length ? styles.dotOn : ""} />
              ))}
            </button>
          );
        })}
      </div>
      <p className={styles.foot}>Prix Cardmarket du {updated}</p>
    </div>
  );
}
