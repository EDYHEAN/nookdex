"use client";

import { useEffect, useState } from "react";
import { lastName, legends, topScores, type Legend, type Score } from "@/lib/game/scores";
import { useT } from "@/lib/lang";
import styles from "./PaintedRoom.module.css";

/** first words a little after the room is calm, then now and then (Johan, 2026-10-17: draw the click to the Game Boy) */
const FIRST_MS = 12_000;
const SHOW_MS = 7_000;
const GAP_MS = 45_000;

/** a long nickname keeps its start: the bubble stays the Game Boy's size */
const short = (name: string) => (name.length > 12 ? name.slice(0, 11).trimEnd() + "…" : name);
/** the classic's last wave (lib/game/engine MAX_WAVE), written here: importing the engine would bring it into the room */
const LAST_WAVE = 300;

/**
 * The Game Boy talks: the classic ladder's number one of the month (else of all time), now and then, in a speech bubble
 * above it; and, once the Panthéon has names (game_hall), the first ones to reach the last wave. Computers only (on a
 * phone the Game Boy is out of frame); hidden while it's hovered (its tip shows then).
 */
export function GbBubble({ x, y, active }: { x: number; y: number; active: boolean }) {
  const t = useT();
  const [top, setTop] = useState<Score | null>(null);
  const [hall, setHall] = useState<Legend[]>([]);
  const [say, setSay] = useState(-1);

  useEffect(() => {
    if (!active || top) return;
    let gone = false;
    (async () => {
      const best = (await topScores("classic", "season", undefined, 1))?.[0] ?? (await topScores("classic", "all", undefined, 1))?.[0];
      if (!gone && best) setTop(best);
      const firsts = await legends();
      if (!gone && firsts?.length) setHall(firsts);
    })().catch(() => {});
    return () => {
      gone = true;
    };
  }, [active, top]);

  useEffect(() => {
    if (!active || !top) return;
    let n = 0;
    let timer = setTimeout(function next() {
      setSay(n++);
      timer = setTimeout(() => {
        setSay(-1);
        timer = setTimeout(next, GAP_MS);
      }, SHOW_MS);
    }, FIRST_MS);
    return () => {
      clearTimeout(timer);
      setSay(-1);
    };
  }, [active, top]);

  if (!top || say < 0) return null;
  const name = short(top.name);
  const mine = top.name === lastName("");
  const lines: [string, string][] = mine
    ? [
        [t("Toujours n°1 !", "Still number 1!"), t(`vague ${top.wave} · à défendre`, `wave ${top.wave} · defend it`)],
        [t(`${name}, t'es le boss`, `${name}, you're the boss`), t("on remet ça ?", "one more run?")],
      ]
    : [
        [name, t("est invaincu", "is unbeaten")],
        [t(`Vague ${top.wave}`, `Wave ${top.wave}`), t("qui dit mieux ?", "who beats it?")],
        [t(`Détrône ${name} !`, `Dethrone ${name}!`), t("clic pour jouer", "click to play")],
      ];
  // the Panthéon's first names open the round (the news first): "Fabio et Xibros, premiers à la vague 300"
  if (hall.length) {
    const [a, b] = hall.map((h) => short(h.name));
    const who = b ? t(`${a} et ${b}`, `${a} and ${b}`) : a;
    const what = b ? t(`premiers à la vague ${LAST_WAVE}`, `first to wave ${LAST_WAVE}`) : t(`1er à la vague ${LAST_WAVE}`, `first to wave ${LAST_WAVE}`);
    lines.unshift([who, what]);
  }
  const [head, sub] = lines[say % lines.length];
  return (
    <span key={say} className={styles.gbBubble} style={{ left: x, top: y }} aria-hidden>
      <span className={styles.gbBox}>
        <strong>
          <i>♛</i> {head}
        </strong>
        <span>{sub}</span>
      </span>
    </span>
  );
}
