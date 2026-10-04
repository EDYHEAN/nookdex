"use client";

import { useEffect, useState } from "react";
import { cardHistory } from "@/lib/history";
import { useLang } from "@/lib/lang";
import { cardCurrency, formatPrice } from "@/lib/price";
import { sfx } from "@/lib/sound";
import type { CardData } from "@/lib/types";
import styles from "./PriceChart.module.css";

const W = 300;
const H = 78;
const PAD = 6;

/**
 * The card's price day after day (its trend on its market, from the daily history): an ink line drawing itself, the
 * day's price under the finger or the mouse. Until there are two days, a word on when the curve started.
 */
export function PriceChart({ card }: { card: CardData }) {
  const lang = useLang();
  const t = (fr: string, en: string) => (lang === "en" ? en : fr);
  const [points, setPoints] = useState<{ day: string; price: number }[] | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let gone = false;
    cardHistory(card.id).then((p) => !gone && setPoints(p));
    return () => {
      gone = true;
      setPoints(null);
      setHover(null);
    };
  }, [card.id]);

  if (!points) return null;
  const date = (d: string, long = false) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", long ? { day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "short" });
  if (points.length < 2)
    return (
      <p className={styles.soon}>
        {points.length
          ? t(`Courbe des prix : on note le prix chaque jour depuis le ${date(points[0].day, true)}.`, `Price curve: noted every day since ${date(points[0].day, true)}.`)
          : t("Courbe des prix : pas encore de prix noté pour cette carte.", "Price curve: no price noted for this card yet.")}
      </p>
    );

  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || max || 1;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = (v: number) => (max === min ? H / 2 : H - PAD - ((v - min) / span) * (H - PAD * 2));
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  const first = prices[0];
  const last = prices[prices.length - 1];
  const change = first ? (last - first) / first : 0;
  const money = (n: number) => formatPrice(n, cardCurrency(card));
  const shown = hover ?? points.length - 1;

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round((((e.clientX - r.left) / r.width) * W - PAD) / ((W - PAD * 2) / (points.length - 1)));
    const next = Math.max(0, Math.min(points.length - 1, i));
    if (next !== hover) sfx.hover();
    setHover(next);
  };

  return (
    <figure className={styles.chart}>
      <figcaption>
        <span>{t("Évolution", "Price history")}</span>
        <b className={change > 0.005 ? styles.up : change < -0.005 ? styles.down : undefined}>
          {change > 0 ? "+" : ""}
          {(change * 100).toFixed(0)} % {t(`depuis le ${date(points[0].day)}`, `since ${date(points[0].day)}`)}
        </b>
      </figcaption>
      <div className={styles.plot}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={t(`Prix de ${money(first)} à ${money(last)}`, `Price from ${money(first)} to ${money(last)}`)}
      >
        <path className={styles.area} d={area} />
        <path key={card.id} className={styles.line} d={line} pathLength={1} />
        <line className={styles.cursor} x1={x(shown)} x2={x(shown)} y1={0} y2={H} />
      </svg>
        {/* the day's dot in HTML: the stretched drawing would make it an oval */}
        <i className={styles.dot} style={{ left: `${(x(shown) / W) * 100}%`, top: `${(y(points[shown].price) / H) * 100}%` }} />
      </div>
      <div className={styles.legend}>
        <span>
          {date(points[shown].day)} · <b>{money(points[shown].price)}</b>
        </span>
        <span>
          {t("min", "low")} {money(min)} · {t("max", "high")} {money(max)}
        </span>
      </div>
    </figure>
  );
}
