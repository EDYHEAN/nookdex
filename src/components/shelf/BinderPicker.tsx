"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { binderSets } from "@/lib/catalog";
import type { CardLang } from "@/lib/cardLang";
import { LangStamps } from "./LangStamps";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import styles from "./BinderPicker.module.css";
import { useLang, useT } from "@/lib/lang";

export type BinderChoice = { kind: "set"; setId: string } | { kind: "free"; name: string };

interface Props {
  title: string;
  subtitle?: React.ReactNode;
  /** Resolves once the binder is ready to go on the shelf. */
  onPick: (choice: BinderChoice) => Promise<void>;
  onClose?: () => void;
}

/** Japanese series ids and their international twins: same tab, and its name in the site's language. */
const TWIN: Record<string, string> = { M: "me", SV: "sv", S: "swsh" };
const twinOf = (serie: string, to: CardLang) =>
  to === "ja" ? (Object.keys(TWIN).find((k) => TWIN[k] === serie) ?? serie) : (TWIN[serie] ?? serie);

/** The Wizards era's series (Base, Gym, Neo, Legendary Collection, e-Card): one tab, they're a few sets each. */
const WIZARDS = new Set(["base", "gym", "neo", "lc", "ecard"]);
const tabOf = (serie: string) => (WIZARDS.has(serie) ? "wizards" : serie);

function seriesOf(lang: CardLang, site: "fr" | "en") {
  const names = new Map(binderSets(site).map((s) => [tabOf(s.serie), WIZARDS.has(s.serie) ? "Wizards" : s.serieName]));
  return [...new Map(binderSets(lang).map((s) => [tabOf(s.serie), names.get(twinOf(tabOf(s.serie), site)) ?? s.serieName])).entries()].map(([id, name]) => ({
    id,
    name,
  }));
}
type Tab = string | "free";

const FREE_IDEAS = { fr: ["Fourre-tout", "Openings", "Mes favorites", "À échanger", "Full Arts"], en: ["Bits & bobs", "Openings", "Favourites", "For trade", "Full Arts"] };

export function BinderPicker({ title, subtitle, onPick, onClose }: Props) {
  const binders = useStore((s) => s.binders);
  const t = useT();
  // cards in the site's language, unless the player picks another (an English binder on a French shelf…)
  const site = useLang();
  const [cardLang, setCardLang] = useState<CardLang>(site);
  const onShelf = useMemo(() => new Set(binders.flatMap((b) => (b.kind === "set" ? [b.setId] : []))), [binders]);
  const [tab, setTab] = useState<Tab>(seriesOf(cardLang, site)[0].id);
  /** Another card language: the same series' tab in it (or its first one) */
  const pickLang = (lang: CardLang) => {
    setCardLang(lang);
    if (tab === "free") return;
    const series = seriesOf(lang, site);
    const twin = twinOf(TWIN[tab] ?? tab, lang);
    setTab(series.some((x) => x.id === twin) ? twin : series[0].id);
  };
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [name, setName] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  useEffect(() => {
    if (tab === "free") input.current?.focus();
  }, [tab]);

  const pick = async (choice: BinderChoice, key: string) => {
    if (busy) return;
    sfx.stamp();
    setBusy(key);
    setFailed(null);
    try {
      await onPick(choice);
    } catch {
      sfx.locked();
      setFailed(key);
      setBusy(null);
    }
  };

  const sets = binderSets(cardLang).filter((s) => tabOf(s.serie) === tab);

  return (
    <motion.div
      className={styles.sheet}
      initial={{ y: 80, rotate: 2, opacity: 0 }}
      animate={{ y: 0, rotate: 0, opacity: 1 }}
      exit={{ y: 60, rotate: -2, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      role="dialog"
      aria-label={title}
    >
      <header className={styles.head}>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {tab !== "free" && (
          <div className={styles.langs}>
            <LangStamps value={cardLang} onChange={pickLang} disabled={!!busy} />
          </div>
        )}
        {onClose && (
          <button className={styles.close} onClick={onClose} onPointerEnter={sfx.hover} aria-label={t("Fermer", "Close")}>
            ✕
          </button>
        )}
      </header>

      <nav className={styles.tabs} role="tablist">
        {[...seriesOf(cardLang, site), { id: "free", name: t("Classeur libre", "Free binder") }].map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={tab === s.id}
            className={`${styles.tab} ${tab === s.id ? styles.tabOn : ""} ${s.id === "free" ? styles.tabFree : ""}`}
            onClick={() => {
              if (tab === s.id) return;
              sfx.riffle();
              setTab(s.id);
            }}
            onPointerEnter={sfx.hover}
          >
            {s.id === "free" ? "✎ " : ""}
            {s.name}
          </button>
        ))}
      </nav>

      {tab !== "free" ? (
        <div key={`${cardLang}:${tab}`} className={styles.grid}>
          {sets.map((s, i) => {
            const have = onShelf.has(s.id);
            const loading = busy === s.id;
            return (
              <motion.button
                key={s.id}
                className={`${styles.set} ${have ? styles.have : ""} ${loading ? styles.loading : ""}`}
                initial={{ opacity: 0, y: 14, rotate: i % 2 ? 1.5 : -1.5 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ delay: Math.min(i, 14) * 0.025, type: "spring", stiffness: 380, damping: 24 }}
                disabled={have || !!busy}
                onPointerEnter={() => !have && sfx.hover()}
                onClick={() => pick({ kind: "set", setId: s.id }, s.id)}
              >
                {/* the logo says the name: written under it, a long name ran over the logo */}
                <span className={styles.logo}>
                  {/* no logo (Japanese sets): the set code, big, and the name under it */}
                  {s.logo ? <img src={`${s.logo}.png`} alt={s.name} loading="lazy" draggable={false} /> : <b>{s.code}</b>}
                </span>
                {/* under the logo on a computer, beside it on a phone (one set per line) */}
                <span className={styles.info}>
                  {!s.logo && <span className={styles.setName}>{s.name}</span>}
                  <span className={styles.meta}>
                    <kbd>{s.code}</kbd> {s.releaseDate?.slice(0, 4)}
                    <span className={styles.count}>
                      <span className={styles.sep}> · </span>
                      {s.total} {t("cartes", "cards")}
                    </span>
                  </span>
                </span>
                {have && <span className={styles.stamp}>{t("déjà sur l'étagère", "already on the shelf")}</span>}
                {loading && <span className={styles.stamp}>{t("on déballe…", "unpacking…")}</span>}
                {failed === s.id && <span className={`${styles.stamp} ${styles.stampRed}`}>{t("raté, réessaie", "failed, try again")}</span>}
              </motion.button>
            );
          })}
        </div>
      ) : (
        <form
          className={styles.free}
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) {
              sfx.locked();
              input.current?.focus();
              return;
            }
            void pick({ kind: "free", name: n.slice(0, 28) }, "free");
          }}
        >
          <p className={styles.freeIntro}>
            {t(
              <>
                Un classeur sans extension imposée : tu choisis <b>quelle carte</b> va dans <b>quelle pochette</b>. Parfait pour ranger tes
                openings ou tes coups de cœur.
              </>,
              <>
                A binder with no set: you choose <b>which card</b> goes in <b>which pocket</b>. Perfect for your openings or your favourites.
              </>,
            )}
          </p>
          <label className={styles.nameField}>
            <span>{t("Nom sur la tranche", "Name on the spine")}</span>
            <input
              ref={input}
              value={name}
              maxLength={28}
              placeholder={t("Fourre-tout", "Bits & bobs")}
              onChange={(e) => {
                setName(e.target.value);
                sfx.hover();
              }}
            />
          </label>
          <div className={styles.ideas}>
            {t(FREE_IDEAS.fr, FREE_IDEAS.en).map((idea) => (
              <button
                key={idea}
                type="button"
                className={`${styles.idea} ${name === idea ? styles.ideaOn : ""}`}
                onClick={() => {
                  sfx.pop();
                  setName(idea);
                }}
                onPointerEnter={sfx.hover}
              >
                {idea}
              </button>
            ))}
          </div>
          <button className={styles.create} type="submit" disabled={!!busy} onPointerEnter={sfx.hover}>
            {busy === "free" ? t("on l'étiquette…", "labelling…") : t("Créer ce classeur ▶", "Create this binder ▶")}
          </button>
          {failed === "free" && <p className={styles.error}>{t("Oups, réessaie.", "Oops, try again.")}</p>}
        </form>
      )}
    </motion.div>
  );
}
