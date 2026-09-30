"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { pocketsOf, shelfBinders } from "@/lib/binders";
import { loadSets, neededSets, setIdOfCard, useSets } from "@/lib/catalog";
import { resolveConflict, signIn, signInWithGoogle, signOut, useCloud } from "@/lib/cloud";
import { VARIANT_LABEL, copiesTotals, formatEur, setStats, unitPrice } from "@/lib/price";
import { OS_NAME, SITE_NAME } from "@/lib/site";
import { sfx } from "@/lib/sound";
import { isBackup, makeBackup, useStore } from "@/lib/store";
import type { CardData, Copy, SetData } from "@/lib/types";
import { useTotals } from "@/lib/useTotals";
import styles from "./Computer.module.css";

export type Tab = "home" | "wish" | "dupes" | "search" | "save";

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "home", label: "Accueil", hint: "ta collec en un coup d'œil" },
  { id: "wish", label: "Wishlist", hint: "les cartes qui te manquent" },
  { id: "dupes", label: "Doublons", hint: "ce que tu peux échanger" },
  { id: "search", label: "Recherche", hint: "trouver une carte" },
  { id: "save", label: "Sauvegarde", hint: "compte / exporter" },
];

interface Props {
  /** Where the monitor is on screen, to zoom out of it. */
  origin: { x: number; y: number };
  onClose: () => void;
  onGoToCard: (cardId: string) => void;
  /** Tab to show (the onboarding tour points at one): follows the prop when it changes. */
  initialTab?: Tab;
}

interface Entry {
  card: CardData;
  set: SetData;
  copies: Copy[] | undefined;
  /** part of a set binder (counts in the wishlist) */
  tracked: boolean;
}

const cardLabel = (e: Entry) => (/^\d+$/.test(e.card.num) && e.set.official ? `${e.card.num}/${e.set.official}` : e.card.num);

export function Computer({ origin, onClose, onGoToCard, initialTab = "home" }: Props) {
  const collection = useStore((s) => s.collection);
  const binders = useStore((s) => s.binders);
  const sets = useSets((s) => s.sets);
  const cards = useSets((s) => s.cards);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [asked, setAsked] = useState(initialTab);
  if (asked !== initialTab) {
    setAsked(initialTab);
    setTab(initialTab);
  }
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
      say("copie impossible");
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
              <span className={styles.path}>C:\COLLEC\{TABS.find((t) => t.id === tab)!.label.toUpperCase()}&gt;</span>
              <Clock />
              <button className={styles.quit} onClick={onClose} onPointerEnter={sfx.hover}>
                Quitter <kbd>Échap</kbd>
              </button>
            </header>

            <div className={styles.body}>
              <nav className={styles.tabs} role="tablist" aria-orientation="vertical">
                {TABS.map((t, i) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    className={`${styles.tab} ${tab === t.id ? styles.tabOn : ""}`}
                    onClick={() => {
                      sfx.click();
                      setTab(t.id);
                    }}
                    onPointerEnter={sfx.hover}
                  >
                    <kbd>{i + 1}</kbd>
                    <span>
                      {t.label}
                      <small>{t.hint}</small>
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
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);
  return <span className={styles.clock}>{now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>;
}

/* ------------------------------------------------------------------ */

function Home({ entries, onGo }: { entries: Entry[]; onGo: (id: string) => void }) {
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
    return { b, pct: null, count: `${s.cards} carte${s.cards > 1 ? "s" : ""}`, trend: s.trend };
  });
  const gain = t.spentTrend - t.spent;
  const recent = entries
    .flatMap((e) => (e.copies ?? []).map((c) => ({ e, c })))
    .sort((a, b) => b.c.addedAt - a.c.addedAt)
    .slice(0, 6);

  return (
    <div className={styles.home}>
      <div className={styles.tiles}>
        {t.total ? (
          <Tile label="Cartes" value={`${t.owned}/${t.total}`} sub={`${Math.round((t.owned / t.total) * 100)}% · il en manque ${t.total - t.owned}`} big />
        ) : (
          <Tile label="Cartes" value={String(t.cards)} sub={`${t.copies} exemplaires`} big />
        )}
        <Tile label="Valeur (tendance)" value={formatEur(t.trend)} sub={`prix bas ${formatEur(t.low)}`} accent="yellow" />
        <Tile label="Dépensé" value={formatEur(t.spent)} sub="sur les cartes avec un prix d'achat" />
        <Tile
          label="Plus-value"
          value={`${gain >= 0 ? "+" : ""}${formatEur(gain)}`}
          sub="tendance − prix payé"
          accent={gain >= 0 ? "green" : "red"}
        />
      </div>

      <section>
        <h2>{profile ? `Classeurs de ${profile.name}` : "Classeurs"}</h2>
        {rows.map(({ b, pct, count, trend }) => (
          <div key={b.id} className={styles.setRow}>
            {b.logo ? <img src={`${b.logo}.png`} alt="" /> : <span className={styles.freeIcon}>✎</span>}
            <span className={styles.setName}>{b.name}</span>
            {pct != null ? (
              <span className={styles.bar} aria-label={count}>
                <span style={{ width: `${pct * 100}%` }} />
              </span>
            ) : (
              <span className={styles.freeTag}>classeur libre</span>
            )}
            <span className={styles.num}>{count}</span>
            <span className={styles.money}>{formatEur(trend)}</span>
          </div>
        ))}
        {!rows.length && <p className={styles.muted}>Aucun classeur : clique sur le + de l&apos;étagère.</p>}
      </section>

      <section>
        <h2>Derniers ajouts</h2>
        {recent.length === 0 && <p className={styles.muted}>Rien pour l&apos;instant : ouvre un classeur et clique sur une carte grise.</p>}
        <div className={styles.recent}>
          {recent.map(({ e, c }) => (
            <button key={c.id} className={styles.recentCard} onClick={() => onGo(e.card.id)} onPointerEnter={sfx.hover}>
              <img src={`${e.card.img}/low.webp`} alt="" loading="lazy" />
              <span>{e.card.name}</span>
              <small>{new Date(c.addedAt).toLocaleDateString("fr-FR")}</small>
            </button>
          ))}
        </div>
      </section>
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
      <img src={`${e.card.img}/low.webp`} alt="" loading="lazy" />
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
  const [sort, setSort] = useState<"price" | "num">("price");
  const missing = entries.filter((e) => e.tracked && !e.copies?.length);
  const price = (e: Entry) => unitPrice(e.card, e.card.variants[0], "trend");
  const list = sort === "price" ? [...missing].sort((a, b) => price(b) - price(a)) : missing;
  const total = missing.reduce((n, e) => n + price(e), 0);

  const text = () =>
    [`Je recherche (${missing.length} cartes) :`, ...list.map((e) => `- ${e.set.name} ${cardLabel(e)} ${e.card.name}`)].join("\n");

  return (
    <div className={styles.listTab}>
      <div className={styles.toolbar}>
        <p>
          <b>{missing.length}</b> cartes manquantes · compléter ≈ <b className={styles.money}>{formatEur(total)}</b>
        </p>
        <div className={styles.actions}>
          <button
            className={styles.btn}
            onClick={() => {
              sfx.click();
              setSort(sort === "price" ? "num" : "price");
            }}
          >
            Tri : {sort === "price" ? "prix ↓" : "numéro"}
          </button>
          <button className={styles.btn} onClick={() => onCopy(text(), "liste copiée ! colle-la à tes traders")} disabled={!missing.length}>
            Copier la liste
          </button>
        </div>
      </div>
      {missing.length === 0 && <p className={styles.win}>★ MASTER SET COMPLET ★</p>}
      <div className={styles.rows}>
        {list.map((e) => (
          <CardRow key={e.card.id} e={e} right={formatEur(price(e))} onGo={onGo} />
        ))}
      </div>
    </div>
  );
}

function Dupes({ entries, onGo, onCopy }: { entries: Entry[]; onGo: (id: string) => void; onCopy: (t: string, m: string) => void }) {
  const dupes = entries
    .map((e) => {
      const qty = e.copies?.reduce((n, c) => n + c.qty, 0) ?? 0;
      return { e, extra: qty - 1 };
    })
    .filter((d) => d.extra > 0);
  const value = dupes.reduce((n, d) => n + d.extra * unitPrice(d.e.card, d.e.card.variants[0], "trend"), 0);
  const detail = (e: Entry) =>
    (e.copies ?? []).map((c) => `${c.qty}× ${VARIANT_LABEL[c.variant]} ${c.condition}`).join(" · ");
  const text = () =>
    [`À échanger (${dupes.length} cartes) :`, ...dupes.map((d) => `- ${d.e.set.name} ${cardLabel(d.e)} ${d.e.card.name} ×${d.extra} (${detail(d.e)})`)].join(
      "\n",
    );

  return (
    <div className={styles.listTab}>
      <div className={styles.toolbar}>
        <p>
          <b>{dupes.length}</b> cartes en double · valeur des doubles ≈ <b className={styles.money}>{formatEur(value)}</b>
        </p>
        <div className={styles.actions}>
          <button className={styles.btn} onClick={() => onCopy(text(), "doublons copiés !")} disabled={!dupes.length}>
            Copier la liste
          </button>
        </div>
      </div>
      {dupes.length === 0 && (
        <p className={styles.muted}>Pas encore de doubles. Dans la fiche d&apos;une carte, le bouton + augmente la quantité.</p>
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
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const nq = norm(q.trim());
  const results = nq ? entries.filter((e) => norm(e.card.name).includes(nq) || e.card.num.toLowerCase().replace(/^0+/, "") === nq.replace(/^0+/, "")).slice(0, 60) : [];

  return (
    <div className={styles.listTab}>
      <label className={styles.searchBox}>
        <span>&gt;</span>
        <input
          ref={input}
          value={q}
          placeholder="nom ou numéro (ex : lugia, 186, TG20)"
          onChange={(e) => {
            setQ(e.target.value);
            sfx.hover();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) onGo(results[0].card.id);
          }}
          aria-label="Rechercher une carte"
        />
      </label>
      {nq && <p className={styles.muted}>{results.length} résultat{results.length > 1 ? "s" : ""} · Entrée = ouvrir le premier</p>}
      <div className={styles.rows}>
        {results.map((e) => (
          <CardRow
            key={e.card.id}
            e={e}
            right={e.copies?.length ? "✓ possédée" : formatEur(unitPrice(e.card, e.card.variants[0], "trend"))}
            onGo={onGo}
          />
        ))}
      </div>
    </div>
  );
}

function Save({ say }: { say: (m: string) => void }) {
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
    say("sauvegarde téléchargée !");
  };

  const importFile = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      if (!isBackup(data)) throw new Error("bad file");
      importBackup(data);
      const s = useStore.getState();
      await loadSets(neededSets(s.binders, s.collection));
      sfx.add(0, "rare");
      say(`${Object.keys(data.collection).length} cartes importées !`);
    } catch {
      sfx.locked();
      say("fichier illisible");
    }
  };

  return (
    <div className={styles.save}>
      <Account say={say} />
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
            est enregistrée <b>uniquement dans ce navigateur</b>. Sans compte, exporte-la de temps en temps : si tu vides les données du site, elle
            part avec.
          </>
        )}
      </p>
      <div className={styles.saveActions}>
        <button className={styles.btnBig} onClick={exportFile}>
          ⬇ Exporter la collection
        </button>
        <button
          className={styles.btnBig}
          onClick={() => {
            sfx.click();
            file.current?.click();
          }}
        >
          ⬆ Importer une sauvegarde
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
        <p>Zone rouge</p>
        {arming ? (
          <div className={styles.saveActions}>
            <button
              className={`${styles.btnBig} ${styles.btnDanger}`}
              onClick={() => {
                sfx.remove();
                resetCollection();
                setArming(false);
                say("collection remise à zéro");
              }}
            >
              Oui, tout effacer
            </button>
            <button className={styles.btnBig} onClick={() => setArming(false)}>
              Non !
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
            Remettre la collection à zéro…
          </button>
        )}
      </div>
    </div>
  );
}

const CLOUD_LABEL = {
  off: "",
  loading: "chargement…",
  synced: "à jour ✓",
  saving: "enregistrement…",
  error: "⚠ sauvegarde en ligne impossible",
  conflict: "deux versions différentes",
} as const;

function Account({ say }: { say: (m: string) => void }) {
  const { email, status, conflict, error } = useCloud();
  const [address, setAddress] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const to = address.trim();
    if (!/^\S+@\S+\.\S+$/.test(to)) {
      sfx.locked();
      say("adresse e-mail invalide");
      return;
    }
    setBusy(true);
    const error = await signIn(to);
    setBusy(false);
    if (error) {
      sfx.locked();
      say("envoi impossible, réessaie dans un moment");
      console.warn("[cloud] sign in", error);
      return;
    }
    sfx.pop();
    setSent(to);
  };

  if (!email)
    return (
      <div className={styles.account}>
        <p>
          <b>Compte en ligne</b> : retrouve ta collection sur tous tes appareils.
        </p>
        {sent ? (
          <p>
            Lien de connexion envoyé à <b>{sent}</b>. Ouvre-le sur cet appareil.{" "}
            <button className={styles.linkBtn} onClick={() => setSent(null)}>
              changer d&apos;adresse
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
                placeholder="ton e-mail"
                autoComplete="email"
                onChange={(e) => setAddress(e.target.value)}
                aria-label="Adresse e-mail"
              />
            </label>
            <button className={styles.btnBig} disabled={busy}>
              {busy ? "envoi…" : "Recevoir un lien"}
            </button>
            <span className={styles.muted}>ou</span>
            <button
              type="button"
              className={styles.btnBig}
              onClick={() => {
                sfx.click();
                void signInWithGoogle().then((error) => {
                  if (!error) return;
                  sfx.locked();
                  say("connexion Google impossible");
                  console.warn("[cloud] google", error);
                });
              }}
            >
              G Continuer avec Google
            </button>
          </form>
        )}
      </div>
    );

  return (
    <div className={styles.account}>
      <p>
        Connecté : <b>{email}</b> · <span className={styles.muted}>{CLOUD_LABEL[status]}</span>
      </p>
      {status === "error" && (
        <p className={styles.muted}>
          Ta collec reste dans ce navigateur, on réessaie au prochain changement. Détail : {error ?? "serveur injoignable"}
        </p>
      )}
      {status === "conflict" && conflict && (
        <>
          <p>
            Ce navigateur et ton compte ont chacun changé. Laquelle garder ? En ligne : <b>{Object.keys(conflict.collection).length}</b> cartes, ici :{" "}
            <b>{Object.keys(useStore.getState().collection).length}</b> cartes.
          </p>
          <div className={styles.saveActions}>
            <button className={styles.btnBig} onClick={() => void resolveConflict("cloud").then(() => say("collection en ligne récupérée"))}>
              ☁ Garder celle en ligne
            </button>
            <button className={styles.btnBig} onClick={() => void resolveConflict("local").then(() => say("collection envoyée en ligne"))}>
              💻 Garder celle d&apos;ici
            </button>
          </div>
        </>
      )}
      <div className={styles.saveActions}>
        <button
          className={styles.btnBig}
          onClick={() => {
            sfx.click();
            void signOut().then(() => say("déconnecté, la collection reste dans ce navigateur"));
          }}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
