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
  subtitle?: string;
  /** Resolves once the binder is ready to go on the shelf. */
  onPick: (choice: BinderChoice) => Promise<void>;
  onClose?: () => void;
}

const seriesOf = (lang: CardLang) => [...new Map(binderSets(lang).map((s) => [s.serie, s.serieName])).entries()].map(([id, name]) => ({ id, name }));
type Tab = string | "free";

const FREE_IDEAS = { fr: ["Fourre-tout", "Openings", "Mes favorites", "À échanger", "Full Arts"], en: ["Bits & bobs", "Openings", "Favourites", "For trade", "Full Arts"] };

export function BinderPicker({ title, subtitle, onPick, onClose }: Props) {
  const binders = useStore((s) => s.binders);
  const t = useT();
  // cards in the site's language, unless the player picks another (an English binder on a French shelf…)
  const [cardLang, setCardLang] = useState<CardLang>(useLang());
  const onShelf = useMemo(() => new Set(binders.flatMap((b) => (b.kind === "set" ? [b.setId] : []))), [binders]);
  const [tab, setTab] = useState<Tab>(seriesOf(cardLang)[0].id);
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

  const sets = binderSets(cardLang).filter((s) => s.serie === tab);

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
            <LangStamps value={cardLang} onChange={setCardLang} disabled={!!busy} />
          </div>
        )}
        {onClose && (
          <button className={styles.close} onClick={onClose} onPointerEnter={sfx.hover} aria-label={t("Fermer", "Close")}>
            ✕
          </button>
        )}
      </header>

      <nav className={styles.tabs} role="tablist">
        {[...seriesOf(cardLang), { id: "free", name: t("Classeur libre", "Free binder") }].map((s) => (
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
                <span className={styles.logo}>
                  {s.logo ? <img src={`${s.logo}.png`} alt="" loading="lazy" draggable={false} /> : <b>{s.name}</b>}
                </span>
                <span className={styles.setName}>{s.name}</span>
                <span className={styles.meta}>
                  <kbd>{s.code}</kbd> {s.releaseDate?.slice(0, 4)} · {s.total} {t("cartes", "cards")}
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
