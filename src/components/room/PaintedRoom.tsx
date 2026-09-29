"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BINDERS } from "@/lib/binders";
import { formatEur, setStats } from "@/lib/price";
import { SCENE, binderSlot, sceneImg } from "@/lib/scene";
import { sfx, startAmbient, stopAmbient } from "@/lib/sound";
import { useStore } from "@/lib/store";
import type { BinderDef } from "@/lib/types";
import { useViewport } from "@/lib/useViewport";
import { LAVA_THEMES, drawDust, drawLava, drawRain } from "./sceneAnim";
import { Monitor } from "./Monitor";
import styles from "./PaintedRoom.module.css";

interface Props {
  openId: string | null;
  compact: boolean;
  /** a binder or the OS covers the room: stop animating it */
  paused: boolean;
  onOpen: (binder: BinderDef) => void;
  onOpenComputer: (rect: DOMRect) => void;
}

interface Tip {
  x: number;
  y: number;
  /** shown under the element when there is no room above it */
  below?: boolean;
  title: string;
  sub?: string;
}

const { width: W, height: H } = SCENE;
/** On phones the camera frames the shelves. */
const FOCUS = { x: 1735, w: 850 };
const HEADER = 92;
const ANIM_FPS = 12;

function useCamera(compact: boolean) {
  const vp = useViewport();
  return useMemo(() => {
    if (!compact) {
      const contain = Math.min(vp.w / W, vp.h / H);
      const k = Math.min(Math.max(vp.w / W, vp.h / H), contain * 1.08) * 1.03; // a bit of margin for the parallax
      return { k, x: (vp.w - W * k) / 2, y: (vp.h - H * k) / 2 };
    }
    const k = Math.min(vp.w / FOCUS.w, (vp.h - HEADER) / H);
    return { k, x: vp.w / 2 - (FOCUS.x + FOCUS.w / 2) * k, y: HEADER + (vp.h - HEADER - H * k) / 2 };
  }, [vp.w, vp.h, compact]);
}

export function PaintedRoom({ openId, compact, paused, onOpen, onOpenComputer }: Props) {
  const cam = useCamera(compact);
  const lampOn = useStore((s) => s.lampOn);
  const ambient = useStore((s) => s.ambient);
  const toggleLamp = useStore((s) => s.toggleLamp);
  const setAmbient = useStore((s) => s.setAmbient);
  const collection = useStore((s) => s.collection);

  const world = useRef<HTMLDivElement>(null);
  const fore = useRef<HTMLDivElement>(null);
  const rain = useRef<HTMLCanvasElement>(null);
  const lava = useRef<HTMLCanvasElement>(null);
  const dust = useRef<HTMLCanvasElement>(null);
  const lavaTheme = useRef(0);
  const lampRef = useRef(lampOn);
  useEffect(() => {
    lampRef.current = lampOn;
  }, [lampOn]);

  const [tip, setTip] = useState<Tip | null>(null);
  const [pulling, setPulling] = useState<string | null>(null);
  const [shaking, setShaking] = useState<string | null>(null);
  const [returning, setReturning] = useState<string | null>(null);
  const [petting, setPetting] = useState(0);
  const [lavaIdx, setLavaIdx] = useState(0);
  const prevOpen = useRef<string | null>(null);

  // The binder that was just put back slides into the shelf.
  useEffect(() => {
    if (prevOpen.current && !openId) {
      const id = prevOpen.current;
      setReturning(id);
      setPulling(null);
      sfx.shelfIn();
      const t = setTimeout(() => setReturning(null), 700);
      prevOpen.current = openId;
      return () => clearTimeout(t);
    }
    prevOpen.current = openId;
  }, [openId]);

  // Camera drift (parallax + a hint of film gate weave) and the 12 fps painted animations.
  useEffect(() => {
    if (paused) return;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      target.x = e.clientX / window.innerWidth - 0.5;
      target.y = e.clientY / window.innerHeight - 0.5;
    };
    if (!compact) window.addEventListener("pointermove", onMove);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rc = rain.current?.getContext("2d");
    const lc = lava.current?.getContext("2d");
    const dc = dust.current?.getContext("2d");
    let raf = 0;
    let last = 0;
    let weave = { x: 0, y: 0 };
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      cur.x += (target.x - cur.x) * 0.06;
      cur.y += (target.y - cur.y) * 0.06;
      if (t - last >= 1000 / ANIM_FPS) {
        last = t;
        if (!reduced) weave = { x: (Math.random() - 0.5) * 0.9, y: (Math.random() - 0.5) * 0.9 };
        if (rc) drawRain(rc, t);
        if (lc) drawLava(lc, t, LAVA_THEMES[lavaTheme.current], SCENE.lavaRows);
        if (dc) drawDust(dc, t, lampRef.current);
      }
      const wt = `${(-cur.x * 16 + weave.x).toFixed(1)}px ${(-cur.y * 9 + weave.y).toFixed(1)}px`;
      if (world.current && world.current.style.translate !== wt) world.current.style.translate = wt;
      const ft = `${(-cur.x * 46 + weave.x).toFixed(1)}px ${(-cur.y * 18 + weave.y).toFixed(1)}px`;
      if (fore.current && fore.current.style.translate !== ft) fore.current.style.translate = ft;
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, [compact, paused]);

  /** scene pixel -> screen pixel (tooltips live outside the scaled scene to stay crisp) */
  const toScreen = (x: number, y: number) => ({ x: cam.x + x * cam.k, y: cam.y + y * cam.k });
  const showTip = (x: number, y: number, title: string, sub?: string, bottom?: number) => {
    const p = toScreen(x, y);
    if (p.y < 90 && bottom != null) setTip({ ...toScreen(x, bottom), below: true, title, sub });
    else setTip({ ...p, title, sub });
  };

  const clickBinder = (b: BinderDef) => {
    if (!b.set) {
      sfx.locked();
      setShaking(b.id);
      setTip((t) => (t ? { ...t, sub: "Bientôt dans ta collec…" } : t));
      setTimeout(() => setShaking(null), 450);
      return;
    }
    if (openId || pulling) return;
    sfx.shelfOut();
    setPulling(b.id);
    setTip(null);
    setTimeout(() => onOpen(b), 200);
  };

  const sceneStyle = { width: W, height: H, transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})` };
  const place = (r: { x: number; y: number; w: number; h: number }) => ({ left: r.x, top: r.y, width: r.w, height: r.h });
  const lavaBox = SCENE.lavaBox;
  const lavaMask = `url(${sceneImg("lava-mask.png")})`;
  const glow = (r: { x: number; y: number; w: number; h: number }, pad: number) => ({ left: r.x - pad, top: r.y - pad, width: r.w + pad * 2, height: r.h + pad * 2 });
  const theme = LAVA_THEMES[lavaIdx];

  let binderIndex = 0;

  return (
    <div className={`${styles.stage} ${compact ? styles.compact : ""} ${paused ? styles.paused : ""}`}>
      {compact && <CompactHeader />}

      <div className={styles.scene} style={sceneStyle}>
        <div ref={world} className={styles.layer}>
          <img className={styles.plate} src={sceneImg("plate.webp")} alt="" draggable={false} />

          {/* rain running down the window */}
          <canvas
            ref={rain}
            className={styles.rain}
            width={Math.round(SCENE.window.w / 2)}
            height={Math.round(SCENE.window.h / 2)}
            style={{ ...place(SCENE.window), maskImage: `url(${sceneImg("window-mask.png")})`, WebkitMaskImage: `url(${sceneImg("window-mask.png")})` }}
          />

          {/* steam: the painted wisp, boiling like a hand-drawn loop */}
          <div
            className={styles.steam}
            style={{
              ...place(SCENE.steam),
              backgroundImage: `url(${sceneImg("plate.webp")})`,
              backgroundSize: `${W}px ${H}px`,
              backgroundPosition: `${-SCENE.steam.x}px ${-SCENE.steam.y}px`,
            }}
          />

          {/* lava lamp: blobs drawn in code inside the painted glass */}
          <canvas
            ref={lava}
            className={styles.lava}
            width={lavaBox.w}
            height={lavaBox.h}
            style={{ ...place(lavaBox), maskImage: lavaMask, WebkitMaskImage: lavaMask }}
          />

          <Clock />

          <Monitor
            style={{ ...place(SCENE.screen), borderRadius: SCENE.screen.r }}
            onHover={() => {
              sfx.hover();
              showTip(SCENE.screen.x + SCENE.screen.w / 2, SCENE.screen.y - 20, "PokéPocket OS", "wishlist, doublons, recherche…");
            }}
            onLeave={() => setTip(null)}
            onOpen={(rect) => {
              setTip(null);
              onOpenComputer(rect);
            }}
          />

          {/* binders, painted on the shelves, with the set logo on their label */}
          {BINDERS.map((b) => {
            const slot = binderSlot(b.slot);
            const i = binderIndex++;
            const stats = b.set ? setStats(b.set, collection) : null;
            const cls = [
              styles.binder,
              !b.set && styles.placeholder,
              (pulling === b.id || openId === b.id) && styles.out,
              returning === b.id && styles.returning,
              shaking === b.id && styles.shake,
            ]
              .filter(Boolean)
              .join(" ");
            const label = slot.label;
            return (
              <button
                key={b.id}
                className={cls}
                style={place(slot.rect)}
                aria-label={b.name}
                onPointerEnter={() => {
                  sfx.spine(i);
                  showTip(
                    slot.rect.x + slot.rect.w / 2,
                    slot.rect.y - 8,
                    b.name,
                    stats ? `${stats.owned}/${stats.total} cartes · ${formatEur(stats.trend)}` : `${b.code} · classeur vide`,
                    slot.rect.y + slot.rect.h + 10,
                  );
                }}
                onPointerLeave={() => setTip(null)}
                onClick={() => clickBinder(b)}
              >
                <img src={sceneImg(slot.file)} alt="" draggable={false} />
                <span
                  className={styles.label}
                  style={{ left: label.x - slot.rect.x, top: label.y - slot.rect.y, width: label.w, height: label.h }}
                >
                  <img src={`${b.logo}.png`} alt="" draggable={false} />
                  {stats && (
                    <span className={styles.progress}>
                      <span style={{ height: `${(stats.owned / stats.total) * 100}%` }} />
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          {/* the lamp head passes in front of the lower binders */}
          <img className={styles.sprite} src={sceneImg("lamp-head.webp")} style={place(SCENE.lamp)} alt="" draggable={false} />

          {/* cat */}
          <img
            className={`${styles.sprite} ${styles.catSleep} ${petting ? styles.hidden : ""}`}
            src={sceneImg("cat-sleep.webp")}
            style={place(SCENE.catSleep)}
            alt=""
            draggable={false}
          />
          <img
            className={`${styles.sprite} ${styles.catAwake} ${petting ? "" : styles.hidden}`}
            src={sceneImg("cat-awake.webp")}
            style={place(SCENE.catAwake)}
            alt=""
            draggable={false}
          />
          {!petting && <span className={styles.zzz} style={{ left: SCENE.catSleep.x + 70, top: SCENE.catSleep.y - 20 }} aria-hidden>z</span>}
          {petting > 0 && (
            <span key={petting} className={styles.hearts} style={{ left: SCENE.catAwake.x + 120, top: SCENE.catAwake.y }} aria-hidden>
              <i>♥</i>
              <i>♥</i>
              <i>♥</i>
            </span>
          )}

          {ambient && (
            <span className={styles.notes} style={{ left: SCENE.radio.x + 120, top: SCENE.radio.y - 30 }} aria-hidden>
              <i>♪</i>
              <i>♫</i>
              <i>♪</i>
            </span>
          )}

          {/* light */}
          <div className={styles.glow} style={{ ...glow(lavaBox, 110), background: `radial-gradient(closest-side, ${theme.glow}, transparent)` }} />
          <div className={`${styles.glow} ${styles.crt}`} style={glow(SCENE.screen, 120)} />
          <div className={`${styles.glow} ${styles.lampPool} ${lampOn ? "" : styles.off}`} style={{ left: 1650, top: 850, width: 1000, height: 500 }} />
          <div
            className={`${styles.glow} ${styles.bulb} ${lampOn ? "" : styles.off}`}
            style={{ left: SCENE.bulb.x - 110, top: SCENE.bulb.y - 110, width: 220, height: 220 }}
          />
          <div className={`${styles.night} ${lampOn ? styles.off : ""}`} />
          <canvas ref={dust} className={styles.dust} width={500} height={300} />

          {/* hotspots */}
          <button
            className={styles.hotspot}
            style={place(SCENE.radio)}
            aria-label="Radio"
            onPointerEnter={() => {
              sfx.hover();
              showTip(SCENE.radio.x + SCENE.radio.w / 2, SCENE.radio.y, ambient ? "Radio lofi ♪" : "Radio", ambient ? "clic : couper" : "clic : lancer la musique");
            }}
            onPointerLeave={() => setTip(null)}
            onClick={() => {
              sfx.click();
              if (ambient) stopAmbient();
              else startAmbient();
              setAmbient(!ambient);
              showTip(SCENE.radio.x + SCENE.radio.w / 2, SCENE.radio.y, !ambient ? "Radio lofi ♪" : "Radio", !ambient ? "pluie & beats" : "silence…");
            }}
          />
          <button
            className={styles.hotspot}
            style={place(SCENE.lava)}
            aria-label="Lampe à lave"
            onPointerEnter={() => {
              sfx.hover();
              showTip(SCENE.lava.x + SCENE.lava.w / 2, SCENE.lava.y, "Lampe à lave", "clic : changer la couleur");
            }}
            onPointerLeave={() => setTip(null)}
            onClick={() => {
              sfx.bloop();
              const n = (lavaTheme.current + 1) % LAVA_THEMES.length;
              lavaTheme.current = n;
              setLavaIdx(n);
              showTip(SCENE.lava.x + SCENE.lava.w / 2, SCENE.lava.y, "Lampe à lave", LAVA_THEMES[n].name);
            }}
          />
          <button
            className={styles.hotspot}
            style={place(SCENE.lampHit)}
            aria-label="Lampe"
            onPointerEnter={() => {
              sfx.hover();
              showTip(SCENE.lampHit.x + SCENE.lampHit.w / 2, SCENE.lampHit.y, "Lampe", lampOn ? "clic : éteindre" : "clic : allumer");
            }}
            onPointerLeave={() => setTip(null)}
            onClick={() => {
              sfx.lamp();
              toggleLamp();
              showTip(SCENE.lampHit.x + SCENE.lampHit.w / 2, SCENE.lampHit.y, "Lampe", !lampOn ? "ahh, la lumière" : "mode nuit");
            }}
          />
          <button
            className={styles.hotspot}
            style={place(SCENE.catSleep)}
            aria-label="Chat"
            onPointerEnter={() => {
              sfx.hover();
              showTip(SCENE.catSleep.x + SCENE.catSleep.w / 2, SCENE.catSleep.y, "Pixel", "le gardien du bureau");
            }}
            onPointerLeave={() => setTip(null)}
            onClick={() => {
              sfx.purr();
              const id = Date.now();
              setPetting(id);
              setTimeout(() => setPetting((p) => (p === id ? 0 : p)), 2600);
              showTip(SCENE.catSleep.x + SCENE.catSleep.w / 2, SCENE.catSleep.y, "Pixel", "rrrrrrr ♥");
            }}
          />
        </div>

        {/* foreground: the chair, closest to us */}
        <div ref={fore} className={styles.layer}>
          <img className={`${styles.sprite} ${styles.chair}`} src={sceneImg("chair.webp")} style={place(SCENE.chair)} alt="" draggable={false} />
        </div>
        <div className={styles.vignette} />
      </div>

      {tip && (
        <div key={tip.title + tip.x} className={`${styles.tip} ${tip.below ? styles.tipBelow : ""}`} style={{ left: tip.x, top: tip.y }}>
          <strong>{tip.title}</strong>
          {tip.sub && <span>{tip.sub}</span>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const { x, y, rx, ry } = SCENE.clock;
  const s = now.getSeconds();
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  const hand = (turn: number, len: number) => {
    const a = turn * Math.PI * 2;
    return { x2: Math.sin(a) * len, y2: -Math.cos(a) * len };
  };
  return (
    <svg className={styles.clock} style={{ left: x - 110, top: y - 110 }} width={220} height={220} viewBox="-110 -110 220 220" aria-hidden>
      <g transform={`scale(${rx / ry} 1)`}>
        <line x1={0} y1={0} {...hand(h / 12, ry * 0.45)} stroke="#2e2733" strokeWidth={11} strokeLinecap="round" />
        <line x1={0} y1={0} {...hand(m / 60, ry * 0.7)} stroke="#2e2733" strokeWidth={8} strokeLinecap="round" />
        <line x1={0} y1={0} {...hand(s / 60, ry * 0.72)} stroke="#c23b32" strokeWidth={3} strokeLinecap="round" />
        <circle r={8} fill="#2e2733" />
        <circle r={3} fill="#c23b32" />
      </g>
    </svg>
  );
}

function CompactHeader() {
  const collection = useStore((s) => s.collection);
  const t = useMemo(() => {
    let owned = 0, total = 0, trend = 0;
    for (const b of BINDERS) {
      if (!b.set) continue;
      const s = setStats(b.set, collection);
      owned += s.owned;
      total += s.total;
      trend += s.trend;
    }
    return { owned, total, trend };
  }, [collection]);
  return (
    <header className={styles.header}>
      <h1>
        Poké<span>Pocket</span>
      </h1>
      <p>
        {t.owned}/{t.total} cartes · <b>{formatEur(t.trend)}</b>
      </p>
    </header>
  );
}
