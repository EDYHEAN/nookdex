"use client";

import { useEffect, useRef } from "react";
import styles from "./Grain.module.css";

const TILE = 256;

/** Light and dark specks with alpha: plain alpha blending, no blend mode to recomposite. */
function noiseTile(): string {
  const c = document.createElement("canvas");
  c.width = c.height = TILE;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(TILE, TILE);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random();
    const light = v > 0.5;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = light ? 255 : 0;
    img.data[i + 3] = Math.abs(v - 0.5) * 2 * 26;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

/**
 * Film grain + faint projector flicker over the whole site at 12 fps.
 * The noise is painted once; each frame only moves the layer (GPU compositing, no repaint).
 */
export function Grain() {
  const grain = useRef<HTMLDivElement>(null);
  const flicker = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (grain.current) grain.current.style.backgroundImage = `url(${noiseTile()})`;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      const x = Math.floor(Math.random() * TILE);
      const y = Math.floor(Math.random() * TILE);
      if (grain.current) grain.current.style.transform = `translate(${-x}px, ${-y}px)`;
      if (flicker.current) flicker.current.style.opacity = (Math.random() * 0.035).toFixed(3);
    }, 83);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={styles.wrap} aria-hidden>
      <div ref={flicker} className={styles.flicker} />
      <div ref={grain} className={styles.grain} />
    </div>
  );
}
