"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { pocketsOf, wantsOf, wishBinders } from "@/lib/binders";
import { type CardLang, langLabel, langOfKey } from "@/lib/cardLang";
import { catalogSet, loadIndex, setIdOfCard, useSets } from "@/lib/catalog";
import { currentLang, useT } from "@/lib/lang";
import { type Row, matcher, relevance, rowsOf } from "@/lib/search";
import { seriesName, tabOf, twinOf } from "@/lib/series";
import { starsWanted } from "@/lib/share";
import { sfx } from "@/lib/sound";
import { type WantMode, useStore } from "@/lib/store";
import { BottomSheet } from "./BottomSheet";
import styles from "./TradePanel.module.css";

/**
 * « Je cherche »: a search for one card (any card of the indexes, like NookDex OS → Toutes les cartes: a tap ★ it), then
 * the set binders as tiles by series. A tile's ring is the set's progress, its number what it puts in the list: all its
 * missing cards (« ✓ toutes », the default), its ★ ones (« mes choix ») or none (« pas sur ma page »). A tap opens its
 * missing cards in a sheet: the three ways, and a tap on a card ★ it.
 */

const NOTE_KEY = "nookdex:want-note";
/** a search draws its first hits only */
const HITS = 24;

const readNote = () => {
  try {
    return !!localStorage.getItem(NOTE_KEY);
  } catch {
    return true;
  }
};

export function Ring({ pct, color, logo, dim }: { pct: number; color: string; logo?: string | null; dim?: boolean }) {
  return (
    <span className={`${styles.ring} ${dim ? styles.ringDim : ""}`} style={{ background: `conic-gradient(${color} ${Math.round(pct * 100)}%, #e6dccb 0)` }}>
      <span>{logo ? <img src={`${logo}.png`} alt="" loading="lazy" /> : <b className={styles.ringStar}>★</b>}</span>
    </span>
  );
}

export function WantView({ focusSet, wide }: { focusSet?: string; wide: boolean }) {
  const tr = useT();
  const site = currentLang();
  const binders = useStore((s) => s.binders);
  const collection = useStore((s) => s.collection);
  const stars = useStore((s) => s.stars);
  const modes = useStore((s) => s.wantModes);
  const sets = useSets((s) => s.sets);
  const [open, setOpen] = useState<string | null>(focusSet ?? null);
  const [noteSeen, setNoteSeen] = useState(readNote);
  const seeNote = () => {
    setNoteSeen(true);
    try {
      localStorage.setItem(NOTE_KEY, "1");
    } catch {}
  };

  const keys = useMemo(() => binders.flatMap((b) => (b.kind === "set" ? [b.setId] : [])), [binders]);
  const starred = useMemo(() => starsWanted(stars, collection), [stars, collection]);
  /** a set binder: its missing cards, its ★ ones among them, its progress */
  const info = useCallback(
    (key: string) => {
      const set = sets[key];
      const missing = set ? set.cards.filter((c) => !c.unavailable && !collection[c.id]?.length) : [];
      const picks = starred.filter((k) => setIdOfCard(k) === key).length;
      return { set, missing, picks, pct: set?.cards.length ? 1 - missing.length / set.cards.length : 0, mode: (modes[key] ?? "all") as WantMode };
    },
    [sets, collection, starred, modes],
  );
  // by series (the Japanese ones with their twins, the Wizards era as one), the series with the newest set first
  const groups = useMemo(() => {
    const m = new Map<string, { tab: string; name: string; date: string; keys: string[] }>();
    for (const key of keys) {
      const cs = catalogSet(key);
      const tab = tabOf(twinOf(cs?.serie ?? "?", "fr"));
      const g = m.get(tab) ?? { tab, name: seriesName(tab, site, cs?.serieName ?? tab), date: "", keys: [] };
      g.keys.push(key);
      if ((cs?.releaseDate ?? "") > g.date) g.date = cs?.releaseDate ?? "";
      m.set(tab, g);
    }
    return [...m.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [keys, site]);
  // ★ cards of sets with no binder (a search, a card sheet): a tile of their own
  const loose = useMemo(() => starred.filter((k) => !keys.includes(setIdOfCard(k) ?? "")), [starred, keys]);
  const wishes = useMemo(
    () =>
      wishBinders(binders)
        .map((b) => {
          const kept = pocketsOf(b.id, collection);
          return { id: b.id, name: b.name, count: [...wantsOf(b)].filter(([pocket]) => !kept.has(pocket)).length };
        })
        .filter((w) => w.count),
    [binders, collection],
  );
  const cur = open && open !== "★" ? info(open) : null;

  return (
    <div className={styles.want}>
      <StarSearch count={starred.length} wide={wide} />

      {groups.map((g) => {
        const lack = g.keys.reduce((n, k) => {
          const i = info(k);
          return n + (i.mode === "all" ? i.missing.length : i.mode === "picks" ? i.picks : 0);
        }, 0);
        return (
          <section key={g.tab}>
            <h4 className={styles.sect}>
              <span>{g.name}</span>
              <span>
                {g.keys.length} {tr(g.keys.length > 1 ? "classeurs" : "classeur", g.keys.length > 1 ? "binders" : "binder")} · {lack}
              </span>
            </h4>
            <div className={styles.tiles}>
              {g.keys.map((key) => {
                const i = info(key);
                const cs = catalogSet(key);
                return (
                  <motion.button
                    key={key}
                    className={`${styles.tile} ${i.mode === "none" ? styles.tileOff : ""} ${focusSet === key ? styles.tileFocus : ""}`}
                    whileTap={{ scale: 0.94 }}
                    whileHover={{ y: -3 }}
                    onClick={() => {
                      sfx.riffle();
                      seeNote();
                      setOpen(key);
                    }}
                  >
                    {i.mode === "all" && <span className={styles.badge}>✓ {tr("toutes", "all")}</span>}
                    {i.mode === "picks" && <span className={`${styles.badge} ${styles.badgeStar}`}>★ {i.picks}</span>}
                    {langOfKey(key) !== site && <span className={styles.tileLang}>{langLabel(langOfKey(key), site)}</span>}
                    <Ring pct={i.pct} color={i.mode === "picks" ? "#f6c84c" : i.mode === "all" ? "#4f7fc4" : "#bbb"} logo={cs?.logo} dim={i.mode === "none"} />
                    <b>{i.mode === "none" ? "—" : i.mode === "picks" ? i.picks : i.set ? i.missing.length : "…"}</b>
                    <small>{i.mode === "none" ? tr("pas sur ma page", "not on my page") : i.mode === "picks" ? tr("choisies", "picked") : tr("manquent", "missing")}</small>
                  </motion.button>
                );
              })}
            </div>
          </section>
        );
      })}

      {(loose.length > 0 || wishes.length > 0) && (
        <section>
          <h4 className={styles.sect}>
            <span>★ {tr("À la carte", "One by one")}</span>
            <span>{loose.length + wishes.reduce((n, w) => n + w.count, 0)}</span>
          </h4>
          <div className={styles.tiles}>
            {loose.length > 0 && (
              <motion.button className={styles.tile} whileTap={{ scale: 0.94 }} onClick={() => (sfx.riffle(), setOpen("★"))}>
                <span className={`${styles.badge} ${styles.badgeStar}`}>★ {loose.length}</span>
                <Ring pct={1} color="#f6c84c" />
                <b>{loose.length}</b>
                <small>{tr("hors classeurs", "no binder")}</small>
              </motion.button>
            )}
            {wishes.map((w) => (
              <div key={w.id} className={styles.tile}>
                <span className={`${styles.badge} ${styles.badgeStar}`}>★</span>
                <Ring pct={1} color="#f6c84c" />
                <b>{w.count}</b>
                <small>★ {w.name}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {!keys.length && !loose.length && !wishes.length && (
        <p className={styles.muted}>{tr("Pas encore de classeur : cherche une carte ci-dessus pour la ★.", "No binder yet: find a card above to ★ it.")}</p>
      )}

      <AnimatePresence>
        {!noteSeen && keys.length > 0 && (
          <motion.div className={styles.taped} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            <span>
              {tr("Touche un classeur : ", "Tap a binder: ")}
              <b>{tr("toutes", "all")}</b> {tr("ses manquantes, ou ", "its missing cards, or ")}
              <b>★ {tr("seulement celles que tu choisis", "only the ones you pick")}</b>.
            </span>
            <button className={styles.tapedX} onClick={() => (sfx.click(), seeNote())} aria-label={tr("Compris", "Got it")}>
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cur && open && (
          <BottomSheet
            key={open}
            logo={catalogSet(open)?.logo}
            title={catalogSet(open)?.name ?? open}
            sub={tr(`${cur.missing.length} cartes te manquent`, `${cur.missing.length} cards missing`)}
            onClose={() => setOpen(null)}
          >
            <PickSheet setKey={open} mode={cur.mode} missing={cur.missing.map((c) => ({ key: c.id, img: c.img, name: c.name }))} picks={cur.picks} />
          </BottomSheet>
        )}
        {open === "★" && (
          <BottomSheet key="loose" title={tr("★ À la carte", "★ One by one")} sub={tr(`${loose.length} cartes hors de tes classeurs`, `${loose.length} cards from no binder`)} onClose={() => setOpen(null)}>
            <LooseSheet keys={loose} />
          </BottomSheet>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A set binder's sheet: « toutes · mes choix · aucune », and its missing cards (a tap ★ one) */
function PickSheet({ setKey, mode, missing, picks }: { setKey: string; mode: WantMode; missing: { key: string; img: string; name: string }[]; picks: number }) {
  const tr = useT();
  const stars = useStore((s) => s.stars);
  const { setWantMode, setStars } = useStore.getState();
  const [pop, setPop] = useState<string | null>(null);
  const segs: [WantMode, string, string][] = [
    ["all", String(missing.length), tr("toutes", "all")],
    ["picks", `★ ${picks}`, tr("mes choix", "my picks")],
    ["none", "0", tr("aucune", "none")],
  ];
  return (
    <>
      <div className={styles.seg} role="radiogroup">
        {segs.map(([m, big, label]) => (
          <motion.button
            key={m}
            role="radio"
            aria-checked={mode === m}
            className={mode === m ? styles.segOn : ""}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              if (m === "none") sfx.minus();
              else sfx.stamp();
              setWantMode(setKey, m);
            }}
          >
            <b>{big}</b>
            {label}
          </motion.button>
        ))}
      </div>
      <ul className={styles.cards}>
        {missing.map((c) => {
          const star = !!stars[c.key];
          const lit = mode === "all" || (mode === "picks" && star);
          return (
            <li key={c.key} className={`${lit ? styles.cdOn : ""} ${star ? styles.cdStar : ""} ${pop === c.key ? styles.cdPop : ""}`}>
              <motion.button
                whileTap={{ scale: 0.9 }}
                aria-pressed={star}
                aria-label={c.name}
                onClick={() => {
                  // ★ it; a binder in « aucune » turns to « mes choix » with it
                  if (!star && mode === "none") setWantMode(setKey, "picks");
                  setStars([c.key], !star);
                  if (star) sfx.minus();
                  else {
                    sfx.wish();
                    setPop(c.key);
                    setTimeout(() => setPop((p) => (p === c.key ? null : p)), 600);
                  }
                }}
              >
                {c.img ? <img src={`${c.img}/low.webp`} alt="" loading="lazy" draggable={false} /> : <span className={styles.cdName}>{c.name}</span>}
                {star && (
                  <motion.em initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 14 }}>
                    ★
                  </motion.em>
                )}
              </motion.button>
            </li>
          );
        })}
      </ul>
      <p className={styles.rule}>{tr("Touche une carte = ★ je la cherche", "Tap a card = ★ I'm after it")}</p>
    </>
  );
}

/** The ★ cards of sets with no binder: a tap takes the ★ off */
function LooseSheet({ keys }: { keys: string[] }) {
  const tr = useT();
  const cards = useSets((s) => s.cards);
  const assets = useSets((s) => s.assets);
  const rows = useLangRows(useMemo(() => [...new Set(keys.map(langOfKey))], [keys]));
  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);
  return (
    <>
      <ul className={styles.cards}>
        {keys.map((k) => {
          const c = cards[k];
          const r = byKey.get(k);
          const img = c?.img ? `${c.img}/low.webp` : r?.img ? `${r.img.startsWith("http") ? "" : assets}${r.img}/low.webp` : null;
          return (
            <li key={k} className={`${styles.cdOn} ${styles.cdStar}`}>
              <motion.button whileTap={{ scale: 0.9 }} aria-label={c?.name ?? r?.name ?? k} onClick={() => (sfx.minus(), useStore.getState().setStars([k], false))}>
                {img ? <img src={img} alt="" loading="lazy" draggable={false} /> : <span className={styles.cdName}>{c?.name ?? r?.name ?? k}</span>}
                <em>★</em>
              </motion.button>
            </li>
          );
        })}
      </ul>
      <p className={styles.rule}>{tr("Touche une carte = elle sort de « je cherche »", "Tap a card = out of « wanted »")}</p>
    </>
  );
}

/** The search indexes of these card languages, as rows (loaded on demand) */
function useLangRows(langs: CardLang[]): Row[] {
  const index = useSets((s) => s.index);
  useEffect(() => {
    for (const l of langs) void loadIndex(l).catch(() => {});
  }, [langs]);
  return useMemo(() => langs.flatMap((l) => (index[l] ? rowsOf(index[l]!) : [])), [langs, index]);
}

/**
 * « une carte précise… »: any card of the indexes (the site's card language first, like NookDex OS → Toutes les cartes).
 * A tap ★ it (or takes the ★ off); a card already owned says so.
 */
function StarSearch({ count, wide }: { count: number; wide: boolean }) {
  const tr = useT();
  const site = currentLang();
  const stars = useStore((s) => s.stars);
  const collection = useStore((s) => s.collection);
  const assets = useSets((s) => s.assets);
  const [q, setQ] = useState("");
  const query = useDeferredValue(q);
  const [pop, setPop] = useState<string | null>(null);
  const langs = useMemo<CardLang[]>(() => (query.trim() ? [site] : []), [query, site]);
  const rows = useLangRows(langs);
  const hits = useMemo(() => {
    const match = matcher(query);
    if (!match) return [];
    return rows
      .filter(match)
      .sort((a, b) => relevance(a, query) - relevance(b, query) || b.date.localeCompare(a.date))
      .slice(0, HITS);
  }, [rows, query]);

  return (
    <div className={styles.starSearch}>
      <label className={styles.search}>
        <span aria-hidden>⌕</span>
        <input
          type="search"
          value={q}
          placeholder={wide ? tr("une carte précise : dracaufeu, mew 151…", "one card: charizard, mew 151…") : tr("une carte précise…", "one card…")}
          onChange={(e) => {
            setQ(e.target.value);
            sfx.hover();
          }}
        />
        <motion.span key={count} className={styles.starCount} initial={{ scale: 1.4 }} animate={{ scale: 1 }}>
          ★ {count}
        </motion.span>
      </label>
      {query.trim() && (
        <>
          {!rows.length && <p className={styles.muted}>{tr("on ouvre le catalogue…", "opening the catalogue…")}</p>}
          {rows.length > 0 && !hits.length && <p className={styles.muted}>{tr("Aucune carte ne correspond.", "No card matches.")}</p>}
          <ul className={styles.cards}>
            {hits.map((r) => {
              const owned = !!collection[r.key]?.length;
              const star = !!stars[r.key];
              return (
                <li key={r.key} className={`${star || owned ? styles.cdOn : ""} ${star ? styles.cdStar : ""} ${pop === r.key ? styles.cdPop : ""}`}>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    aria-pressed={star}
                    aria-label={`${r.name} ${r.num}`}
                    onClick={() => {
                      if (owned) {
                        sfx.locked();
                        return;
                      }
                      useStore.getState().setStars([r.key], !star);
                      if (star) sfx.minus();
                      else {
                        sfx.wish();
                        setPop(r.key);
                        setTimeout(() => setPop((p) => (p === r.key ? null : p)), 600);
                      }
                    }}
                  >
                    {r.img ? <img src={`${r.img.startsWith("http") ? "" : assets}${r.img}/low.webp`} alt="" loading="lazy" draggable={false} /> : <span className={styles.cdName}>{r.name}</span>}
                    {star && <motion.em initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }}>★</motion.em>}
                    {owned && <i className={styles.cdOwned}>✓ {tr("à toi", "yours")}</i>}
                  </motion.button>
                  <span className={styles.cdCaption}>
                    {r.name} · {r.set?.code ?? ""} {r.num}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
