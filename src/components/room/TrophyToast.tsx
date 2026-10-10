"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/lang";
import { formatMoney } from "@/lib/price";
import { sfx } from "@/lib/sound";
import { TIER_POINTS, TROPHY, type Trophy, type TrophyTier, tierRank } from "@/lib/trophies";
import { useTrophyQueue } from "@/lib/trophyStore";
import { Medal } from "./Medal";
import styles from "./Trophies.module.css";

/** One toast: a trophy, or a whole batch won at once (an old collection's first visit, a save from the cloud). */
type Toast = { key: number; trophy: Trophy } | { key: number; batch: Trophy[] };

/** How long each tier stays on screen (ms) */
const STAY: Record<TrophyTier, number> = { bronze: 3800, silver: 4400, gold: 5200, platinum: 6500 };
/** more than this at once: one summary toast */
const BATCH = 3;

/** "{50}" in the player's money */
export const trophyText = (s: string) => s.replace(/\{(\d+)\}/g, (_, n) => formatMoney(Number(n)).replace(/[.,]00(?=\D|$)/, ""));

const tierName = (tier: TrophyTier, t: ReturnType<typeof useT>) =>
  ({ bronze: t("Bronze", "Bronze"), silver: t("Argent", "Silver"), gold: t("Or", "Gold"), platinum: t("Platine", "Platinum") })[tier];

const SPARKS = Array.from({ length: 10 }, (_, i) => ({ a: (i / 10) * 360 + (i % 2) * 14, d: 46 + (i % 3) * 14 }));
const CONFETTI = Array.from({ length: 26 }, (_, i) => ({
  x: (Math.random() - 0.5) * 420,
  y: -120 - Math.random() * 260,
  r: Math.random() * 720 - 360,
  c: ["#ffd35a", "#ff7aa8", "#6ae6ff", "#9dff7a", "#b28cff", "#ffffff"][i % 6],
  delay: Math.random() * 0.25,
}));

/** Empties the queue of trophies won into toasts. */
function takeBatches(): Toast[] {
  const { batches } = useTrophyQueue.getState();
  if (!batches.length) return [];
  useTrophyQueue.setState({ batches: [] });
  const toasts: Toast[] = [];
  for (const ids of batches) {
    const list = ids.flatMap((id) => (TROPHY.get(id) ? [TROPHY.get(id)!] : [])).sort((a, b) => tierRank(b.tier) - tierRank(a.tier));
    if (list.length > BATCH) toasts.push({ key: Math.random(), batch: list });
    // one by one, the best last
    else list.reverse().forEach((trophy) => toasts.push({ key: Math.random(), trophy }));
  }
  return toasts;
}

/**
 * Trophies won pop in the bottom-left corner (bottom of the screen on a phone), one after the other, with their
 * fanfare: the higher the tier, the bigger the show. A click opens the trophy case. They wait while `ready` is off
 * (the loader, the welcome).
 */
export function TrophyToasts({ ready, onOpen }: { ready: boolean; onOpen: () => void }) {
  const t = useT();
  // batches won -> toasts: those waiting already, then the next ones as they come
  const [queue, setQueue] = useState<Toast[]>(takeBatches);
  const [shown, setShown] = useState<Toast | null>(null);
  useEffect(
    () =>
      useTrophyQueue.subscribe((q) => {
        if (q.batches.length) setQueue((old) => [...old, ...takeBatches()]);
      }),
    [],
  );

  useEffect(() => {
    if (shown || !ready || !queue.length) return;
    const id = setTimeout(() => {
      setShown(queue[0]);
      setQueue((q) => q.slice(1));
    }, 350);
    return () => clearTimeout(id);
  }, [shown, ready, queue]);

  const top = shown && ("trophy" in shown ? shown.trophy : shown.batch[0]);
  const tier = top?.tier ?? "bronze";
  const secret = !!(shown && "trophy" in shown && shown.trophy.secret);

  useEffect(() => {
    if (!shown) return;
    sfx.trophy(tier, secret);
    const id = setTimeout(() => setShown(null), STAY[tier]);
    return () => clearTimeout(id);
  }, [shown, tier, secret]);

  const points = shown ? ("trophy" in shown ? TIER_POINTS[shown.trophy.tier] : shown.batch.reduce((n, x) => n + TIER_POINTS[x.tier], 0)) : 0;
  const big = tier === "gold" || tier === "platinum";

  return (
    <AnimatePresence>
      {shown && top && (
        <motion.button
          key={shown.key}
          className={`${styles.toast} ${styles["toast_" + tier]} ${secret ? styles.toastSecret : ""}`}
          onClick={() => {
            sfx.pop();
            setShown(null);
            onOpen();
          }}
          initial={big ? { y: 160, scale: 0.6, rotate: -6, opacity: 0 } : { x: -420, rotate: -3, opacity: 0 }}
          animate={{ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }}
          exit={{ x: -60, opacity: 0, scale: 0.94, transition: { duration: 0.3 } }}
          transition={big ? { type: "spring", stiffness: 260, damping: 13 } : { type: "spring", stiffness: 300, damping: 24 }}
          aria-live="polite"
        >
          {tier === "platinum" && <span className={styles.flash} aria-hidden />}
          {tier === "platinum" &&
            CONFETTI.map((c, i) => (
              <motion.i
                key={i}
                className={styles.toastConfetto}
                style={{ background: c.c }}
                initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                animate={{ x: c.x, y: [0, c.y, c.y + 260], rotate: c.r, opacity: [1, 1, 0] }}
                transition={{ duration: 2.2, delay: 0.25 + c.delay, ease: "easeOut" }}
                aria-hidden
              />
            ))}
          <span className={styles.toastMedal}>
            {(tier === "gold" || tier === "platinum") && <span className={styles.rays} aria-hidden />}
            {"trophy" in shown ? (
              <motion.span
                initial={{ rotateY: secret ? 180 : 0, scale: 0.3 }}
                animate={{ rotateY: tier === "bronze" ? 0 : secret ? 0 : 360 * (big ? 2 : 1), scale: 1 }}
                transition={{ delay: secret ? 0.5 : 0.15, duration: tier === "bronze" ? 0.4 : big ? 1.1 : 0.8, ease: [0.2, 0.8, 0.3, 1.15] }}
                style={{ display: "inline-block" }}
              >
                <Medal trophy={shown.trophy} won size={big ? 64 : 56} />
              </motion.span>
            ) : (
              <span className={styles.stack}>
                {shown.batch.slice(0, 4).map((x, i) => (
                  <motion.span key={x.id} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 400, damping: 15 }}>
                    <Medal trophy={x} won size={44} />
                  </motion.span>
                ))}
              </span>
            )}
            {tier !== "bronze" &&
              SPARKS.map((s, i) => (
                <motion.i
                  key={i}
                  className={styles.spark}
                  initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                  animate={{ x: Math.cos((s.a * Math.PI) / 180) * s.d, y: Math.sin((s.a * Math.PI) / 180) * s.d, scale: [0, 1.2, 0], opacity: [1, 1, 0] }}
                  transition={{ delay: 0.45 + (i % 3) * 0.06, duration: 0.8, ease: "easeOut" }}
                  aria-hidden
                >
                  ✦
                </motion.i>
              ))}
          </span>
          <span className={styles.toastText}>
            <small>
              {secret ? t("Secret découvert !", "Secret found!") : "batch" in shown ? t("Trophées débloqués !", "Trophies unlocked!") : t("Trophée débloqué !", "Trophy unlocked!")}
            </small>
            <b>{"trophy" in shown ? t(shown.trophy.name.fr, shown.trophy.name.en) : t(`${shown.batch.length} trophées d'un coup`, `${shown.batch.length} trophies at once`)}</b>
            <span>
              {"trophy" in shown
                ? trophyText(t(shown.trophy.desc.fr, shown.trophy.desc.en))
                : t("Ils t'attendent dans la Poké Ball de l'étagère.", "They're waiting in the Poké Ball on the shelf.")}
            </span>
            <em>
              {"trophy" in shown && `${tierName(tier, t)} · `}+{points} pts
            </em>
          </span>
          <span className={styles.toastTimer} style={{ animationDuration: `${STAY[tier]}ms` }} aria-hidden />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
