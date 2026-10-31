"use client";

import { useEffect, useState } from "react";
import s from "./Shop.module.css";

/** midnight in Paris on that day (a French release: shops open that morning), as a timestamp */
function parisMidnight(day: string) {
  const utc = Date.parse(`${day}T00:00:00Z`);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(new Date(utc)));
  return utc - hour * 3_600_000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The release's countdown: days, hours, minutes, seconds (the days on yellow), each digit flipping as it changes. The
 * server draws the days alone (the page is the same for everyone); the rest comes with the first tick. French page: Paris
 * midnight; English one: the visitor's own midnight.
 */
export function Countdown({ day, days, lang }: { day: string; days: number; lang: "fr" | "en" }) {
  const fr = lang === "fr";
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const [y, m, d] = day.split("-").map(Number);
    const target = fr ? parisMidnight(day) : new Date(y, m - 1, d).getTime();
    const tick = () => setLeft(Math.max(0, Math.floor((target - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [day, fr]);
  const parts =
    left === null
      ? [days, null, null, null]
      : [Math.floor(left / 86400), Math.floor(left / 3600) % 24, Math.floor(left / 60) % 60, left % 60];
  const labels = fr ? ["JOURS", "H", "MIN", "S"] : ["DAYS", "HRS", "MIN", "SEC"];
  return (
    <div className={s.count} role="timer" aria-label={fr ? `Sortie dans ${days} jours` : `Out in ${days} days`}>
      {parts.map((v, i) => (
        <div key={labels[i]} className={i === 0 ? `${s.tile} ${s.days}` : s.tile} aria-hidden="true">
          {/* a new key on each change: the digit flips in again */}
          <b key={v ?? "-"}>{v === null ? "--" : pad(v)}</b>
          <small>{labels[i]}</small>
        </div>
      ))}
    </div>
  );
}
