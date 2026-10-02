"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { langOfKey } from "@/lib/cardLang";
import {
  noPriceText, variantLabel, cardCurrency, copiesPaid, currencySign, copiesValue, formatMoney, formatPrice, hasPrice, marketName, marketPrice, priceMove, unitPrice,
} from "@/lib/price";
import { sfx } from "@/lib/sound";
import { CONDITIONS, CONDITION_LABEL, useStore } from "@/lib/store";
import type { CardData, Condition, Copy, Variant } from "@/lib/types";
import type { AddResult } from "./CardSlot";
import { CardBack } from "./CardBack";
import styles from "./Inspector.module.css";
import { useT } from "@/lib/lang";

interface Props {
  card: CardData;
  /** Free binder the card is looked at from; null = its set binder */
  binderId: string | null;
  onClose: () => void;
  onNavigate: (delta: number) => void;
  onAdd: (card: CardData) => AddResult;
}

export function Inspector({ card, binderId, onClose, onNavigate, onAdd }: Props) {
  const t = useT();
  // a card is priced on its language's market: Cardmarket for French cards, TCGplayer for English ones
  const cardLang = langOfKey(card.id);
  const english = cardLang === "en";
  // Cardmarket is searched by English name: a Japanese card's is the last of its Pokémon names
  const searchName = cardLang === "ja" ? (card.aka?.split(" · ").at(-1) ?? card.name) : card.name;
  const copies = useStore((s) => s.collection[card.id]);
  const binders = useStore((s) => s.binders);
  const { addCopy, updateCopy, removeCopy, removeCard } = useStore.getState();
  const owned = !!copies?.length;
  const keptHere = copies?.some((c) => (c.at?.binder ?? null) === binderId);
  /** Where each copy is kept, when it's not this binder */
  const placeOf = (copy: Copy) => {
    const here = (copy.at?.binder ?? null) === binderId;
    if (here) return undefined;
    if (!copy.at) return t("dans son classeur", "in its binder");
    const b = binders.find((x) => x.id === copy.at!.binder);
    return b?.kind === "free" ? `${t("dans", "in")} ${b.name}` : undefined;
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

  const priced = card.variants.some((v) => hasPrice(card, v));
  const trendValue = copiesValue(card, copies, "trend");
  const { paid, known } = copiesPaid(copies);
  // the gain only counts copies whose price paid AND current price are both known
  const both = copies?.filter((c) => c.paid != null && hasPrice(card, c.variant));
  const gainKnown = !!both?.length;
  const gain = (both ?? []).reduce((sum, c) => sum + c.qty * (unitPrice(card, c.variant, "trend") - (c.paid ?? 0)), 0);
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
      <button className={`${styles.nav} ${styles.navPrev}`} onClick={() => onNavigate(-1)} aria-label={t("Carte précédente", "Previous card")}>
        ‹
      </button>
      <button className={`${styles.nav} ${styles.navNext}`} onClick={() => onNavigate(1)} aria-label={t("Carte suivante", "Next card")}>
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
          {card.img ? <img src={`${card.img}/high.webp`} alt={card.name} draggable={false} /> : <CardBack />}
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
        <button className={styles.close} onClick={onClose} aria-label={t("Fermer", "Close")} data-tour="inspector-close">
          ✕
        </button>
        <p className={styles.kicker}>
          #{card.num} · {card.rarity ?? card.category}
          {card.aka && <span className={styles.aka}> · {card.aka}</span>}
        </p>
        <h2 className={styles.name}>{card.name}</h2>
        {card.unavailable && (
          <p className={styles.soon}>
            {t(
              <>
                🚧 <b>Bientôt de retour</b> : notre fournisseur de cartes a retiré cette carte pour l&apos;instant, on est au courant. Tu
                peux toujours la garder et la compléter ; image et prix reviennent dès qu&apos;elle est de nouveau en ligne (prix figés en
                attendant).
              </>,
              <>
                🚧 <b>Back soon</b>: our card provider took this card out for now, we know about it. You can still keep it and fill it in;
                picture and price come back as soon as it&apos;s online again (prices frozen meanwhile).
              </>,
            )}
          </p>
        )}

        <section className={styles.prices}>
          <div className={styles.priceHead}>
            {card.price.cm ? (
              <span
                title={t(
                  "Pas vendue sur TCGplayer : guide de prix Cardmarket (toutes langues), converti en dollars",
                  "Not sold on TCGplayer: Cardmarket's price guide (every language), converted to dollars",
                )}
              >
                ≈ Cardmarket
              </span>
            ) : english ? (
              <span
                title={t(
                  "Prix du marché TCGplayer : cartes anglaises vendues aux États-Unis, tous états",
                  "TCGplayer market price: English cards sold in the US, every condition",
                )}
              >
                {t("TCGplayer · cartes anglaises", "TCGplayer · English cards")}
              </span>
            ) : cardLang === "ja" ? (
              <span
                title={t(
                  "Cardmarket a des fiches à part pour les cartes japonaises : c'est leur prix à elles (tous états)",
                  "Cardmarket lists Japanese prints as products of their own: this is their price (every condition)",
                )}
              >
                {t("Cardmarket · cartes japonaises", "Cardmarket · Japanese cards")}
              </span>
            ) : (
              <span title={t("Le guide de prix Cardmarket mélange toutes les langues et tous les états", "Cardmarket's price guide mixes every language and condition")}>
                {t("Cardmarket · toutes langues", "Cardmarket · all languages")}
              </span>
            )}
            <span>{t("prix bas", "low")}</span>
            <span>{t("tendance", "trend")}</span>
          </div>
          {card.variants.map((v) => (
            <div key={v} className={styles.priceRow}>
              <span>
                <i className={`${styles.gem} ${styles[v]}`} /> {variantLabel(v)}
              </span>
              <span>{formatPrice(marketPrice(card, v, "low"), cardCurrency(card))}</span>
              <span className={styles.trend}>
                <Move value={priceMove(card, v)} />
                {formatPrice(marketPrice(card, v, "trend"), cardCurrency(card))}
              </span>
            </div>
          ))}
          {!priced && <p className={styles.noPrice}>{noPriceText(card)}{t(" : pas de prix pour l'instant.", ": no price for now.")}</p>}
        </section>

        {owned ? (
          <section className={styles.copies}>
            <h3>
              {t("Mes exemplaires", "My copies")} <span>×{count}</span>
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
              {t("+ un autre exemplaire", "+ another copy")}
            </button>
            <dl className={styles.value}>
              <div>
                <dt>{t("Valeur", "Value")}</dt>
                <dd title={priced ? undefined : noPriceText(card)}>{priced ? formatMoney(trendValue) : "—"}</dd>
              </div>
              <div>
                <dt>{t("Payé", "Paid")}</dt>
                <dd>{known ? formatMoney(paid) : "—"}</dd>
              </div>
              <div>
                <dt>{t("Plus-value", "Gain")}</dt>
                <dd className={gainKnown ? (gain >= 0 ? styles.up : styles.down) : ""}>
                  {gainKnown ? `${gain >= 0 ? "+" : ""}${formatMoney(gain)}` : "—"}
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
              {t("★ Je l'ai !", "★ Got it!")}
            </button>
            <p className={styles.hint}>{t("Tu pourras ensuite préciser la variante, l'état et les doublons.", "You can then set the variant, condition and duplicates.")}</p>
          </section>
        )}

        <footer className={styles.footer}>
          <a
            href={
              !english
                ? `https://www.cardmarket.com/${t("fr", "en")}/Pokemon/Products/Search?searchString=${encodeURIComponent(searchName)}`
                : card.price.tp
                  ? `https://www.tcgplayer.com/product/${card.price.tp}`
                  : `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(card.name)}`
            }
            target="_blank"
            rel="noreferrer"
            onClick={() => sfx.click()}
          >
            {t("Voir sur", "See on")} {marketName(cardLang)} ↗
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
  const t = useT();
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
        title={canCycleVariant ? t("Clic : changer de variante", "Click: change variant") : t("Seule variante existante", "Only variant there is")}
      >
        <i className={`${styles.gem} ${styles[copy.variant as Variant]}`} />
        {variantLabel(copy.variant)}
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
        title={`${CONDITION_LABEL[copy.condition]} — ${t("clic : état suivant, clic droit : précédent", "click: next condition, right-click: previous")}`}
      >
        {copy.condition}
      </motion.button>

      <div className={styles.qty}>
        <button onClick={() => onQty(-1)} aria-label={t("Moins", "Less")}>
          −
        </button>
        <motion.b key={copy.qty} initial={{ scale: 1.7, y: -4 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 500, damping: 14 }}>
          {copy.qty}
        </motion.b>
        <button onClick={() => onQty(1)} aria-label={t("Plus", "More")}>
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
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const pulled = paid === 0;

  const open = () => {
    sfx.pop();
    setDraft(paid ? t(String(paid).replace(".", ","), String(paid)) : "");
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
      <span className={styles.paidLabel}>{t("obtenue", "got it")}</span>
      <div className={styles.origin} role="radiogroup" aria-label={t("Comment tu as eu cet exemplaire", "How you got this copy")}>
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
          title={t("Achetée ou échangée : note son prix", "Bought or traded: note its price")}
        >
          {t("achetée", "bought")}
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
          title={`${t("Tirée d'un booster : elle ne t'a rien coûté", "Pulled from a booster: it cost you nothing")} (${formatMoney(0)})`}
        >
          <svg className={styles.pack} viewBox="0 0 14 20" aria-hidden>
            <path d="M1 3 L2.5 1 L4 3 L5.5 1 L7 3 L8.5 1 L10 3 L11.5 1 L13 3 V17 L11.5 19 L10 17 L8.5 19 L7 17 L5.5 19 L4 17 L2.5 19 L1 17 Z" />
            <circle cx="7" cy="10" r="3" />
          </svg>
          {t("en booster", "from a pack")}
        </button>
      </div>
      {!pulled &&
        (editing ? (
          <span className={styles.paidEdit}>
            <input
              autoFocus
              inputMode="decimal"
              value={draft}
              placeholder={t("0,00", "0.00")}
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
            {currencySign()}
          </span>
        ) : (
          <motion.button
            key={String(paid)}
            className={`${styles.tag} ${paid == null ? styles.tagEmpty : ""}`}
            initial={{ rotate: -14, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 9 }}
            onClick={open}
            title={t("Clic : saisir le prix payé", "Click: enter the price paid")}
          >
            {paid == null ? t(`? ${currencySign()}`, `${currencySign()} ?`) : formatMoney(paid)}
          </motion.button>
        ))}
    </div>
  );
}

/** Keep pressed to confirm: no accidental removals. */
function HoldButton({ onConfirm }: { onConfirm: () => void }) {
  const t = useT();
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
      title={t("Maintiens pour retirer", "Hold to remove")}
    >
      <span className={styles.holdFill} />
      <span className={styles.holdText}>{holding ? t("Maintiens…", "Hold…") : t("Retirer du classeur", "Remove from binder")}</span>
    </button>
  );
}

/** ↗ / ↘ : the last 7 days' average sale price against the last 30 days'. */
function Move({ value }: { value: number | null }) {
  const t = useT();
  if (value == null) return null;
  const pct = Math.round(Math.abs(value) * 100);
  const up = value > 0;
  return (
    <span
      className={`${styles.move} ${up ? styles.moveUp : styles.moveDown}`}
      title={t(
        `Ventes des 7 derniers jours ${up ? "au-dessus" : "en dessous"} de la moyenne du mois (${up ? "+" : "−"}${pct} %)`,
        `Last 7 days' sales ${up ? "above" : "below"} the month's average (${up ? "+" : "−"}${pct}%)`,
      )}
    >
      {up ? "↗" : "↘"} {pct} %
    </span>
  );
}
