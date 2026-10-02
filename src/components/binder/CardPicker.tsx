"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { catalog, loadIndex, useSets, type IndexCard } from "@/lib/catalog";
import { type CardLang, currencyOf } from "@/lib/cardLang";
import { formatPrice } from "@/lib/price";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import { LangStamps } from "../shelf/LangStamps";
import { CardBack } from "./CardBack";
import styles from "./CardPicker.module.css";
import { useLang, useT } from "@/lib/lang";

interface Props {
  /** Pocket being filled, for the title */
  pocket: number;
  onPick: (cardId: string) => Promise<void>;
  onClose: () => void;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const setsInfo = (lang: CardLang) => new Map(catalog(lang).map((s) => [s.id, { code: norm(s.code), name: norm(s.name), label: s.code }]));
const MAX = 60;

/** "dracaufeu ev3.5", "lugia 186", "eb12 tg": every word must hit the name, the number or the set. */
function search(lang: CardLang, index: IndexCard[], q: string) {
  const sets = setsInfo(lang);
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out: IndexCard[] = [];
  for (const c of index) {
    // a Japanese card also answers to its Pokémon's French and English names
    const name = c[6] ? `${norm(c[1])} ${norm(c[6])}` : norm(c[1]);
    const num = c[2].toLowerCase();
    const set = sets.get(c[3]);
    const ok = words.every((w) => {
      const n = w.replace(/^0+(?=\d)/, "");
      return name.includes(w) || num === w || num.replace(/^([a-z]*)0+(?=\d)/, "$1") === n || set?.code === w || (w.length > 3 && set?.name.includes(w));
    });
    if (ok) out.push(c);
    if (out.length >= MAX) break;
  }
  return out;
}

export function CardPicker({ pocket, onPick, onClose }: Props) {
  const t = useT();
  // the site's language first; a binder can mix languages (a "Japanese cards" binder, French and English hits…)
  const [lang, setLang] = useState<CardLang>(useLang());
  const index = useSets((s) => s.index[lang]);
  const assets = useSets((s) => s.assets);
  const collection = useStore((s) => s.collection);
  const [q, setQ] = useState("");
  /** Language whose catalogue couldn't be loaded */
  const [failedLang, setFailedLang] = useState<CardLang | null>(null);
  const failed = failedLang === lang;
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    loadIndex(lang).catch(() => setFailedLang(lang));
  }, [lang]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const labels = useMemo(() => setsInfo(lang), [lang]);
  const results = useMemo(() => (index ? search(lang, index, q) : []), [lang, index, q]);

  const pick = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      await onPick(id);
    } catch {
      sfx.locked();
      setBusy(null);
    }
  };

  return (
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        className={styles.panel}
        initial={{ y: 60, scale: 0.94, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        role="dialog"
        aria-label={t("Choisir une carte", "Pick a card")}
      >
        <header className={styles.head}>
          <p>
            {t("Pochette", "Pocket")} <b>{(pocket % 9) + 1}</b> · page {Math.floor(pocket / 9) + 1}
          </p>
          <span className={styles.langs}>
            <LangStamps
              value={lang}
              onChange={(l) => {
                setLang(l);
                input.current?.focus();
              }}
              disabled={!!busy}
            />
          </span>
          <button className={styles.close} onClick={onClose} onPointerEnter={sfx.hover} aria-label={t("Fermer", "Close")}>
            ✕
          </button>
        </header>
        <label className={styles.search}>
          <span aria-hidden>⌕</span>
          <input
            ref={input}
            value={q}
            placeholder={
              lang === "ja"
                ? t("pokémon, numéro, code… (ex : pikachu sv8)", "pokémon, number, code… (e.g. pikachu sv8)")
                : t("nom, numéro, extension… (ex : dracaufeu mew)", "name, number, set… (e.g. charizard mew)")
            }
            onChange={(e) => {
              setQ(e.target.value);
              sfx.hover();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) void pick(results[0][0]);
            }}
            aria-label={t("Rechercher une carte", "Search a card")}
          />
        </label>

        <div className={styles.body}>
          {failed && <p className={styles.msg}>{t("Impossible de charger le catalogue. Vérifie ta connexion.", "Couldn't load the catalogue. Check your connection.")}</p>}
          {!failed && !index && <p className={styles.msg}>{t("on ouvre le catalogue…", "opening the catalogue…")}</p>}
          {index && !q.trim() && (
            <p className={styles.msg}>
              {t(
                <>
                  {index.length.toLocaleString("fr-FR")} cartes en {{ fr: "français", en: "anglais", ja: "japonais" }[lang]}, des toutes premières séries à
                  Méga-Évolution, promos comprises.
                  <br />
                  Tape un nom (<i>pikachu</i>), ajoute un numéro (<i>pikachu 160</i>) ou un code d&apos;extension (<i>pikachu ev08</i>).
                </>,
                <>
                  {index.length.toLocaleString("en-GB")} {{ fr: "French", en: "English", ja: "Japanese" }[lang]} cards, from the very first series to Mega
                  Evolution, promos included.
                  <br />
                  Type a name (<i>pikachu</i>), add a number (<i>pikachu 160</i>) or a set code (<i>pikachu sit</i>).
                </>,
              )}
            </p>
          )}
          {index && q.trim() && !results.length && <p className={styles.msg}>{t("Aucune carte trouvée… vérifie l'orthographe ?", "No card found… check the spelling?")}</p>}
          <div className={styles.grid}>
            {results.map((c, i) => {
              const [id, name, num, setId, img, trend, aka] = c;
              const qty = collection[id]?.reduce((n, cp) => n + cp.qty, 0) ?? 0;
              return (
                <motion.button
                  key={id}
                  className={`${styles.card} ${busy === id ? styles.busy : ""}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 18) * 0.015 }}
                  onClick={() => void pick(id)}
                  onPointerEnter={sfx.hover}
                  disabled={!!busy}
                  title={`${name} · ${labels.get(setId)?.label} ${num}`}
                >
                  {img ? (
                    <img src={`${assets}${img}/low.webp`} alt={name} loading="lazy" draggable={false} />
                  ) : (
                    <span className={styles.back}>
                      <CardBack />
                    </span>
                  )}
                  <span className={styles.label}>
                    <b>{name}</b>
                    {aka && <small>{aka}</small>}
                    <small>
                      {labels.get(setId)?.label} · {num}
                      {trend ? ` · ${formatPrice(trend, currencyOf(lang))}` : ""}
                    </small>
                  </span>
                  {qty > 0 && <span className={styles.have}>×{qty}</span>}
                </motion.button>
              );
            })}
          </div>
          {results.length >= MAX && <p className={styles.msg}>{t(`Les ${MAX} premières : précise ta recherche.`, `The first ${MAX}: narrow your search.`)}</p>}
        </div>
      </motion.div>
    </motion.div>
  );
}
