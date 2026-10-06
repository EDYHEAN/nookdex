"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_BINDERS, pocketsOf, shelfBinders } from "@/lib/binders";
import { catalogSet, loadSets, neededSets, setIdOfCard, useSets } from "@/lib/catalog";
import { resolveConflict, signIn, signInWithGoogle, signOut, useCloud } from "@/lib/cloud";
import { variantLabel, copiesTotals, formatMoney, formatPrice, playerCurrency, priceOf, setStats, unitPrice } from "@/lib/price";
import { OS_NAME, SITE_NAME } from "@/lib/site";
import { sfx } from "@/lib/sound";
import { isBackup, makeBackup, useStore } from "@/lib/store";
import type { CardData, CatalogSet, Copy, SetData } from "@/lib/types";
import { useTotals } from "@/lib/useTotals";
import { CardBack } from "../binder/CardBack";
import styles from "./Computer.module.css";
import { langLabel, langOfKey } from "@/lib/cardLang";
import { LANG_COOKIE, currentLang, useLang, useT } from "@/lib/lang";

type Tab = "home" | "wish" | "dupes" | "search" | "save";

const TABS: { id: Tab; label: [string, string]; hint: [string, string] }[] = [
  { id: "home", label: ["Accueil", "Home"], hint: ["ta collec en un coup d'œil", "your collection at a glance"] },
  { id: "wish", label: ["Wishlist", "Wishlist"], hint: ["les cartes qui te manquent", "the cards you're missing"] },
  { id: "dupes", label: ["Doublons", "Duplicates"], hint: ["ce que tu peux échanger", "what you can trade"] },
  { id: "search", label: ["Recherche", "Search"], hint: ["trouver une carte", "find a card"] },
  { id: "save", label: ["Sauvegarde", "Save"], hint: ["compte / exporter", "account / export"] },
];

interface Props {
  /** Where the monitor is on screen, to zoom out of it. */
  origin: { x: number; y: number };
  onClose: () => void;
  onGoToCard: (cardId: string) => void;
}

interface Entry {
  card: CardData;
  set: SetData;
  copies: Copy[] | undefined;
  /** part of a set binder (counts in the wishlist) */
  tracked: boolean;
}

const cardLabel = (e: Entry) => (/^\d+$/.test(e.card.num) && e.set.official ? `${e.card.num}/${e.set.official}` : e.card.num);
/** " [EN]" after a card that isn't in the site's language: a shared list says which print is wanted */
const langNote = (e: Entry) => {
  const l = langOfKey(e.card.id);
  return l !== currentLang() ? ` [${langLabel(l, currentLang())}]` : "";
};

export function Computer({ origin, onClose, onGoToCard }: Props) {
  const tr = useT();
  const collection = useStore((s) => s.collection);
  const binders = useStore((s) => s.binders);
  const sets = useSets((s) => s.sets);
  const cards = useSets((s) => s.cards);
  const [tab, setTab] = useState<Tab>("home");
  const [toast, setToast] = useState<string | null>(null);

  // Every card of the set binders, plus every card owned elsewhere (free binders).
  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    const seen = new Set<string>();
    for (const b of binders) {
      const set = b.kind === "set" ? sets[b.setId] : undefined;
      set?.cards.forEach((card) => {
        seen.add(card.id);
        out.push({ card, set, copies: collection[card.id], tracked: true });
      });
    }
    for (const [id, copies] of Object.entries(collection)) {
      const set = sets[setIdOfCard(id) ?? ""];
      if (seen.has(id) || !cards[id] || !set) continue;
      out.push({ card: cards[id], set, copies, tracked: false });
    }
    return out;
  }, [binders, sets, cards, collection]);

  const say = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 1800);
  };
  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      sfx.pop();
      say(msg);
    } catch {
      sfx.locked();
      say(tr("copie impossible", "couldn't copy"));
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") {
        if (e.key === "Escape") (e.target as HTMLInputElement).blur();
        return;
      }
      if (e.key === "Escape") onClose();
      const n = Number(e.key);
      if (n >= 1 && n <= TABS.length) {
        // keep the digit out of the search field that gets focused next
        e.preventDefault();
        sfx.click();
        setTab(TABS[n - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className={styles.overlay}
      data-tour="os"
      style={{ transformOrigin: `${origin.x}px ${origin.y}px` }}
      initial={{ scale: 0.14, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.14, opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.bezel}>
        <div className={styles.screen} role="application" aria-label={OS_NAME}>
          <div className={styles.boot}>
            <header className={styles.top}>
              <span className={styles.brand}>{OS_NAME}</span>
              <span className={styles.path}>C:\COLLEC\{tr(...TABS.find((t) => t.id === tab)!.label).toUpperCase()}&gt;</span>
              <Clock />
              <button className={styles.quit} onClick={onClose} onPointerEnter={sfx.hover} data-tour="quit-os">
                {tr("Quitter", "Quit")} <kbd>{tr("Échap", "Esc")}</kbd>
              </button>
            </header>

            <div className={styles.body}>
              <nav className={styles.tabs} role="tablist" aria-orientation="vertical">
                {TABS.map((t, i) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    data-tour={`tab-${t.id}`}
                    className={`${styles.tab} ${tab === t.id ? styles.tabOn : ""}`}
                    onClick={() => {
                      sfx.click();
                      setTab(t.id);
                    }}
                    onPointerEnter={sfx.hover}
                  >
                    <kbd>{i + 1}</kbd>
                    <span>
                      {tr(...t.label)}
                      <small>{tr(...t.hint)}</small>
                    </span>
                  </button>
                ))}
              </nav>

              <main key={tab} className={styles.panel} role="tabpanel">
                {tab === "home" && <Home entries={entries} onGo={onGoToCard} />}
                {tab === "wish" && <Wishlist entries={entries} onGo={onGoToCard} onCopy={copy} />}
                {tab === "dupes" && <Dupes entries={entries} onGo={onGoToCard} onCopy={copy} />}
                {tab === "search" && <Search entries={entries} onGo={onGoToCard} />}
                {tab === "save" && <Save say={say} />}
              </main>
            </div>
          </div>
          <div className={styles.scan} aria-hidden />
          {toast && <div className={styles.toast}>{toast}</div>}
        </div>
      </div>
    </motion.div>
  );
}

function Clock() {
  const tr = useT();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);
  return <span className={styles.clock}>{now.toLocaleTimeString(tr("fr-FR", "en-GB"), { hour: "2-digit", minute: "2-digit" })}</span>;
}

/* ------------------------------------------------------------------ */

function Home({ entries, onGo }: { entries: Entry[]; onGo: (id: string) => void }) {
  const tr = useT();
  const collection = useStore((s) => s.collection);
  const userBinders = useStore((s) => s.binders);
  const profile = useStore((s) => s.profile);
  const sets = useSets((s) => s.sets);
  const cards = useSets((s) => s.cards);
  const t = useTotals();
  const rows = shelfBinders(userBinders).map((b) => {
    const set = b.setId ? sets[b.setId] : undefined;
    if (set) {
      const s = setStats(set, collection);
      return { b, pct: s.total ? s.owned / s.total : 0, count: `${s.owned}/${s.total}`, trend: s.trend };
    }
    const items = [...pocketsOf(b.id, collection).values()].flatMap(({ cardId, copy }) =>
      cards[cardId] ? [{ card: cards[cardId], copies: [copy] }] : [],
    );
    const s = copiesTotals(items);
    return { b, pct: null, count: `${s.cards} ${tr("carte", "card")}${s.cards > 1 ? "s" : ""}`, trend: s.trend };
  });
  const gain = t.spentTrend - t.spent;
  // Set binders taken off the shelf keep their cards (owned, counted in the value): shown here, to put back or delete
  const offShelf = useMemo(() => {
    const onShelf = new Set(userBinders.flatMap((b) => (b.kind === "set" ? [b.setId] : [])));
    const bySet = new Map<string, { ids: string[]; items: { card: CardData; copies: Copy[] }[] }>();
    for (const [id, copies] of Object.entries(collection)) {
      const loose = copies.filter((c) => !c.at);
      const setId = setIdOfCard(id);
      if (!loose.length || !setId || onShelf.has(setId)) continue;
      const g = bySet.get(setId) ?? { ids: [], items: [] };
      g.ids.push(id);
      if (cards[id]) g.items.push({ card: cards[id], copies: loose });
      bySet.set(setId, g);
    }
    return [...bySet].map(([setId, g]) => ({ setId, set: catalogSet(setId), ids: g.ids, trend: copiesTotals(g.items).trend }));
  }, [collection, userBinders, cards]);
  const recent = entries
    .flatMap((e) => (e.copies ?? []).map((c) => ({ e, c })))
    .sort((a, b) => b.c.addedAt - a.c.addedAt)
    .slice(0, 6);

  return (
    <div className={styles.home}>
      <div className={styles.tiles}>
        {t.total ? (
          <Tile
            label={tr("Cartes", "Cards")}
            value={`${t.owned}/${t.total}`}
            sub={`${Math.round((t.owned / t.total) * 100)}% · ${tr("il en manque", "missing")} ${t.total - t.owned}`}
            big
          />
        ) : (
          <Tile label={tr("Cartes", "Cards")} value={String(t.cards)} sub={`${t.copies} ${tr("exemplaires", "copies")}`} big />
        )}
        <Tile label={tr("Valeur (tendance)", "Value (trend)")} value={formatMoney(t.trend)} sub={`${tr("prix bas", "low")} ${formatMoney(t.low)}`} accent="yellow" />
        <Tile label={tr("Dépensé", "Spent")} value={formatMoney(t.spent)} sub={tr("sur les cartes avec un prix d'achat", "on cards with a purchase price")} />
        <Tile
          label={tr("Plus-value", "Gain")}
          value={`${gain >= 0 ? "+" : ""}${formatMoney(gain)}`}
          sub={tr("tendance − prix payé", "trend − price paid")}
          accent={gain >= 0 ? "green" : "red"}
        />
      </div>

      <section>
        <h2>{profile ? tr(`Classeurs de ${profile.name}`, `${profile.name}'s binders`) : tr("Classeurs", "Binders")}</h2>
        {rows.map(({ b, pct, count, trend }) => (
          <div key={b.id} className={styles.setRow}>
            {b.logo ? <img src={`${b.logo}.png`} alt="" /> : <span className={styles.freeIcon}>✎</span>}
            <span className={styles.setName}>
              {b.name}
              {b.lang && b.lang !== currentLang() && <small className={styles.langTag}>{langLabel(b.lang, currentLang())}</small>}
            </span>
            {pct != null ? (
              <span className={styles.bar} aria-label={count}>
                <span style={{ width: `${pct * 100}%` }} />
              </span>
            ) : (
              <span className={styles.freeTag}>{tr("classeur libre", "free binder")}</span>
            )}
            <span className={styles.num}>{count}</span>
            <span className={styles.money}>{formatMoney(trend)}</span>
          </div>
        ))}
        {!rows.length && <p className={styles.muted}>{tr("Aucun classeur : clique sur le + de l'étagère.", "No binder: click the + on the shelf.")}</p>}
        {offShelf.map((o) => (
          <OffShelfRow key={o.setId} {...o} shelfFull={userBinders.length >= MAX_BINDERS} />
        ))}
      </section>

      <section>
        <h2>{tr("Derniers ajouts", "Latest additions")}</h2>
        {recent.length === 0 && <p className={styles.muted}>{tr("Rien pour l'instant : ouvre un classeur et clique sur une carte grise.", "Nothing yet: open a binder and click a grey card.")}</p>}
        <div className={styles.recent}>
          {recent.map(({ e, c }) => (
            <button key={c.id} className={styles.recentCard} onClick={() => onGo(e.card.id)} onPointerEnter={sfx.hover}>
              {e.card.img ? <img src={`${e.card.img}/low.webp`} alt="" loading="lazy" /> : <span className={styles.recentBack}><CardBack label={false} /></span>}
              <span>{e.card.name}</span>
              <small>{new Date(c.addedAt).toLocaleDateString(tr("fr-FR", "en-GB"))}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/** A set binder taken off the shelf whose cards are still owned: put the binder back, or delete those cards. */
function OffShelfRow({ setId, set, ids, trend, shelfFull }: { setId: string; set: CatalogSet | undefined; ids: string[]; trend: number; shelfFull: boolean }) {
  const tr = useT();
  const [arming, setArming] = useState(false);
  useEffect(() => {
    if (!arming) return;
    const t = setTimeout(() => setArming(false), 3000);
    return () => clearTimeout(t);
  }, [arming]);
  const n = ids.length;
  const lang = langOfKey(setId);
  return (
    <div className={styles.setRow}>
      {set?.logo ? <img src={`${set.logo}.png`} alt="" /> : <span className={styles.freeIcon}>?</span>}
      <span className={styles.setName}>
        {set?.name ?? setId}
        {lang !== currentLang() && <small className={styles.langTag}>{langLabel(lang, currentLang())}</small>}
        <span className={styles.offActions}>
          <button
            className={styles.btn}
            disabled={shelfFull}
            title={shelfFull ? tr("L'étagère est pleine", "The shelf is full") : undefined}
            onClick={() => {
              sfx.stamp();
              useStore.getState().addBinder({ kind: "set", setId });
            }}
          >
            {tr("Remettre sur l'étagère", "Put back on the shelf")}
          </button>
          <button
            className={`${styles.btn} ${arming ? styles.btnDanger : ""}`}
            onClick={() => {
              if (!arming) {
                sfx.click();
                setArming(true);
                return;
              }
              sfx.locked();
              useStore.getState().removeLooseCopies(ids);
            }}
          >
            {arming
              ? tr(`Sûr ? supprimer ${n} carte${n > 1 ? "s" : ""}`, `Sure? delete ${n} card${n > 1 ? "s" : ""}`)
              : tr("Supprimer ces cartes", "Delete these cards")}
          </button>
        </span>
      </span>
      <span className={styles.freeTag}>{tr("hors étagère", "off the shelf")}</span>
      <span className={styles.num}>
        {n} {tr("carte", "card")}
        {n > 1 ? "s" : ""}
      </span>
      <span className={styles.money}>{formatMoney(trend)}</span>
    </div>
  );
}

function Tile({ label, value, sub, accent, big }: { label: string; value: string; sub: string; accent?: "yellow" | "green" | "red"; big?: boolean }) {
  return (
    <div className={`${styles.tile} ${big ? styles.tileBig : ""} ${accent ? styles[accent] : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
      <small>{sub}</small>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CardRow({ e, right, onGo, extra }: { e: Entry; right: string; onGo: (id: string) => void; extra?: string }) {
  return (
    <button className={styles.row} onClick={() => onGo(e.card.id)} onPointerEnter={sfx.hover}>
      {e.card.img ? <img src={`${e.card.img}/low.webp`} alt="" loading="lazy" /> : <span className={styles.rowBack}><CardBack label={false} /></span>}
      <span className={styles.rowNum}>{cardLabel(e)}</span>
      <span className={styles.rowName}>
        {e.card.name}
        <small>{extra ?? e.card.rarity}</small>
      </span>
      <span className={styles.rowRight}>{right}</span>
      <span className={styles.go} aria-hidden>
        ▶
      </span>
    </button>
  );
}

function Wishlist({ entries, onGo, onCopy }: { entries: Entry[]; onGo: (id: string) => void; onCopy: (t: string, m: string) => void }) {
  const tr = useT();
  const [sort, setSort] = useState<"price" | "num">("price");
  const missing = entries.filter((e) => e.tracked && !e.copies?.length);
  const price = (e: Entry) => unitPrice(e.card, e.card.variants[0], "trend");
  const list = sort === "price" ? [...missing].sort((a, b) => price(b) - price(a)) : missing;
  const total = missing.reduce((n, e) => n + price(e), 0);

  const text = () =>
    [tr(`Je recherche (${missing.length} cartes) :`, `Looking for (${missing.length} cards):`), ...list.map((e) => `- ${e.set.name} ${cardLabel(e)} ${e.card.name}${langNote(e)}`)].join("\n");

  return (
    <div className={styles.listTab}>
      <div className={styles.toolbar}>
        <p>
          <b>{missing.length}</b> {tr("cartes manquantes · compléter ≈", "missing cards · to complete ≈")} <b className={styles.money}>{formatMoney(total)}</b>
        </p>
        <div className={styles.actions}>
          <button
            className={styles.btn}
            onClick={() => {
              sfx.click();
              setSort(sort === "price" ? "num" : "price");
            }}
          >
            {tr("Tri :", "Sort:")} {sort === "price" ? tr("prix ↓", "price ↓") : tr("numéro", "number")}
          </button>
          <button className={styles.btn} onClick={() => onCopy(text(), tr("liste copiée ! colle-la à tes traders", "list copied! paste it to your traders"))} disabled={!missing.length}>
            {tr("Copier la liste", "Copy the list")}
          </button>
        </div>
      </div>
      {missing.length === 0 && <p className={styles.win}>{tr("★ MASTER SET COMPLET ★", "★ MASTER SET COMPLETE ★")}</p>}
      <div className={styles.rows}>
        {list.map((e) => (
          <CardRow key={e.card.id} e={e} right={formatPrice(priceOf(e.card, e.card.variants[0], "trend"))} onGo={onGo} />
        ))}
      </div>
    </div>
  );
}

function Dupes({ entries, onGo, onCopy }: { entries: Entry[]; onGo: (id: string) => void; onCopy: (t: string, m: string) => void }) {
  const tr = useT();
  const dupes = entries
    .map((e) => {
      const qty = e.copies?.reduce((n, c) => n + c.qty, 0) ?? 0;
      return { e, extra: qty - 1 };
    })
    .filter((d) => d.extra > 0);
  const value = dupes.reduce((n, d) => n + d.extra * unitPrice(d.e.card, d.e.card.variants[0], "trend"), 0);
  const detail = (e: Entry) =>
    (e.copies ?? []).map((c) => `${c.qty}× ${variantLabel(c.variant)} ${c.condition}`).join(" · ");
  const text = () =>
    [tr(`À échanger (${dupes.length} cartes) :`, `For trade (${dupes.length} cards):`), ...dupes.map((d) => `- ${d.e.set.name} ${cardLabel(d.e)} ${d.e.card.name}${langNote(d.e)} ×${d.extra} (${detail(d.e)})`)].join(
      "\n",
    );

  return (
    <div className={styles.listTab}>
      <div className={styles.toolbar}>
        <p>
          <b>{dupes.length}</b> {tr("cartes en double · valeur des doubles ≈", "duplicate cards · duplicates worth ≈")} <b className={styles.money}>{formatMoney(value)}</b>
        </p>
        <div className={styles.actions}>
          <button className={styles.btn} onClick={() => onCopy(text(), tr("doublons copiés !", "duplicates copied!"))} disabled={!dupes.length}>
            {tr("Copier la liste", "Copy the list")}
          </button>
        </div>
      </div>
      {dupes.length === 0 && (
        <p className={styles.muted}>
          {tr("Pas encore de doubles. Dans la fiche d'une carte, le bouton + augmente la quantité.", "No duplicates yet. On a card's sheet, the + button raises the quantity.")}
        </p>
      )}
      <div className={styles.rows}>
        {dupes.map(({ e, extra }) => (
          <CardRow key={e.card.id} e={e} right={`×${extra}`} extra={detail(e)} onGo={onGo} />
        ))}
      </div>
    </div>
  );
}

function Search({ entries, onGo }: { entries: Entry[]; onGo: (id: string) => void }) {
  const tr = useT();
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const nq = norm(q.trim());
  const results = nq ? entries.filter((e) => norm(e.card.name).includes(nq) || norm(e.card.aka ?? "").includes(nq) || e.card.num.toLowerCase().replace(/^0+/, "") === nq.replace(/^0+/, "")).slice(0, 60) : [];

  return (
    <div className={styles.listTab}>
      <label className={styles.searchBox}>
        <span>&gt;</span>
        <input
          ref={input}
          value={q}
          placeholder={tr("nom ou numéro (ex : lugia, 186, TG20)", "name or number (e.g. lugia, 186, TG20)")}
          onChange={(e) => {
            setQ(e.target.value);
            sfx.hover();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) onGo(results[0].card.id);
          }}
          aria-label={tr("Rechercher une carte", "Search a card")}
        />
      </label>
      {nq && <p className={styles.muted}>{results.length} {tr("résultat", "result")}
          {results.length > 1 ? "s" : ""} · {tr("Entrée = ouvrir le premier", "Enter = open the first")}</p>}
      <div className={styles.rows}>
        {results.map((e) => (
          <CardRow
            key={e.card.id}
            e={e}
            right={e.copies?.length ? tr("✓ possédée", "✓ owned") : formatPrice(priceOf(e.card, e.card.variants[0], "trend"))}
            onGo={onGo}
          />
        ))}
      </div>
    </div>
  );
}

function Save({ say }: { say: (m: string) => void }) {
  const tr = useT();
  const email = useCloud((c) => c.email);
  const collection = useStore((s) => s.collection);
  const profile = useStore((s) => s.profile);
  const importBackup = useStore((s) => s.importBackup);
  const resetCollection = useStore((s) => s.resetCollection);
  const file = useRef<HTMLInputElement>(null);
  const [arming, setArming] = useState(false);
  const cards = Object.keys(collection).length;
  const copies = Object.values(collection).reduce((n, cs) => n + cs.reduce((m, c) => m + c.qty, 0), 0);

  const exportFile = () => {
    const blob = new Blob([JSON.stringify(makeBackup(useStore.getState()), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${SITE_NAME.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    sfx.pop();
    say(tr("sauvegarde téléchargée !", "save downloaded!"));
  };

  const importFile = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      if (!isBackup(data)) throw new Error("bad file");
      importBackup(data);
      const s = useStore.getState();
      await loadSets(neededSets(s.binders, s.collection));
      sfx.add(0, "rare");
      say(tr(`${Object.keys(data.collection).length} cartes importées !`, `${Object.keys(data.collection).length} cards imported!`));
    } catch {
      sfx.locked();
      say(tr("fichier illisible", "unreadable file"));
    }
  };

  return (
    <div className={styles.save}>
      <Account say={say} />
      <LangSwitch />
      <CurrencySwitch say={say} />
      {tr(
        <p>
          {profile && (
            <>
              Joueur <b>{profile.name}</b>.{" "}
            </>
          )}
          Ta collection (<b>{cards}</b> cartes, <b>{copies}</b> exemplaires){" "}
          {email ? (
            <>est sauvegardée sur ton compte. Tu peux aussi en garder une copie en fichier.</>
          ) : (
            <>
              est enregistrée <b>uniquement dans ce navigateur</b>. Sans compte, exporte-la de temps en temps : si tu vides les données du site,
              elle part avec.
            </>
          )}
        </p>,
        <p>
          {profile && (
            <>
              Player <b>{profile.name}</b>.{" "}
            </>
          )}
          Your collection (<b>{cards}</b> cards, <b>{copies}</b> copies){" "}
          {email ? (
            <>is saved on your account. You can also keep a copy as a file.</>
          ) : (
            <>
              is stored <b>in this browser only</b>. Without an account, export it now and then: if you clear the site&apos;s data, it goes
              with it.
            </>
          )}
        </p>,
      )}
      <div className={styles.saveActions}>
        <button className={styles.btnBig} onClick={exportFile}>
          {tr("⬇ Exporter la collection", "⬇ Export the collection")}
        </button>
        <button
          className={styles.btnBig}
          onClick={() => {
            sfx.click();
            file.current?.click();
          }}
        >
          {tr("⬆ Importer une sauvegarde", "⬆ Import a save")}
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = "";
          }}
        />
      </div>
      <div className={styles.danger}>
        <p>{tr("Zone rouge", "Danger zone")}</p>
        {arming ? (
          <div className={styles.saveActions}>
            <button
              className={`${styles.btnBig} ${styles.btnDanger}`}
              onClick={() => {
                sfx.remove();
                resetCollection();
                setArming(false);
                say(tr("collection remise à zéro", "collection reset"));
              }}
            >
              {tr("Oui, tout effacer", "Yes, erase everything")}
            </button>
            <button className={styles.btnBig} onClick={() => setArming(false)}>
              {tr("Non !", "No!")}
            </button>
          </div>
        ) : (
          <button
            className={`${styles.btnBig} ${styles.btnDanger}`}
            onClick={() => {
              sfx.locked();
              setArming(true);
            }}
          >
            {tr("Remettre la collection à zéro…", "Reset the collection…")}
          </button>
        )}
      </div>
    </div>
  );
}

const CLOUD_LABEL = {
  off: ["", ""],
  loading: ["chargement…", "loading…"],
  synced: ["à jour ✓", "up to date ✓"],
  saving: ["enregistrement…", "saving…"],
  error: ["⚠ sauvegarde en ligne impossible", "⚠ online save failed"],
  conflict: ["deux versions différentes", "two different versions"],
} as const;

/**
 * The player's money: purchase prices are typed in it, values and gains are added up in it (each card's own price stays
 * in its market's currency). Switching converts the purchase prices at the rate of the last price update.
 */
function CurrencySwitch({ say }: { say: (m: string) => void }) {
  const tr = useT();
  const currency = useStore((s) => s.currency) ?? playerCurrency();
  return (
    <p className={styles.langRow} role="radiogroup" aria-label={tr("Devise", "Currency")}>
      <span>{tr("Devise", "Currency")}</span>
      {(["EUR", "USD"] as const).map((c) => (
        <button
          key={c}
          role="radio"
          aria-checked={currency === c}
          className={`${styles.btn} ${currency === c ? styles.langOn : ""}`}
          onClick={() => {
            if (currency === c) return;
            sfx.coin();
            useStore.getState().setCurrency(c);
            say(tr("prix d'achat convertis au taux du jour", "purchase prices converted at today's rate"));
          }}
        >
          {c === "EUR" ? "€ euro" : "$ dollar"}
        </button>
      ))}
    </p>
  );
}

/** Language of the site (the page reloads: server pages follow it). Each binder keeps its own card language. */
function LangSwitch() {
  const lang = useLang();
  return (
    <p className={styles.langRow} role="radiogroup" aria-label="Langue / Language">
      <span>Langue · Language</span>
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={lang === l}
          className={`${styles.btn} ${lang === l ? styles.langOn : ""}`}
          onClick={() => {
            if (lang === l) return;
            sfx.click();
            useStore.getState().setLang(l);
            document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
            setTimeout(() => location.reload(), 150);
          }}
        >
          {l === "fr" ? "Français" : "English"}
        </button>
      ))}
    </p>
  );
}

function Account({ say }: { say: (m: string) => void }) {
  const tr = useT();
  const { email, status, conflict, error } = useCloud();
  const [address, setAddress] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const to = address.trim();
    if (!/^\S+@\S+\.\S+$/.test(to)) {
      sfx.locked();
      say(tr("adresse e-mail invalide", "invalid e-mail address"));
      return;
    }
    setBusy(true);
    const error = await signIn(to);
    setBusy(false);
    if (error) {
      sfx.locked();
      say(tr("envoi impossible, réessaie dans un moment", "couldn't send, try again in a moment"));
      console.warn("[cloud] sign in", error);
      return;
    }
    sfx.pop();
    setSent(to);
  };

  if (!email)
    return (
      <div className={styles.account} data-tour="account">
        <p>
          {tr(
            <>
              <b>Compte en ligne</b> : retrouve ta collection sur tous tes appareils.
            </>,
            <>
              <b>Online account</b>: get your collection back on all your devices.
            </>,
          )}
        </p>
        {sent ? (
          <p>
            {tr("Lien de connexion envoyé à", "Sign-in link sent to")} <b>{sent}</b>. {tr("Ouvre-le sur cet appareil.", "Open it on this device.")}{" "}
            <button className={styles.linkBtn} onClick={() => setSent(null)}>
              {tr("changer d'adresse", "use another address")}
            </button>
          </p>
        ) : (
          <form
            className={styles.accountForm}
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label className={styles.searchBox}>
              <span>@</span>
              <input
                type="email"
                value={address}
                placeholder={tr("ton e-mail", "your e-mail")}
                autoComplete="email"
                onChange={(e) => setAddress(e.target.value)}
                aria-label={tr("Adresse e-mail", "E-mail address")}
              />
            </label>
            <button className={styles.btnBig} disabled={busy}>
              {busy ? tr("envoi…", "sending…") : tr("Recevoir un lien", "Get a link")}
            </button>
            <span className={styles.muted}>{tr("ou", "or")}</span>
            <button
              type="button"
              className={styles.btnBig}
              onClick={() => {
                sfx.click();
                void signInWithGoogle().then((error) => {
                  if (!error) return;
                  sfx.locked();
                  say(tr("connexion Google impossible", "Google sign-in failed"));
                  console.warn("[cloud] google", error);
                });
              }}
            >
              G {tr("Continuer avec Google", "Continue with Google")}
            </button>
          </form>
        )}
      </div>
    );

  return (
    <div className={styles.account} data-tour="account">
      <p>
        {tr("Connecté :", "Signed in:")} <b>{email}</b> · <span className={styles.muted}>{tr(CLOUD_LABEL[status][0] as string, CLOUD_LABEL[status][1] as string)}</span>
      </p>
      {status === "error" && (
        <p className={styles.muted}>
          {tr("Ta collec reste dans ce navigateur, on réessaie au prochain changement. Détail :", "Your collection stays in this browser, we'll retry on the next change. Detail:")}{" "}
          {error ?? tr("serveur injoignable", "server unreachable")}
        </p>
      )}
      {status === "conflict" && conflict && (
        <>
          <p>
            {tr("Ce navigateur et ton compte ont chacun changé. Laquelle garder ? En ligne :", "This browser and your account both changed. Which one to keep? Online:")}{" "}
            <b>{Object.keys(conflict.collection).length}</b> {tr("cartes, ici :", "cards, here:")} <b>{Object.keys(useStore.getState().collection).length}</b>{" "}
            {tr("cartes.", "cards.")}
          </p>
          <div className={styles.saveActions}>
            <button className={styles.btnBig} onClick={() => void resolveConflict("cloud").then(() => say(tr("collection en ligne récupérée", "online collection restored")))}>
              {tr("☁ Garder celle en ligne", "☁ Keep the online one")}
            </button>
            <button className={styles.btnBig} onClick={() => void resolveConflict("local").then(() => say(tr("collection envoyée en ligne", "collection sent online")))}>
              {tr("💻 Garder celle d'ici", "💻 Keep this one")}
            </button>
          </div>
        </>
      )}
      <div className={styles.saveActions}>
        <button
          className={styles.btnBig}
          onClick={() => {
            sfx.click();
            void signOut().then(() => say(tr("déconnecté, la collection reste dans ce navigateur", "signed out, the collection stays in this browser")));
          }}
        >
          {tr("Se déconnecter", "Sign out")}
        </button>
      </div>
    </div>
  );
}
