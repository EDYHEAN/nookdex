"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { pocketsOf, wantsOf, wishBinders } from "@/lib/binders";
import { langLabel, langOfKey } from "@/lib/cardLang";
import { catalogSet, useSets } from "@/lib/catalog";
import { currentLang, useT } from "@/lib/lang";
import { norm } from "@/lib/search";
import { seriesName, tabOf, twinOf } from "@/lib/series";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import styles from "./ShareListPanel.module.css";

/**
 * « Je cherche »: which set binders' missing cards the list shows (all by default), the wishlists always in. By series
 * like the new binder sheet, each with its bar (all / some / none); each binder a row with what it lacks and its switch;
 * a search once the shelf holds more than 12 of them.
 */

/** past this many set binders, a search */
const SEARCH_FROM = 12;

export function WantPicker({ only, onChange, focusSet }: { only: string[] | null; onChange: (next: string[] | null) => void; focusSet?: string }) {
  const tr = useT();
  const site = currentLang();
  const binders = useStore((s) => s.binders);
  const collection = useStore((s) => s.collection);
  const sets = useSets((s) => s.sets);
  const [q, setQ] = useState("");

  const keys = useMemo(() => binders.flatMap((b) => (b.kind === "set" ? [b.setId] : [])), [binders]);
  const missing = useMemo(() => {
    const m = new Map<string, number>();
    for (const key of keys) {
      const set = sets[key];
      if (set) m.set(key, set.cards.filter((c) => !c.unavailable && !collection[c.id]?.length).length);
    }
    return m;
  }, [keys, sets, collection]);
  const wishes = useMemo(
    () =>
      wishBinders(binders).map((b) => {
        const kept = pocketsOf(b.id, collection);
        return { id: b.id, name: b.name, count: [...wantsOf(b)].filter(([pocket]) => !kept.has(pocket)).length };
      }),
    [binders, collection],
  );

  // by series (the Japanese ones with their twins, the Wizards era as one), the series with the newest set first
  const groups = useMemo(() => {
    const words = norm(q.trim());
    const m = new Map<string, { tab: string; name: string; date: string; keys: string[] }>();
    for (const key of keys) {
      const cs = catalogSet(key);
      if (words && !norm(`${cs?.name ?? key} ${cs?.code ?? ""}`).includes(words)) continue;
      const tab = tabOf(twinOf(cs?.serie ?? "?", "fr"));
      const g = m.get(tab) ?? { tab, name: seriesName(tab, site, cs?.serieName ?? tab), date: "", keys: [] };
      g.keys.push(key);
      if ((cs?.releaseDate ?? "") > g.date) g.date = cs?.releaseDate ?? "";
      m.set(tab, g);
    }
    return [...m.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [keys, q, site]);

  const included = (key: string) => !only || only.includes(key);
  const setMany = (list: string[], on: boolean) => {
    const now = new Set(only ?? keys);
    for (const k of list) {
      if (on) now.add(k);
      else now.delete(k);
    }
    const next = keys.filter((k) => now.has(k));
    onChange(next.length === keys.length ? null : next);
  };

  return (
    <div className={styles.want}>
      {keys.length > SEARCH_FROM && (
        <label className={styles.search}>
          <span aria-hidden>⌕</span>
          <input
            type="search"
            value={q}
            placeholder={tr("chercher une extension…", "find a set…")}
            onChange={(e) => {
              setQ(e.target.value);
              sfx.hover();
            }}
          />
        </label>
      )}

      {wishes.some((w) => w.count) && (
        <section className={styles.serie}>
          <h4>
            <span>★ {tr("Wishlists", "Wishlists")}</span>
            <small>
              {wishes.reduce((n, w) => n + w.count, 0)} {tr("cartes", "cards")}
            </small>
          </h4>
          {wishes
            .filter((w) => w.count)
            .map((w) => (
              <div key={w.id} className={`${styles.wantRow} ${styles.wantOn}`}>
                <span className={styles.wishStar}>★</span>
                <span className={styles.wantName}>
                  {w.name}
                  <small>
                    {w.count} {tr("cartes · toujours sur ta page", "cards · always on your page")}
                  </small>
                </span>
              </div>
            ))}
        </section>
      )}

      {!keys.length && <p className={styles.muted}>{tr("Pas encore de classeur d'extension.", "No set binder yet.")}</p>}
      {keys.length > 0 && !groups.length && <p className={styles.muted}>{tr("Aucune extension ne correspond.", "No set matches.")}</p>}
      {groups.map((g) => {
        const on = g.keys.filter(included);
        const lack = on.reduce((n, k) => n + (missing.get(k) ?? 0), 0);
        const state = on.length === g.keys.length ? "all" : on.length ? "some" : "none";
        return (
          <section key={g.tab} className={styles.serie}>
            <h4>
              <span>{g.name}</span>
              <small>
                {on.length} {tr("sur", "of")} {g.keys.length} · {lack}
              </small>
              <motion.button
                className={`${styles.serieBar} ${state === "all" ? styles.stAll : state === "some" ? styles.stSome : ""}`}
                whileTap={{ scale: 0.92 }}
                aria-label={state === "all" ? tr("Rien de cette série", "None of this series") : tr("Toute la série", "All of this series")}
                onClick={() => {
                  if (state === "all") sfx.minus();
                  else sfx.stamp();
                  setMany(g.keys, state !== "all");
                }}
              >
                {state === "all" ? "✓" : state === "some" ? "–" : ""}
              </motion.button>
            </h4>
            {g.keys.map((key) => {
              const cs = catalogSet(key);
              const isOn = included(key);
              const n = missing.get(key);
              return (
                <motion.button
                  key={key}
                  className={`${styles.wantRow} ${isOn ? styles.wantOn : ""} ${focusSet === key ? styles.chipFocus : ""}`}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    sfx.click();
                    setMany([key], !isOn);
                  }}
                  aria-pressed={isOn}
                >
                  {cs?.logo ? <img src={`${cs.logo}.png`} alt="" loading="lazy" /> : <span className={styles.noLogo} />}
                  <span className={styles.wantName}>
                    <span>
                      {cs?.name ?? key}
                      {langOfKey(key) !== site && <small className={styles.lang}>{langLabel(langOfKey(key), site)}</small>}
                    </span>
                    <small>
                      {n == null
                        ? "…"
                        : isOn
                          ? n
                            ? tr(`il en manque ${n}`, `${n} missing`)
                            : tr("complet ★", "complete ★")
                          : tr(`éteint · ${n} manquent`, `off · ${n} missing`)}
                    </small>
                  </span>
                  <i className={styles.toggle} aria-hidden />
                </motion.button>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
