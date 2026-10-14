"use client";

import { useEffect, useState } from "react";
import type { SkinArt } from "@/lib/shop";
import { sfx } from "@/lib/sound";
import styles from "./PaintedRoom.module.css";

/** the first drop, then one every 70 to 150 s (sooner in dev, to see it) */
const FIRST = process.env.NODE_ENV === "production" ? 25_000 : 4_000;
const nextIn = () => 70_000 + Math.random() * 80_000;

/**
 * A skin's spider (Halloween): it lives in the cobweb, and now and then drops down its thread, sways a little, and climbs
 * back up. Not while something covers the room, nor in a hidden tab.
 */
export function SkinSpider({ spider, paused }: { spider: NonNullable<SkinArt["spider"]>; paused: boolean }) {
  const [drop, setDrop] = useState(0);
  useEffect(() => {
    if (paused) return;
    let timer = window.setTimeout(function go() {
      if (!document.hidden) {
        sfx.spider();
        setDrop((d) => d + 1);
      }
      timer = window.setTimeout(go, nextIn());
    }, FIRST);
    return () => clearTimeout(timer);
  }, [paused]);

  const fall = spider.drop - spider.top;
  return (
    <span
      key={drop}
      className={`${styles.spider} ${drop ? styles.spiderDrop : ""}`}
      style={{ left: spider.x - spider.w / 2, top: spider.top, width: spider.w, ["--fall" as string]: `${fall}px` }}
      aria-hidden
    >
      <span className={styles.spiderThread} />
      <span className={styles.spiderBody}>
        <img src={spider.src} width={spider.w} height={spider.h} alt="" draggable={false} />
      </span>
    </span>
  );
}
