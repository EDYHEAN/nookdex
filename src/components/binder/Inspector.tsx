"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { VARIANT_LABEL, copiesPaid, copiesValue, formatEur, unitPrice } from "@/lib/price";
import { sfx } from "@/lib/sound";
import { CONDITIONS, CONDITION_LABEL, useStore } from "@/lib/store";
import type { CardData, Condition, Copy, Variant } from "@/lib/types";
import type { AddResult } from "./CardSlot";
import styles from "./Inspector.module.css";

interface Props {
  card: CardData;
  /** Free binder the card is looked at from; null = its set binder */
  binderId: string | null;
  onClose: () => void;
  onNavigate: (delta: number) => void;
  onAdd: (card: CardData) => AddResult;
}

export function Inspector({ card, binderId, onClose, onNavigate, onAdd }: Props) {
  const copies = useStore((s) => s.collection[card.id]);
  const binders = useStore((s) => s.binders);
  const { addCopy, updateCopy, removeCopy, removeCard } = useStore.getState();
  const owned = !!copies?.length;
  const keptHere = copies?.some((c) => (c.at?.binder ?? null) === binderId);
  /** Where each copy is kept, when it's not this binder */
  const placeOf = (copy: Copy) => {
    const here = (copy.at?.binder ?? null) === binderId;
    if (here) return undefined;
    if (!copy.at) return "dans son classeur";
    const b = binders.find((x) => x.id === copy.at!.binder);
    return b?.kind === "free" ? `dans ${b.name}` : undefined;
  };
  const cardRef = useRef<HTMLDivElement>(null);
  const hasFoil = copies?.some((c) => c.variant !== "normal") || card.variants.every((v) => v !== "normal");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onNavigate(1);
      else if (e.key === "ArrowLeft") onNavigate(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNavigate]);

  const tilt = (e: React.PointerEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.setProperty("--rx", `${(0.5 - y) * 22}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 26}deg`);
    el.style.setProperty("--o", "1");
  };
  const untilt = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--o", "0");
  };

  const nextVariant = (copy: Copy) => {
    const i = card.variants.indexOf(copy.variant);
    return card.variants[(i + 1) % card.variants.length];
  };

  const addAnother = () => {
    sfx.plus();
    const have = new Set(copies?.map((c) => c.variant));
    const missing = card.variants.find((v) => !have.has(v));
    addCopy(card.id, missing ?? card.variants[0]);
  };

  const trendValue = copiesValue(card, copies, "trend");
  const { paid, known } = copiesPaid(copies);
  const knownValue = copies?.reduce((sum, c) => sum + (c.paid == null ? 0 : c.qty * unitPrice(card, c.variant, "trend")), 0) ?? 0;
  const gain = knownValue - paid;
  const count = copies?.reduce((n, c) => n + c.qty, 0) ?? 0;

  return (
    <motion.div
      className={styles.backdrop}
      data-tour="inspector"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button className={`${styles.nav} ${styles.navPrev}`} onClick={() => onNavigate(-1)} aria-label="Carte précédente">
        ‹
      </button>
      <button className={`${styles.nav} ${styles.navNext}`} onClick={() => onNavigate(1)} aria-label="Carte suivante">
        ›
      </button>

      <motion.div
        className={styles.cardWrap}
        initial={{ scale: 0.6, rotate: -6, opacity: 0, y: 40 }}
        animate={{ scale: 1, rotate: 0, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 18 }}
        onPointerMove={tilt}
        onPointerLeave={untilt}
      >
        <div ref={cardRef} className={`${styles.card} ${owned ? "" : styles.cardMissing}`}>
          <img src={`${card.img}/high.webp`} alt={card.name} draggable={false} />
          {owned && hasFoil && <span className={styles.foil} />}
          <span className={styles.glare} />
        </div>
      </motion.div>

      <motion.aside
        className={styles.panel}
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.05 }}
      >
        <button className={styles.close} onClick={onClose} aria-label="Fermer" data-tour="inspector-close">
          ✕
        </button>
        <p className={styles.kicker}>
          #{card.num} · {card.rarity ?? card.category}
        </p>
        <h2 className={styles.name}>{card.name}</h2>

        <section className={styles.prices}>
          <div className={styles.priceHead}>
            <span title="Le guide de prix Cardmarket mélange toutes les langues et tous les états">Cardmarket · toutes langues</span>
            <span>prix bas</span>
            <span>tendance</span>
          </div>
          {card.variants.map((v) => (
            <div key={v} className={styles.priceRow}>
              <span>
                <i className={`${styles.gem} ${styles[v]}`} /> {VARIANT_LABEL[v]}
              </span>
              <span>{formatEur(unitPrice(card, v, "low"))}</span>
              <span className={styles.trend}>{formatEur(unitPrice(card, v, "trend"))}</span>
            </div>
          ))}
        </section>

        {owned ? (
          <section className={styles.copies}>
            <h3>
              Mes exemplaires <span>×{count}</span>
            </h3>
            {copies!.map((copy, i) => (
              <CopyRow
                key={copy.id}
                index={i}
                copy={copy}
                place={placeOf(copy)}
                canCycleVariant={card.variants.length > 1}
                onVariant={() => {
                  sfx.pop();
                  updateCopy(card.id, copy.id, { variant: nextVariant(copy) });
                }}
                onCondition={(dir) => {
                  sfx.stamp();
                  const i2 = (CONDITIONS.indexOf(copy.condition) + dir + CONDITIONS.length) % CONDITIONS.length;
                  updateCopy(card.id, copy.id, { condition: CONDITIONS[i2] });
                }}
                onPaid={(price) => updateCopy(card.id, copy.id, { paid: price })}
                onQty={(d) => {
                  if (copy.qty + d <= 0) {
                    sfx.remove();
                    removeCopy(card.id, copy.id);
                    return;
                  }
                  if (d > 0) sfx.plus();
                  else sfx.minus();
                  updateCopy(card.id, copy.id, { qty: copy.qty + d });
                }}
              />
            ))}
            <button className={styles.addCopy} onClick={addAnother} onPointerEnter={sfx.hover}>
              + un autre exemplaire
            </button>
            <dl className={styles.value}>
              <div>
                <dt>Valeur</dt>
                <dd>{formatEur(trendValue)}</dd>
              </div>
              <div>
                <dt>Payé</dt>
                <dd>{known ? formatEur(paid) : "—"}</dd>
              </div>
              <div>
                <dt>Plus-value</dt>
                <dd className={known ? (gain >= 0 ? styles.up : styles.down) : ""}>
                  {known ? `${gain >= 0 ? "+" : ""}${formatEur(gain)}` : "—"}
                </dd>
              </div>
            </dl>
          </section>
        ) : (
          <section className={styles.copies}>
            <button
              className={styles.gotIt}
              onClick={() => {
                onAdd(card);
              }}
              onPointerEnter={sfx.hover}
            >
              ★ Je l&apos;ai !
            </button>
            <p className={styles.hint}>Tu pourras ensuite préciser la variante, l&apos;état et les doublons.</p>
          </section>
        )}

        <footer className={styles.footer}>
          <a
            href={`https://www.cardmarket.com/fr/Pokemon/Products/Search?searchString=${encodeURIComponent(card.name)}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => sfx.click()}
          >
            Voir sur Cardmarket ↗
          </a>
          {keptHere && (
            <HoldButton
              onConfirm={() => {
                sfx.remove();
                removeCard(card.id, binderId);
              }}
            />
          )}
        </footer>
      </motion.aside>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */

/** Stamp inks, from mint (blue) to poor (dark red): dark enough to read on paper. */
const CONDITION_COLORS: Record<Condition, string> = {
  MT: "#2c85a8",
  NM: "#3f8a4f",
  EX: "#6e8a1f",
  GD: "#a8801a",
  LP: "#c0661d",
  PL: "#b8433d",
  PO: "#862838",
};

interface CopyRowProps {
  index: number;
  copy: Copy;
  /** "dans Fourre-tout" when kept in another binder */
  place?: string;
  canCycleVariant: boolean;
  onVariant: () => void;
  onCondition: (dir: 1 | -1) => void;
  onQty: (d: 1 | -1) => void;
  onPaid: (price: number | null) => void;
}

function CopyRow({ index, copy, place, canCycleVariant, onVariant, onCondition, onQty, onPaid }: CopyRowProps) {
  return (
    <motion.div
      className={styles.copy}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <motion.button
        key={copy.variant}
        className={`${styles.token} ${styles[`token_${copy.variant}` as keyof typeof styles]}`}
        initial={{ rotateX: -180, scale: 0.8 }}
        animate={{ rotateX: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 16 }}
        onClick={onVariant}
        disabled={!canCycleVariant}
        title={canCycleVariant ? "Clic : changer de variante" : "Seule variante existante"}
      >
        <i className={`${styles.gem} ${styles[copy.variant as Variant]}`} />
        {VARIANT_LABEL[copy.variant]}
      </motion.button>

      <motion.button
        key={copy.condition}
        className={styles.stamp}
        style={{ ["--c" as string]: CONDITION_COLORS[copy.condition] }}
        initial={{ scale: 1.8, rotate: -18, opacity: 0 }}
        animate={{ scale: 1, rotate: -4, opacity: 1 }}
        transition={{ type: "spring", stiffness: 600, damping: 18 }}
        onClick={() => onCondition(1)}
        onContextMenu={(e) => {
          e.preventDefault();
          onCondition(-1);
        }}
        title={`${CONDITION_LABEL[copy.condition]} — clic : état suivant, clic droit : précédent`}
      >
        {copy.condition}
      </motion.button>

      <div className={styles.qty}>
        <button onClick={() => onQty(-1)} aria-label="Moins">
          −
        </button>
        <motion.b key={copy.qty} initial={{ scale: 1.7, y: -4 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 500, damping: 14 }}>
          {copy.qty}
        </motion.b>
        <button onClick={() => onQty(1)} aria-label="Plus">
          +
        </button>
      </div>
      <PaidTag paid={copy.paid} onChange={onPaid} />
      {place && <span className={styles.place}>📍 {place}</span>}
    </motion.div>
  );
}

/**
 * Where this copy comes from: bought (then its price, "? €" until filled in) or pulled from a booster (0 €).
 * Two explicit choices, the price tag only shows for a bought copy.
 */
function PaidTag({ paid, onChange }: { paid: number | null; onChange: (p: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const pulled = paid === 0;

  const open = () => {
    sfx.pop();
    setDraft(paid ? String(paid).replace(".", ",") : "");
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    const raw = draft.trim().replace(",", ".");
    const n = raw === "" ? null : Number(raw);
    if (n != null && !(n >= 0)) return;
    if (n === paid) return;
    sfx.stamp();
    onChange(n);
  };

  return (
    <div className={styles.paidRow}>
      <span className={styles.paidLabel}>obtenue</span>
      <div className={styles.origin} role="radiogroup" aria-label="Comment tu as eu cet exemplaire">
        <button
          role="radio"
          aria-checked={!pulled}
          className={!pulled ? styles.originOn : ""}
          onClick={() => {
            if (!pulled) return;
            onChange(null);
            open();
          }}
          onPointerEnter={sfx.hover}
          title="Achetée ou échangée : note son prix"
        >
          achetée
        </button>
        <button
          role="radio"
          aria-checked={pulled}
          className={`${styles.booster} ${pulled ? styles.originOn : ""}`}
          onClick={() => {
            if (pulled) return;
            sfx.add(0, "rare");
            setEditing(false);
            onChange(0);
          }}
          onPointerEnter={sfx.hover}
          title="Tirée d'un booster : elle ne t'a rien coûté (0 €)"
        >
          <svg className={styles.pack} viewBox="0 0 14 20" aria-hidden>
            <path d="M1 3 L2.5 1 L4 3 L5.5 1 L7 3 L8.5 1 L10 3 L11.5 1 L13 3 V17 L11.5 19 L10 17 L8.5 19 L7 17 L5.5 19 L4 17 L2.5 19 L1 17 Z" />
            <circle cx="7" cy="10" r="3" />
          </svg>
          en booster
        </button>
      </div>
      {!pulled &&
        (editing ? (
          <span className={styles.paidEdit}>
            <input
              autoFocus
              inputMode="decimal"
              value={draft}
              placeholder="0,00"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setEditing(false);
                }
              }}
            />
            €
          </span>
        ) : (
          <motion.button
            key={String(paid)}
            className={`${styles.tag} ${paid == null ? styles.tagEmpty : ""}`}
            initial={{ rotate: -14, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 9 }}
            onClick={open}
            title="Clic : saisir le prix payé"
          >
            {paid == null ? "? €" : formatEur(paid)}
          </motion.button>
        ))}
    </div>
  );
}

/** Keep pressed to confirm: no accidental removals. */
function HoldButton({ onConfirm }: { onConfirm: () => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const start = () => {
    setHolding(true);
    sfx.click();
    timer.current = window.setTimeout(() => {
      setHolding(false);
      onConfirm();
    }, 900);
  };
  const stop = () => {
    setHolding(false);
    if (timer.current) clearTimeout(timer.current);
  };
  return (
    <button
      className={`${styles.hold} ${holding ? styles.holding : ""}`}
      data-tour="remove-card"
      onPointerDown={(e) => {
        // keeps the press even if the sheet moves under the finger (it scrolls to show the focused button)
        e.currentTarget.setPointerCapture(e.pointerId);
        start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      title="Maintiens pour retirer"
    >
      <span className={styles.holdFill} />
      <span className={styles.holdText}>{holding ? "Maintiens…" : "Retirer du classeur"}</span>
    </button>
  );
}
