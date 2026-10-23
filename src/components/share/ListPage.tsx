"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { langLabel } from "@/lib/cardLang";
import type { ListCard } from "@/lib/shareList";
import { SITE_NAME } from "@/lib/site";
import { sfx } from "@/lib/sound";
import type { Variant } from "@/lib/types";
import styles from "./ListPage.module.css";

/**
 * The public list's page (/c/<slug>), phone first: who, how fresh, two big tabs « Je cherche » / « J'échange », the sets as
 * pills, the scans three to a row. Each set shows its first cards (the ones that matter: lib/shareList sortList) and folds
 * the rest. At the bottom the list as text (for a Facebook comment) and the way to make one's own.
 */

interface Props {
  en: boolean;
  slug: string;
  gone?: boolean;
  name?: string;
  updatedAt?: string;
  prices?: boolean;
  want?: ListCard[];
  give?: ListCard[];
}

/** cards shown per set before « voir les autres » */
const FOLD = 12;

const VARIANTS: Record<"fr" | "en", Record<Variant, string>> = {
  fr: { normal: "Normale", reverse: "Reverse", holo: "Holo" },
  en: { normal: "Normal", reverse: "Reverse", holo: "Holo" },
};

function ago(iso: string, en: boolean) {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 2) return en ? "updated just now" : "à jour à l'instant";
  if (min < 60) return en ? `updated ${min} min ago` : `à jour il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return en ? `updated ${h} h ago` : `à jour il y a ${h} h`;
  const d = Math.round(h / 24);
  return en ? `updated ${d} days ago` : `à jour il y a ${d} jours`;
}

const money = (n: number | null, currency: string, en: boolean) =>
  n == null ? "—" : new Intl.NumberFormat(en ? "en-US" : "fr-FR", { style: "currency", currency, maximumFractionDigits: n >= 100 ? 0 : 2 }).format(n);

export function ListPage({ en, slug, gone, name = "", updatedAt = "", prices = true, want = [], give = [] }: Props) {
  const t = (fr: string, english: string) => (en ? english : fr);
  const site = en ? "en" : "fr";
  const home = `${en ? "/en" : "/"}?utm_source=share`;
  const giveCount = give.reduce((n, c) => n + c.n, 0);
  const [tab, setTab] = useState<"want" | "give">(want.length || !give.length ? "want" : "give");
  const [only, setOnly] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [note, setNote] = useState<string | null>(null);

  const cards = tab === "want" ? want : give;
  // the sets in the list's order (newest first), with their count
  const sets = useMemo(() => {
    const m = new Map<string, { key: string; name: string; logo: string | null; count: number }>();
    for (const c of cards) {
      const s = m.get(c.setKey) ?? { key: c.setKey, name: c.setName, logo: c.logo, count: 0 };
      s.count += 1;
      m.set(c.setKey, s);
    }
    return [...m.values()];
  }, [cards]);
  const groups = sets.filter((s) => !only || s.key === only).map((s) => ({ ...s, cards: cards.filter((c) => c.setKey === s.key) }));

  const say = (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote((n) => (n === msg ? null : n)), 2000);
  };

  /** The list as a Facebook comment: by set, each card on a line, its language when it isn't the reader's */
  const text = () => {
    const line = (c: ListCard) =>
      `- ${c.num} ${c.name}${c.lang !== site ? ` [${langLabel(c.lang, site)}]` : ""}${c.variant && c.variant !== "normal" ? ` (${VARIANTS[site][c.variant]})` : ""}${c.n > 1 ? ` ×${c.n}` : ""}`;
    const block = (title: string, list: ListCard[]) => {
      if (!list.length) return [];
      const out = [title];
      let set = "";
      for (const c of list) {
        if (c.setKey !== set) {
          set = c.setKey;
          out.push(`${c.setName}${t(" :", ":")}`);
        }
        out.push(line(c));
      }
      return [...out, ""];
    };
    return [
      ...block(t(`🔎 Je cherche (${want.length}) :`, `🔎 Looking for (${want.length}):`), want),
      ...block(t(`🔁 J'échange (${giveCount}) :`, `🔁 For trade (${giveCount}):`), give),
      `${t("Ma liste à jour :", "My list, always up to date:")} ${location.origin}/c/${slug}`,
    ].join("\n");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      sfx.pop();
      say(t("liste copiée ! colle-la dans ton commentaire", "list copied! paste it in your comment"));
    } catch {
      sfx.locked();
      say(t("copie impossible", "couldn't copy"));
    }
  };

  if (gone) {
    return (
      <main className={styles.page}>
        <section className={`${styles.sheet} ${styles.gone}`}>
          <p className={styles.brand}>{SITE_NAME}</p>
          <h1>{t("Cette liste n'existe plus", "This list is gone")}</h1>
          <p>{t("Son dresseur l'a retirée, ou elle n'a pas bougé depuis longtemps.", "Its trainer took it down, or it hasn't moved in a long while.")}</p>
          <a className={styles.cta} href={home} onPointerDown={() => sfx.pop()}>
            {t("Fais ta liste sur NookDex ▶", "Make your list on NookDex ▶")}
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.sheet}>
        <header className={styles.head}>
          <a className={styles.brand} href={home}>
            {SITE_NAME}
          </a>
          <h1>{t(`La liste de ${name}`, `${name}'s list`)}</h1>
          <p className={styles.fresh} suppressHydrationWarning>
            {updatedAt && ago(updatedAt, en)}
          </p>
        </header>

        <nav className={styles.tabs} role="tablist">
          {(
            [
              ["want", t("Je cherche", "Looking for"), want.length, "🔎"],
              ["give", t("J'échange", "For trade"), giveCount, "🔁"],
            ] as const
          ).map(([id, label, n, icon]) => (
            <motion.button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`${styles.tab} ${tab === id ? styles.tabOn : ""}`}
              whileTap={{ scale: 0.94 }}
              disabled={!n}
              onClick={() => {
                sfx.click();
                setTab(id);
                setOnly(null);
              }}
            >
              <span className={styles.tabIcon} aria-hidden>
                {icon}
              </span>
              <b>{n}</b>
              <span>{label}</span>
            </motion.button>
          ))}
        </nav>

        {sets.length > 1 && (
          <div className={styles.pills}>
            <button className={`${styles.pill} ${!only ? styles.pillOn : ""}`} onClick={() => (sfx.click(), setOnly(null))}>
              {t("Tout", "All")} <small>{cards.length}</small>
            </button>
            {sets.map((s) => (
              <button key={s.key} className={`${styles.pill} ${only === s.key ? styles.pillOn : ""}`} onClick={() => (sfx.click(), setOnly(only === s.key ? null : s.key))}>
                {s.logo && <img src={`${s.logo}.png`} alt="" />}
                {s.name} <small>{s.count}</small>
              </button>
            ))}
          </div>
        )}

        {!cards.length && <p className={styles.empty}>{tab === "want" ? t("Rien à chercher pour l'instant.", "Nothing wanted right now.") : t("Rien à échanger pour l'instant.", "Nothing for trade right now.")}</p>}

        <AnimatePresence mode="popLayout" initial={false}>
          {groups.map((g) => {
            const all = open.has(`${tab}:${g.key}`) || !!only;
            const shown = all ? g.cards : g.cards.slice(0, FOLD);
            return (
              <motion.section key={`${tab}:${g.key}`} className={styles.group} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <h2>
                  {g.logo && <img src={`${g.logo}.png`} alt="" />}
                  <span>{g.name}</span>
                  <small>{g.cards.length}</small>
                </h2>
                <ul className={styles.grid}>
                  {shown.map((c, i) => (
                    <motion.li
                      key={`${c.key}|${c.variant ?? ""}`}
                      className={styles.card}
                      initial={{ opacity: 0, scale: 0.9, rotate: i % 2 ? 2 : -2 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      transition={{ delay: Math.min(i, FOLD) * 0.025, type: "spring", stiffness: 320, damping: 22 }}
                    >
                      <span className={styles.scan}>
                        {c.img ? <img src={`${c.img}/low.webp`} alt={c.name} loading="lazy" /> : <span className={styles.noScan}>{c.name}</span>}
                        <i className={`${styles.lang} ${styles[c.lang]}`}>{langLabel(c.lang, site)}</i>
                        {c.n > 1 && <i className={styles.qty}>×{c.n}</i>}
                        {c.variant && <i className={`${styles.variant} ${styles[c.variant]}`}>{VARIANTS[site][c.variant]}</i>}
                      </span>
                      <span className={styles.name}>{c.name}</span>
                      <span className={styles.meta}>
                        <span>{c.num}</span>
                        {prices && <b>{money(c.price, c.currency, en)}</b>}
                      </span>
                    </motion.li>
                  ))}
                </ul>
                {!all && g.cards.length > FOLD && (
                  <button
                    className={styles.more}
                    onClick={() => {
                      sfx.riffle();
                      setOpen((o) => new Set(o).add(`${tab}:${g.key}`));
                    }}
                  >
                    {t(`+ voir les ${g.cards.length - FOLD} autres`, `+ see the ${g.cards.length - FOLD} others`)} ▾
                  </button>
                )}
              </motion.section>
            );
          })}
        </AnimatePresence>

        <footer className={styles.foot}>
          <button className={styles.copy} onClick={copy}>
            {t("Copier en texte", "Copy as text")}
          </button>
          <p className={styles.note} aria-live="polite">
            {note ?? " "}
          </p>
          <a className={styles.cta} href={home} onPointerDown={() => sfx.pop()}>
            {t("Fais ta liste sur NookDex ▶", "Make your list on NookDex ▶")}
          </a>
          <p className={styles.small}>
            {t(
              "Ta collection de cartes Pokémon rangée sur un bureau peint. Gratuit, sans compte.",
              "Your Pokémon card collection, filed on a painted desk. Free, no account needed.",
            )}
          </p>
          {prices && (
            <p className={styles.small}>
              {t("Prix du jour à titre indicatif : Cardmarket (€) et TCGplayer ($, cartes anglaises).", "Today's prices, for reference: Cardmarket (€) and TCGplayer ($, English cards).")}
            </p>
          )}
          <a className={styles.report} href="/contact">
            {t("Signaler cette liste", "Report this list")}
          </a>
        </footer>
      </section>
    </main>
  );
}
