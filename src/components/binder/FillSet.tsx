"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatMoney, setStats } from "@/lib/price";
import { sfx } from "@/lib/sound";
import { useStore } from "@/lib/store";
import type { Copy, SetData, Variant } from "@/lib/types";
import { useT } from "@/lib/lang";
import styles from "./Binder.module.css";

type Item = { cardId: string; variant: Variant };

/** a "one of each" copy is the plain print when the card has one */
const firstVariant = (vs: Variant[]): Variant => (vs.includes("normal") ? "normal" : vs.includes("holo") ? "holo" : (vs[0] ?? "normal"));

/** how long the "✓ 23 added · Undo" strip stays */
const UNDO_MS = 8000;

/**
 * « J'ai tout » in a set binder (an idea from ZebraDex, Johan 2026-10-17): every card missing in one tap, one of each
 * (a full set) or every version missing (a master set: normal, reverse, holo), kept by their set. Two big tiles with what
 * each adds and what it's worth, then a few seconds to undo it.
 */
export function FillSet({ set }: { set: SetData }) {
  const t = useT();
  const collection = useStore((s) => s.collection);
  const fillSet = useStore((s) => s.fillSet);
  const removeCopies = useStore((s) => s.removeCopies);
  const [open, setOpen] = useState(false);
  const [undo, setUndo] = useState<{ n: number; added: { cardId: string; copyId: string }[] } | null>(null);
  const timer = useRef<number | null>(null);
  const wrap = useRef<HTMLSpanElement>(null);

  const plans = useMemo(() => {
    const full: Item[] = [];
    const master: Item[] = [];
    for (const card of set.cards) {
      const have = new Set((collection[card.id] ?? []).map((c) => c.variant));
      if (!have.size) full.push({ cardId: card.id, variant: firstVariant(card.variants) });
      for (const v of card.variants) if (!have.has(v)) master.push({ cardId: card.id, variant: v });
    }
    // what each adds to the binder's value: the same sum as its stats, with the new copies in
    const now = setStats(set, collection).trend;
    const worth = (items: Item[]) => {
      const next = { ...collection };
      for (const { cardId, variant } of items) next[cardId] = [...(next[cardId] ?? []), { id: "", variant, condition: "NM", qty: 1, paid: null, addedAt: 0 } as Copy];
      return setStats(set, next).trend - now;
    };
    return { full, master, fullWorth: worth(full), masterWorth: worth(master) };
  }, [set, collection]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  // open, a tap anywhere else (or Esc) closes it
  useEffect(() => {
    if (!open) return;
    const shut = (e: Event) => {
      const esc = e instanceof KeyboardEvent && e.key === "Escape";
      // Esc closes the tiles, not the binder under them
      if (esc) e.stopPropagation();
      if (esc || (!(e instanceof KeyboardEvent) && !wrap.current?.contains(e.target as Node))) setOpen(false);
    };
    document.addEventListener("pointerdown", shut);
    document.addEventListener("keydown", shut, true);
    return () => {
      document.removeEventListener("pointerdown", shut);
      document.removeEventListener("keydown", shut, true);
    };
  }, [open]);

  const go = (items: Item[]) => {
    if (!items.length) return;
    sfx.riffle();
    window.setTimeout(() => sfx.stamp(), 220);
    const added = fillSet(items);
    setOpen(false);
    setUndo({ n: items.length, added });
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setUndo(null), UNDO_MS);
  };

  if (!plans.master.length && !plans.full.length && !undo) return null;
  const { full, master } = plans;
  return (
    <span ref={wrap} className={styles.fillWrap}>
      {master.length + full.length > 0 && (
        <button
          className={`${styles.pixelBtn} ${styles.fillBtn}`}
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            sfx.pop();
            setOpen(!open);
          }}
          onPointerEnter={sfx.hover}
          title={t("J'ai toutes les cartes", "I have every card")}
        >
          <span className={styles.shareLabel}>{t("J'ai tout", "Got 'em all")}</span> ✓
        </button>
      )}
      {open && (
        <span className={styles.fillAsk} role="dialog" onClick={(e) => e.stopPropagation()}>
          <button className={styles.fillTile} disabled={!full.length} onPointerEnter={sfx.hover} onClick={() => go(full)}>
            <span className={styles.fillName}>📗 {t("Set complet", "Full set")}</span>
            <b className={styles.fillNum}>{full.length ? `+${full.length}` : "✓"}</b>
            <span className={styles.fillWhat}>{full.length ? t("cartes, 1 de chaque", "cards, one of each") : t("déjà complet", "already complete")}</span>
            {plans.fullWorth > 0 && <span className={styles.fillWorth}>+{formatMoney(plans.fullWorth)}</span>}
          </button>
          <button className={`${styles.fillTile} ${styles.fillMaster}`} disabled={!master.length} onPointerEnter={sfx.hover} onClick={() => go(master)}>
            <span className={styles.fillName}>✨ Master set</span>
            <b className={styles.fillNum}>{master.length ? `+${master.length}` : "✓"}</b>
            <span className={styles.fillWhat}>{t("versions : normale, reverse, holo", "versions: normal, reverse, holo")}</span>
            {plans.masterWorth > 0 && <span className={styles.fillWorth}>+{formatMoney(plans.masterWorth)}</span>}
          </button>
        </span>
      )}
      {undo && (
        <span className={styles.fillDone} role="status">
          ✓ {t(`${undo.n} ajoutées`, `${undo.n} added`)}
          <button
            onClick={(e) => {
              e.stopPropagation();
              sfx.remove();
              removeCopies(undo.added);
              setUndo(null);
            }}
          >
            {t("Annuler", "Undo")}
          </button>
        </span>
      )}
    </span>
  );
}
