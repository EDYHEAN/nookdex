"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { langLabel, langOfKey } from "@/lib/cardLang";
import { catalogSet, useSets } from "@/lib/catalog";
import { currentLang, useT } from "@/lib/lang";
import { norm } from "@/lib/search";
import { seriesName, tabOf, twinOf } from "@/lib/series";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import styles from "./ShareListPanel.module.css";

/**
 * « Je cherche »: which set binders' missing cards the list shows (all by default). By series like the new binder sheet,
 * each with its « tout / rien », each binder with what it lacks; a search once the shelf holds more than 12 of them.
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

  if (!keys.length) return <p className={styles.muted}>{tr("Pas encore de classeur d'extension.", "No set binder yet.")}</p>;

  return (
    <div className={styles.want}>
      {keys.length > SEARCH_FROM && (
        <label className={styles.search}>
          <span aria-hidden>⌕</span>
          <input
            type="search"
            value={q}
            placeholder={tr("chercher un classeur…", "find a binder…")}
            onChange={(e) => {
              setQ(e.target.value);
              sfx.hover();
            }}
          />
        </label>
      )}
      {!groups.length && <p className={styles.muted}>{tr("Aucun classeur ne correspond.", "No binder matches.")}</p>}
      {groups.map((g) => {
        const on = g.keys.filter(included).length;
        return (
          <section key={g.tab} className={styles.serie}>
            <h4>
              <span>{g.name}</span>
              <small>
                {on}/{g.keys.length}
              </small>
              <button
                className={styles.mini}
                disabled={on === g.keys.length}
                onClick={() => {
                  sfx.stamp();
                  setMany(g.keys, true);
                }}
              >
                {tr("tout", "all")}
              </button>
              <button
                className={styles.mini}
                disabled={!on}
                onClick={() => {
                  sfx.minus();
                  setMany(g.keys, false);
                }}
              >
                {tr("rien", "none")}
              </button>
            </h4>
            <div className={styles.chips}>
              {g.keys.map((key) => {
                const cs = catalogSet(key);
                const isOn = included(key);
                return (
                  <motion.button
                    key={key}
                    className={`${styles.chip} ${isOn ? styles.chipOn : ""} ${focusSet === key ? styles.chipFocus : ""}`}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      sfx.click();
                      setMany([key], !isOn);
                    }}
                    aria-pressed={isOn}
                  >
                    {cs?.logo && <img src={`${cs.logo}.png`} alt="" loading="lazy" />}
                    <span>{cs?.name ?? key}</span>
                    {langOfKey(key) !== site && <small className={styles.lang}>{langLabel(langOfKey(key), site)}</small>}
                    <small title={tr("cartes qui manquent", "cards missing")}>{missing.get(key) ?? "…"}</small>
                  </motion.button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
