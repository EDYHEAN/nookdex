"use client";

import { AnimatePresence, motion } from "motion/react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CARD_LANGS, type CardLang, currencyOf, langLabel, langOfKey } from "@/lib/cardLang";
import { loadIndex, loadSet, setIdOfCard, useSets } from "@/lib/catalog";
import { useLang, useT } from "@/lib/lang";
import { convert, formatMoney, playerCurrency, variantLabel } from "@/lib/price";
import { type Row, matcher, relevance, rowsOf } from "@/lib/search";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import { CONDITIONS, CONDITION_RATE, GRADES, type Side, type TradeItem, itemValue, loadTrade, saveTrade, verdictOf } from "@/lib/trade";
import type { CardData, Copy, Variant } from "@/lib/types";
import { CardBack } from "../binder/CardBack";
import styles from "./TradeMat.module.css";

const uid = () => Math.random().toString(36).slice(2, 10);
const plainFirst = (vs: Variant[]): Variant => (vs.includes("normal") ? "normal" : vs.includes("holo") ? "holo" : (vs[0] ?? "normal"));

/**
 * The trade mat (lib/trade): a playmat over nearly the whole screen, what is given on one side, what is received on the
 * other, one bar between them telling which way the trade leans. A card's details (version, condition, grade) are a tap
 * away; « Échange accepté » updates the collection.
 */
export default function TradeMat({ onClose, seed }: { onClose: () => void; seed?: { key: string; copy?: Copy } }) {
  const t = useT();
  // opened from a card's sheet (« Échanger »): that card on the player's side, once
  const [items, setItems] = useState<TradeItem[]>(() => {
    const kept = loadTrade();
    if (!seed || kept.some((it) => it.side === "give" && it.key === seed.key)) return kept;
    const card = useSets.getState().cards[seed.key];
    return [
      ...kept,
      {
        uid: uid(),
        side: "give",
        key: seed.key,
        variant: seed.copy?.variant ?? plainFirst(card?.variants ?? []),
        condition: seed.copy?.condition ?? "NM",
        grade: null,
        price: null,
        copyId: seed.copy?.id,
      },
    ];
  });
  const [adding, setAdding] = useState<Side | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [done, setDone] = useState<{ give: string[]; get: string[] } | null>(null);
  const cards = useSets((s) => s.cards);
  const trade = useStore((s) => s.trade);
  const money = useStore((s) => s.currency) ?? playerCurrency();

  useEffect(() => saveTrade(items), [items]);
  // the cards' own data (versions, prices): their set files
  useEffect(() => {
    for (const it of items) if (!cards[it.key]) void loadSet(setIdOfCard(it.key) ?? "").catch(() => {});
  }, [items, cards]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // (even from the search field: Esc closes what is on top)
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (editing) setEditing(null);
      else if (adding) setAdding(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [editing, adding, onClose]);

  const side = (s: Side) => items.filter((it) => it.side === s);
  const total = (s: Side) => side(s).reduce((n, it) => n + (itemValue(it, cards[it.key]) ?? 0), 0);
  const [give, get] = [total("give"), total("get")];
  const v = verdictOf(give, get);
  const edited = items.find((it) => it.uid === editing);

  const add = async (s: Side, row: Row, copy?: Copy) => {
    sfx.pop();
    const card = await loadSet(setIdOfCard(row.key) ?? "")
      .then(() => useSets.getState().cards[row.key])
      .catch(() => undefined);
    const it: TradeItem = {
      uid: uid(),
      side: s,
      key: row.key,
      variant: copy?.variant ?? plainFirst(card?.variants ?? []),
      condition: copy?.condition ?? "NM",
      grade: null,
      price: null,
      copyId: copy?.id,
    };
    setItems((x) => [...x, it]);
    setAdding(null);
  };
  const patch = (u: string, p: Partial<TradeItem>) => setItems((x) => x.map((it) => (it.uid === u ? { ...it, ...p } : it)));

  const accept = () => {
    const g = side("give"), r = side("get");
    if (!g.length || !r.length) return sfx.locked();
    sfx.riffle();
    setTimeout(() => sfx.stamp(), 250);
    trade(
      g.map((it) => ({ key: it.key, variant: it.variant, copyId: it.copyId })),
      r.map((it) => ({ key: it.key, variant: it.variant, condition: it.condition })),
    );
    setDone({ give: g.map((it) => cards[it.key]?.name ?? "?"), get: r.map((it) => cards[it.key]?.name ?? "?") });
    setItems([]);
  };

  const verdict =
    v.kind === "empty"
      ? { head: t("Pose des cartes de chaque côté", "Lay cards on each side"), sub: "" }
      : v.kind === "fair"
        ? { head: t("ÉQUITABLE", "FAIR"), sub: Math.abs(v.diff) < 0.5 ? t("pile à l'équilibre", "dead even") : t(`${formatMoney(Math.abs(v.diff))} d'écart`, `${formatMoney(Math.abs(v.diff))} apart`) }
        : v.kind === "win"
          ? { head: t("TU Y GAGNES", "YOU GAIN"), sub: `+${formatMoney(v.diff)}` }
          : { head: t("TU Y PERDS", "YOU LOSE"), sub: `-${formatMoney(-v.diff)}` };

  const zone = (s: Side) => (
    <section className={`${styles.zone} ${s === "give" ? styles.give : styles.get}`}>
      <header>
        <span className={styles.lab}>{s === "give" ? t("🫴 JE DONNE", "🫴 I GIVE") : t("🤲 JE REÇOIS", "🤲 I GET")}</span>
        <span className={styles.sum}>{formatMoney(s === "give" ? give : get)}</span>
      </header>
      <div className={styles.lay}>
        <AnimatePresence initial={false}>
          {side(s).map((it, i) => {
            const card = cards[it.key];
            const value = itemValue(it, card);
            return (
              <motion.button
                key={it.uid}
                layout
                className={styles.card}
                style={{ rotate: `${[-3, 2, -1, 3, -2][i % 5]}deg` }}
                initial={{ opacity: 0, y: s === "give" ? -60 : 60, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.4 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => (sfx.click(), setEditing(it.uid))}
                onPointerEnter={sfx.hover}
              >
                {card?.img ? <img src={`${card.img}/low.webp`} alt={card.name} draggable={false} /> : <CardBack />}
                {it.copyId && <span className={styles.mine}>{t("À TOI", "YOURS")}</span>}
                {(it.grade || it.condition !== "NM") && <span className={styles.badge}>{it.grade ?? it.condition}</span>}
                <span className={styles.price}>{value == null ? (it.grade ? t("prix ?", "price?") : "—") : formatMoney(value)}</span>
              </motion.button>
            );
          })}
        </AnimatePresence>
        <button className={styles.add} onClick={() => (sfx.pop(), setAdding(s))} onPointerEnter={sfx.hover} aria-label={t("Ajouter une carte", "Add a card")}>
          <i>+</i>
          {side(s).length ? "" : t("CARTE", "CARD")}
        </button>
      </div>
    </section>
  );

  return (
    <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <motion.div
        className={styles.shell}
        initial={{ scale: 0.85, y: 40, rotate: -2 }}
        animate={{ scale: 1, y: 0, rotate: 0 }}
        exit={{ scale: 0.85, y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
      >
        <header className={styles.top}>
          <span className={styles.title}>⇄ {t("ÉCHANGE", "TRADE")}</span>
          {items.length > 0 && (
            <button className={styles.clear} onClick={() => (sfx.remove(), setItems([]))} onPointerEnter={sfx.hover}>
              {t("Vider", "Clear")}
            </button>
          )}
          <button className={styles.close} onClick={onClose} onPointerEnter={sfx.hover}>
            ✕ <span>{t("Ranger", "Put away")}</span>
          </button>
        </header>

        <div className={styles.mat}>
          {zone("give")}
          <div className={`${styles.weigh} ${styles[v.kind]}`}>
            <p className={styles.verdict}>
              {v.kind !== "empty" && <span aria-hidden>⚖ </span>}
              <b>{verdict.head}</b> {verdict.sub && <small>{verdict.sub}</small>}
            </p>
            <div className={styles.gauge} aria-hidden>
              <motion.i className={styles.g} animate={{ width: `${v.share * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 16 }} />
              <motion.i className={styles.r} animate={{ left: `${v.share * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 16 }} />
              <span className={styles.mid} />
              <motion.span className={styles.knob} animate={{ left: `${v.share * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 12 }} />
            </div>
          </div>
          {zone("get")}
        </div>

        <button className={styles.accept} disabled={!side("give").length || !side("get").length} onClick={accept} onPointerEnter={sfx.hover}>
          ✓ {t("Échange accepté", "Trade done")}
        </button>
      </motion.div>

      <AnimatePresence>
        {adding && <AddSheet key="add" side={adding} money={money} onPick={(row, copy) => void add(adding, row, copy)} onClose={() => setAdding(null)} />}
        {edited && (
          <EditSheet
            key="edit"
            item={edited}
            card={cards[edited.key]}
            onChange={(p) => patch(edited.uid, p)}
            onRemove={() => {
              sfx.remove();
              setItems((x) => x.filter((it) => it.uid !== edited.uid));
              setEditing(null);
            }}
            onClose={() => setEditing(null)}
          />
        )}
        {done && <Done key="done" give={done.give} get={done.get} onEnd={() => setDone(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}

/** Adding a card: from the player's own cards (with their version and condition), or any card of the indexes. */
function AddSheet({ side, money, onPick, onClose }: { side: Side; money: "EUR" | "USD"; onPick: (row: Row, copy?: Copy) => void; onClose: () => void }) {
  const t = useT();
  const site = useLang();
  const collection = useStore((s) => s.collection);
  const indexes = useSets((s) => s.index);
  // the index keeps the scans' addresses short: their common start is apart
  const assets = useSets((s) => s.assets);
  const scan = (img: string) => `${img.startsWith("http") ? "" : assets}${img}/low.webp`;
  const [tab, setTab] = useState<"mine" | "all">(side === "give" ? "mine" : "all");
  const [langs, setLangs] = useState<CardLang[]>([site]);
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const input = useRef<HTMLInputElement>(null);
  const owned = useMemo(() => [...new Set(Object.keys(collection).map(langOfKey))], [collection]);
  const need = tab === "mine" ? owned : langs;
  useEffect(() => {
    for (const l of need) void loadIndex(l).catch(() => {});
  }, [need]);
  useEffect(() => {
    if (matchMedia("(pointer: fine)").matches) input.current?.focus();
  }, [tab]);

  const rows = useMemo(() => {
    const all = need.flatMap((l) => (indexes[l] ? rowsOf(indexes[l]) : []));
    const pool = tab === "mine" ? all.filter((r) => collection[r.key]?.length) : all;
    const m = matcher(dq);
    const hit = m ? pool.filter(m) : pool;
    const price = (r: Row) => (r.trend == null ? -1 : convert(r.trend, currencyOf(r.lang), money));
    return hit.sort((a, b) => (dq.trim() ? relevance(a, dq) - relevance(b, dq) : 0) || price(b) - price(a)).slice(0, 40);
  }, [need, indexes, tab, collection, dq, money]);
  const loading = need.some((l) => !indexes[l]);

  return (
    <Sheet onClose={onClose}>
      <div className={styles.tabs}>
        <button className={tab === "mine" ? styles.on : ""} onClick={() => (sfx.click(), setTab("mine"))}>
          {t("MA COLLEC", "MY CARDS")}
        </button>
        <button className={tab === "all" ? styles.on : ""} onClick={() => (sfx.click(), setTab("all"))}>
          {t("TOUTES", "ALL")}
        </button>
      </div>
      <div className={styles.searchRow}>
        <input
          ref={input}
          className={styles.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("nom, numéro… (ex : lucario 179)", "name, number… (e.g. lucario 179)")}
          aria-label={t("Rechercher une carte", "Search a card")}
        />
        {tab === "all" && (
          <span className={styles.langs}>
            {CARD_LANGS.map((l) => (
              <button
                key={l}
                className={langs.includes(l) ? styles.on : ""}
                onClick={() => {
                  sfx.stamp();
                  setLangs((x) => (x.includes(l) ? (x.length > 1 ? x.filter((y) => y !== l) : x) : [...x, l]));
                }}
              >
                {langLabel(l, site)}
              </button>
            ))}
          </span>
        )}
      </div>
      <div className={styles.results}>
        {loading && !rows.length ? (
          <p className={styles.empty}>{t("Chargement…", "Loading…")}</p>
        ) : !rows.length ? (
          <p className={styles.empty}>{tab === "mine" ? t("Aucune de tes cartes ne correspond.", "None of your cards match.") : t("Aucune carte trouvée.", "No card found.")}</p>
        ) : (
          rows.map((r) => {
            const copies = collection[r.key];
            const copy = copies?.find((c) => !c.at) ?? copies?.[0];
            return (
              <button key={r.key} className={styles.res} onClick={() => onPick(r, tab === "mine" ? copy : undefined)} onPointerEnter={sfx.hover}>
                {r.img ? <img src={scan(r.img)} alt="" loading="lazy" /> : <span className={styles.noimg} />}
                <span className={styles.resTxt}>
                  {r.name}
                  <small>
                    {r.set?.name ?? ""} · {r.num}
                    {r.lang !== site ? ` · ${langLabel(r.lang, site)}` : ""}
                    {copies?.length ? ` · ×${copies.reduce((n, c) => n + c.qty, 0)} ${t("à toi", "yours")}` : ""}
                  </small>
                </span>
                <b>{r.trend == null ? "—" : formatMoney(convert(r.trend, currencyOf(r.lang), money))}</b>
                <i className={styles.plus}>+</i>
              </button>
            );
          })
        )}
      </div>
    </Sheet>
  );
}

/** A card on the mat: its version, condition (an estimated discount) or grade (a price typed in), or out of the trade. */
function EditSheet({ item, card, onChange, onRemove, onClose }: { item: TradeItem; card: CardData | undefined; onChange: (p: Partial<TradeItem>) => void; onRemove: () => void; onClose: () => void }) {
  const t = useT();
  const value = itemValue(item, card);
  return (
    <Sheet onClose={onClose}>
      <div className={styles.edit}>
        <div className={styles.editCard}>{card?.img ? <img src={`${card.img}/high.webp`} alt={card.name} /> : <CardBack />}</div>
        <div className={styles.editOpts}>
          <h3>{card?.name ?? "…"}</h3>
          {card && card.variants.length > 1 && (
            <>
              <p className={styles.lbl}>{t("VERSION", "VERSION")}</p>
              <div className={styles.seg}>
                {card.variants.map((v) => (
                  <button key={v} className={item.variant === v ? styles.on : ""} onClick={() => (sfx.click(), onChange({ variant: v }))}>
                    {variantLabel(v)}
                  </button>
                ))}
              </div>
            </>
          )}
          <p className={styles.lbl}>{t("ÉTAT", "CONDITION")}</p>
          <div className={styles.seg}>
            {CONDITIONS.map((c) => (
              <button key={c} className={!item.grade && item.condition === c ? styles.on : ""} onClick={() => (sfx.click(), onChange({ condition: c, grade: null }))}>
                {c}
                {CONDITION_RATE[c] < 1 && <small> -{Math.round((1 - CONDITION_RATE[c]) * 100)}%</small>}
              </button>
            ))}
          </div>
          <p className={styles.lbl}>{t("GRADÉE", "GRADED")}</p>
          <div className={styles.seg}>
            {GRADES.map((g) => (
              <button key={g} className={item.grade === g ? styles.on : ""} onClick={() => (sfx.stamp(), onChange({ grade: item.grade === g ? null : g }))}>
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.kept}>
        {item.grade ? (
          <label>
            <span>{t(`prix convenu pour la ${item.grade}`, `agreed price for the ${item.grade}`)}</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={item.price ?? ""}
              placeholder="0"
              onChange={(e) => onChange({ price: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
            />
          </label>
        ) : (
          <>
            <span>
              {t("prix retenu", "price used")}
              {item.condition !== "NM" && item.condition !== "MT" ? <em> · {t("estimé", "estimate")}</em> : null}
            </span>
            <b>{value == null ? "—" : formatMoney(value)}</b>
          </>
        )}
      </div>
      <div className={styles.editBtns}>
        <button className={styles.remove} onClick={onRemove}>
          {t("Retirer", "Remove")}
        </button>
        <button className={styles.ok} onClick={() => (sfx.pop(), onClose())}>
          ✓ OK
        </button>
      </div>
    </Sheet>
  );
}

/** A sheet coming up from the bottom (a phone), a card in the middle (a computer) */
function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className={styles.sheetWrap} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div className={styles.sheet} initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 500 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
        <span className={styles.grip} aria-hidden />
        {children}
      </motion.div>
    </motion.div>
  );
}

/** « Échange accepté »: what leaves the collection, what comes in, then the empty mat */
function Done({ give, get, onEnd }: { give: string[]; get: string[]; onEnd: () => void }) {
  const t = useT();
  useEffect(() => {
    const id = setTimeout(onEnd, 2600);
    return () => clearTimeout(id);
  }, [onEnd]);
  const lines = [...give.map((n) => ({ n, out: true })), ...get.map((n) => ({ n, out: false }))];
  return (
    <motion.div className={styles.done} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onEnd}>
      <motion.p className={styles.doneHead} initial={{ scale: 2.4, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: -3, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}>
        ✓ {t("ÉCHANGE ACCEPTÉ", "TRADE DONE")}
      </motion.p>
      {lines.map((l, i) => (
        <motion.p
          key={i}
          className={l.out ? styles.out : styles.in}
          initial={{ opacity: 0, x: l.out ? 0 : -40, y: l.out ? 0 : 10 }}
          animate={l.out ? { opacity: [0, 1, 1, 0], y: [0, 0, -10, -40] } : { opacity: 1, x: 0, y: 0 }}
          transition={{ delay: 0.35 + i * 0.18, duration: l.out ? 1.6 : 0.4 }}
        >
          {l.out ? "−" : "+"} {l.n}
        </motion.p>
      ))}
      <motion.p className={styles.doneSub} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + lines.length * 0.18 }}>
        {t("Ta collection est à jour.", "Your collection is up to date.")}
      </motion.p>
    </motion.div>
  );
}
