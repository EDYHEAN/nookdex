"use client";

import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CARD_LANGS, type CardLang, type Currency, currencyOf, langLabel } from "@/lib/cardLang";
import { loadIndex, useSets } from "@/lib/catalog";
import { useLang, useT } from "@/lib/lang";
import { convert, formatPrice, playerCurrency } from "@/lib/price";
import { RARITY_TIERS, type RarityTier } from "@/lib/rarity";
import { type Row, compareNum, matcher, norm, relevance, rowsOf } from "@/lib/search";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import type { CatalogSet } from "@/lib/types";
import { CardBack } from "../binder/CardBack";
import styles from "./Computer.module.css";

type Sort = "price" | "cheap" | "rarity" | "new" | "old" | "relevance";
type Own = "all" | "owned" | "missing";

interface Filters {
  q: string;
  langs: CardLang[];
  sort: Sort;
  tier: RarityTier | null;
  year: string | null;
  set: string | null;
  own: Own;
}

/** The cards of the site's language by default (the other ones one tap away). */
const START: Omit<Filters, "langs"> = { q: "", sort: "price", tier: null, year: null, set: null, own: "all" };
/** Kept while the page lives: back in the tab, the player finds the search as they left it. */
let kept: Filters | null = null;

const PAGE = 120;

/** Sorted in the player's money (French and English cards are on two markets); a card with no price goes last. */
function sortRows(rows: Row[], sort: Sort, q: string, money: Currency): Row[] {
  const price = new Map<Row, number>();
  for (const r of rows) price.set(r, r.trend == null ? -1 : convert(r.trend, currencyOf(r.lang), money));
  const p = (r: Row) => price.get(r)!;
  const newest = (a: Row, b: Row) => b.date.localeCompare(a.date) || (a.set?.id ?? "").localeCompare(b.set?.id ?? "") || compareNum(a.num, b.num);
  const score = new Map<Row, number>();
  if (sort === "relevance") for (const r of rows) score.set(r, relevance(r, q));
  const cmp: Record<Sort, (a: Row, b: Row) => number> = {
    price: (a, b) => p(b) - p(a),
    cheap: (a, b) => Number(p(a) < 0) - Number(p(b) < 0) || p(a) - p(b),
    rarity: (a, b) => b.rank - a.rank || p(b) - p(a),
    new: newest,
    old: (a, b) => a.date.localeCompare(b.date) || (a.set?.id ?? "").localeCompare(b.set?.id ?? "") || compareNum(a.num, b.num),
    relevance: (a, b) => score.get(a)! - score.get(b)! || newest(a, b),
  };
  return rows.sort(cmp[sort]);
}

/**
 * NookDex OS → "All cards": every card we have (French, English, Japanese), whether or not the player has its binder.
 * Search, filters (rarity, year, set, owned) and sorts (price first): a way in for a player with no collection yet.
 */
export function AllCards({ onOpen }: { onOpen: (keys: string[], index: number) => void }) {
  const tr = useT();
  const site = useLang();
  const [f, setF] = useState<Filters>(() => kept ?? { ...START, langs: [site] });
  const change = (patch: Partial<Filters>) =>
    setF((x) => {
      kept = { ...x, ...patch };
      return kept;
    });
  const indexes = useSets((s) => s.index);
  const assets = useSets((s) => s.assets);
  const collection = useStore((s) => s.collection);
  const money = useStore((s) => s.currency) ?? playerCurrency();
  const [failed, setFailed] = useState<CardLang[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const q = useDeferredValue(f.q);

  useEffect(() => {
    // a phone's keyboard would hide the cards: the field only takes the focus with a mouse
    if (matchMedia("(pointer: fine)").matches) input.current?.focus();
  }, []);

  useEffect(() => {
    for (const l of f.langs) loadIndex(l).catch(() => setFailed((x) => (x.includes(l) ? x : [...x, l])));
  }, [f.langs]);

  const loading = f.langs.some((l) => !indexes[l] && !failed.includes(l));
  const rows = useMemo(() => f.langs.flatMap((l) => (indexes[l] ? rowsOf(indexes[l]) : [])), [f.langs, indexes]);

  // The search, rarity and collection filters; the year and set menus then only offer what has cards left
  const base = useMemo(() => {
    const match = matcher(q);
    return rows.filter(
      (r) => (!f.tier || r.tier === f.tier) && (f.own === "all" || !!collection[r.key]?.length === (f.own === "owned")) && (!match || match(r)),
    );
  }, [rows, q, f.tier, f.own, collection]);

  const years = useMemo(
    () => [...new Set(base.filter((r) => !f.set || r.set?.id === f.set).map((r) => r.date.slice(0, 4)))].filter(Boolean).sort().reverse(),
    [base, f.set],
  );
  const sets = useMemo(() => {
    const out = new Map<string, { set: CatalogSet; n: number }>();
    for (const r of base) {
      if (!r.set || (f.year && !r.date.startsWith(f.year))) continue;
      const s = out.get(r.set.id);
      if (s) s.n++;
      else out.set(r.set.id, { set: r.set, n: 1 });
    }
    return [...out.values()].sort((a, b) => (b.set.releaseDate ?? "").localeCompare(a.set.releaseDate ?? ""));
  }, [base, f.year]);

  const list = useMemo(
    () => sortRows(base.filter((r) => (!f.year || r.date.startsWith(f.year)) && (!f.set || r.set?.id === f.set)), f.sort === "relevance" && !q.trim() ? "price" : f.sort, q, money),
    [base, f.year, f.set, f.sort, q, money],
  );

  // a new search starts again from the first page
  const sig = JSON.stringify([q, f.langs, f.sort, f.tier, f.year, f.set, f.own]);
  const [page, setPage] = useState({ sig, n: PAGE });
  const shown = page.sig === sig ? page.n : PAGE;

  const filtered = f.tier || f.year || f.set || f.own !== "all" || f.q.trim();
  const sortLabels: Record<Sort, string> = {
    price: tr("prix ↓", "price ↓"),
    cheap: tr("prix ↑", "price ↑"),
    rarity: tr("rareté", "rarity"),
    new: tr("récentes", "newest"),
    old: tr("anciennes", "oldest"),
    relevance: tr("pertinence", "relevance"),
  };
  const sorts: Sort[] = f.q.trim() ? ["relevance", "price", "cheap", "rarity", "new", "old"] : ["price", "cheap", "rarity", "new", "old"];
  const multi = f.langs.length > 1;

  return (
    <div className={styles.listTab}>
      <label className={styles.searchBox}>
        <span>&gt;</span>
        <input
          ref={input}
          value={f.q}
          placeholder={tr("nom, numéro, extension… (ex : dracaufeu, lugia 186)", "name, number, set… (e.g. charizard, lugia 186)")}
          onChange={(e) => {
            const q = e.target.value;
            // typing a name: the best matches first, unless the player chose a sort
            change({ q, sort: q.trim() && !f.q.trim() && f.sort === "price" ? "relevance" : !q.trim() && f.sort === "relevance" ? "price" : f.sort });
            sfx.hover();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && list[0]) onOpen(list.map((r) => r.key), 0);
          }}
          aria-label={tr("Rechercher une carte", "Search a card")}
        />
      </label>

      <div className={styles.filters}>
        <span className={styles.langToggles} role="group" aria-label={tr("Langue des cartes", "Card language")}>
          {CARD_LANGS.map((l) => {
            const on = f.langs.includes(l);
            return (
              <motion.button
                key={l}
                aria-pressed={on}
                className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                whileTap={{ scale: 0.85, rotate: -6 }}
                onPointerEnter={sfx.hover}
                onClick={() => {
                  // at least one language stays on
                  if (on && f.langs.length === 1) return sfx.locked();
                  sfx.stamp();
                  change({ langs: on ? f.langs.filter((x) => x !== l) : CARD_LANGS.filter((x) => x === l || f.langs.includes(x)), set: null });
                }}
                title={{ fr: tr("Cartes françaises", "French cards"), en: tr("Cartes anglaises", "English cards"), ja: tr("Cartes japonaises", "Japanese cards") }[l]}
              >
                {langLabel(l, site)}
              </motion.button>
            );
          })}
        </span>
        <Menu
          label={tr("Tri", "Sort")}
          value={f.sort === "relevance" && !f.q.trim() ? "price" : f.sort}
          options={sorts.map((s) => ({ value: s, label: sortLabels[s] }))}
          onPick={(sort) => change({ sort })}
        />
        <Menu
          label={tr("Rareté", "Rarity")}
          value={f.tier}
          options={[
            { value: null, label: tr("toutes", "all") },
            ...RARITY_TIERS.map((t) => ({ value: t.id as RarityTier, label: tr(t.label[0], t.label[1]), gem: t.id })),
          ]}
          onPick={(tier) => change({ tier })}
        />
        <Menu
          label={tr("Année", "Year")}
          value={f.year}
          options={[{ value: null, label: tr("toutes", "all") }, ...years.map((y) => ({ value: y, label: y }))]}
          onPick={(year) => change({ year, set: null })}
        />
        <Menu
          label={tr("Extension", "Set")}
          value={f.set}
          wide
          filter={tr("chercher une extension", "find a set")}
          options={[
            { value: null, label: tr("toutes", "all") },
            ...sets.map(({ set, n }) => ({
              value: set.id,
              label: (
                <>
                  {set.name}
                  {multi && <small className={styles.langTag}>{langLabel(set.lang ?? "fr", site)}</small>}
                </>
              ),
              short: set.name,
              text: `${set.name} ${set.code}`,
              logo: set.logo,
              hint: `${set.code} · ${set.releaseDate?.slice(0, 4) ?? "?"} · ${n}`,
            })),
          ]}
          onPick={(set) => change({ set })}
        />
        <Menu
          label={tr("Collection", "Collection")}
          value={f.own}
          options={[
            { value: "all" as Own, label: tr("toutes", "all") },
            { value: "owned" as Own, label: tr("✓ possédées", "✓ owned") },
            { value: "missing" as Own, label: tr("manquantes", "missing") },
          ]}
          onPick={(own) => change({ own })}
        />
      </div>

      <p className={styles.muted}>
        {loading ? (
          tr("on ouvre le catalogue…", "opening the catalogue…")
        ) : (
          <>
            <b className={styles.count}>{list.length.toLocaleString(tr("fr-FR", "en-GB"))}</b> {tr("carte", "card")}
            {list.length > 1 ? "s" : ""}
            {!filtered && f.sort === "price" && tr(" · les plus chères d'abord", " · most valuable first")}
            {filtered && (
              <>
                {" · "}
                <button
                  className={styles.linkBtn}
                  onClick={() => {
                    sfx.click();
                    change({ ...START, langs: f.langs });
                  }}
                >
                  {tr("tout effacer", "clear all")}
                </button>
              </>
            )}
          </>
        )}
      </p>
      {failed.some((l) => f.langs.includes(l)) && (
        <p className={styles.muted}>{tr("Impossible de charger le catalogue. Vérifie ta connexion.", "Couldn't load the catalogue. Check your connection.")}</p>
      )}
      {!loading && !list.length && (
        <p className={styles.muted}>{tr("Aucune carte… essaie une autre orthographe ou enlève un filtre.", "No card… try another spelling or drop a filter.")}</p>
      )}

      <div className={styles.cardGrid}>
        {list.slice(0, shown).map((r, i) => {
          const qty = collection[r.key]?.reduce((n, c) => n + c.qty, 0) ?? 0;
          return (
            <button
              key={r.key}
              className={styles.cardTile}
              style={{ ["--i" as string]: i % PAGE }}
              onClick={() => {
                sfx.flip();
                onOpen(
                  list.map((x) => x.key),
                  i,
                );
              }}
              onPointerEnter={sfx.hover}
              title={[r.name, r.aka, r.rarity].filter(Boolean).join(" · ")}
            >
              <span className={styles.cardScan}>
                {/* a TCGplayer scan is the site's own file, a full address */}
                <Scan src={r.img && `${r.img.startsWith("http") ? "" : assets}${r.img}/low.webp`} />
                {qty > 0 && <span className={styles.have}>✓{qty > 1 ? ` ×${qty}` : ""}</span>}
              </span>
              <span className={styles.cardName}>{r.name}</span>
              <small>
                {r.set?.code ?? "?"} · {r.num}
                {r.lang !== site && <span className={styles.langTag}>{langLabel(r.lang, site)}</span>}
              </small>
              <b className={styles.money}>{formatPrice(r.trend == null ? null : convert(r.trend, currencyOf(r.lang), money), money)}</b>
            </button>
          );
        })}
      </div>
      {list.length > shown && (
        <button
          className={`${styles.btnBig} ${styles.more}`}
          onClick={() => {
            sfx.riffle();
            setPage({ sig, n: shown + PAGE });
          }}
        >
          {tr(`Voir plus (${(list.length - shown).toLocaleString("fr-FR")} autres)`, `Show more (${(list.length - shown).toLocaleString("en-GB")} more)`)}
        </button>
      )}
    </div>
  );
}

/** A card's scan; its painted back when there's none, or none any more (a card TCGdex took out keeps its address). */
function Scan({ src }: { src: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <CardBack label={false} />;
  return <img src={src} alt="" loading="lazy" draggable={false} onError={() => setFailed(src)} />;
}

/* ------------------------------------------------------------------ */

interface Option<T> {
  value: T;
  label: ReactNode;
  /** Shown on the button when picked, if the label is too rich */
  short?: string;
  /** What the menu's own search looks into */
  text?: string;
  hint?: string;
  logo?: string | null;
  gem?: RarityTier;
}

/** A terminal drop-down: the current choice on a key, a list that unrolls under it (a sheet at the bottom on a phone). */
function Menu<T extends string | null>({
  label,
  value,
  options,
  onPick,
  wide,
  filter,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onPick: (v: T) => void;
  wide?: boolean;
  /** Placeholder of a search field at the top of a long list */
  filter?: string;
}) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  /** Unrolls leftwards from a key on the right half of the screen */
  const [right, setRight] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    // Escape closes the list, not the whole OS
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const nq = norm(q.trim());
  const shown = nq ? options.filter((o) => o.value === null || norm(o.text ?? String(o.label)).includes(nq)) : options;

  return (
    <div ref={box} className={styles.menu}>
      <button
        className={`${styles.chip} ${value !== options[0].value ? styles.chipOn : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onPointerEnter={sfx.hover}
        onClick={() => {
          sfx.click();
          setRight((box.current?.getBoundingClientRect().left ?? 0) > window.innerWidth / 2);
          setOpen(!open);
          setQ("");
        }}
      >
        {label} : {current.short ?? current.label} <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className={`${styles.menuList} ${wide ? styles.menuWide : ""} ${right ? styles.menuRight : ""}`}
            role="listbox"
            aria-label={label}
            initial={{ opacity: 0, y: -8, scaleY: 0.6 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.8, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 520, damping: 30 }}
          >
            {filter && (
              <label className={styles.menuSearch}>
                <span aria-hidden>&gt;</span>
                <input autoFocus value={q} placeholder={filter} onChange={(e) => setQ(e.target.value)} aria-label={filter} />
              </label>
            )}
            {shown.map((o) => (
              <button
                key={String(o.value)}
                role="option"
                aria-selected={o.value === value}
                className={`${styles.menuItem} ${o.value === value ? styles.menuOn : ""}`}
                onPointerEnter={sfx.hover}
                onClick={() => {
                  sfx.stamp();
                  onPick(o.value);
                  setOpen(false);
                }}
              >
                {o.logo !== undefined && <span className={styles.menuLogo}>{o.logo && <img src={`${o.logo}.png`} alt="" loading="lazy" />}</span>}
                {o.gem && <i className={`${styles.gemTier} ${styles[`gem_${o.gem}`]}`} aria-hidden />}
                <span className={styles.menuLabel}>{o.label}</span>
                {o.hint && <small>{o.hint}</small>}
              </button>
            ))}
            {shown.length <= 1 && nq && <p className={styles.muted}>{tr("rien trouvé", "nothing found")}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
