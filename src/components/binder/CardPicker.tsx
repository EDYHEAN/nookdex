"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATALOG, loadIndex, useSets, type IndexCard } from "@/lib/catalog";
import { formatEur } from "@/lib/price";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import { CardBack } from "./CardBack";
import styles from "./CardPicker.module.css";

interface Props {
  /** Pocket being filled, for the title */
  pocket: number;
  onPick: (cardId: string) => Promise<void>;
  onClose: () => void;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const SETS = new Map(CATALOG.map((s) => [s.id, { code: norm(s.code), name: norm(s.name), label: s.code }]));
const MAX = 60;

/** "dracaufeu ev3.5", "lugia 186", "eb12 tg": every word must hit the name, the number or the set. */
function search(index: IndexCard[], q: string) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out: IndexCard[] = [];
  for (const c of index) {
    const name = norm(c[1]);
    const num = c[2].toLowerCase();
    const set = SETS.get(c[3]);
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
  const index = useSets((s) => s.index);
  const assets = useSets((s) => s.assets);
  const collection = useStore((s) => s.collection);
  const [q, setQ] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    loadIndex().catch(() => setFailed(true));
  }, []);

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

  const results = useMemo(() => (index ? search(index, q) : []), [index, q]);

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
        aria-label="Choisir une carte"
      >
        <header className={styles.head}>
          <p>
            Pochette <b>{(pocket % 9) + 1}</b> · page {Math.floor(pocket / 9) + 1}
          </p>
          <button className={styles.close} onClick={onClose} onPointerEnter={sfx.hover} aria-label="Fermer">
            ✕
          </button>
        </header>
        <label className={styles.search}>
          <span aria-hidden>⌕</span>
          <input
            ref={input}
            value={q}
            placeholder="nom, numéro, extension… (ex : dracaufeu mew)"
            onChange={(e) => {
              setQ(e.target.value);
              sfx.hover();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) void pick(results[0][0]);
            }}
            aria-label="Rechercher une carte"
          />
        </label>

        <div className={styles.body}>
          {failed && <p className={styles.msg}>Impossible de charger le catalogue. Vérifie ta connexion.</p>}
          {!failed && !index && <p className={styles.msg}>on ouvre le catalogue…</p>}
          {index && !q.trim() && (
            <p className={styles.msg}>
              {index.length.toLocaleString("fr-FR")} cartes en français, des toutes premières séries à Méga-Évolution, promos comprises.
              <br />
              Tape un nom (<i>pikachu</i>), ajoute un numéro (<i>pikachu 160</i>) ou un code d&apos;extension (<i>pikachu ev08</i>).
            </p>
          )}
          {index && q.trim() && !results.length && <p className={styles.msg}>Aucune carte trouvée… vérifie l&apos;orthographe ?</p>}
          <div className={styles.grid}>
            {results.map((c, i) => {
              const [id, name, num, setId, img, trend] = c;
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
                  title={`${name} · ${SETS.get(setId)?.label} ${num}`}
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
                    <small>
                      {SETS.get(setId)?.label} · {num}
                      {trend ? ` · ${formatEur(trend)}` : ""}
                    </small>
                  </span>
                  {qty > 0 && <span className={styles.have}>×{qty}</span>}
                </motion.button>
              );
            })}
          </div>
          {results.length >= MAX && <p className={styles.msg}>Les {MAX} premières : précise ta recherche.</p>}
        </div>
      </motion.div>
    </motion.div>
  );
}
