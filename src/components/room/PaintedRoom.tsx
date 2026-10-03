"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_BINDERS, pocketsOf, shelfBinders } from "@/lib/binders";
import { catalogSet, loadSet, useSets } from "@/lib/catalog";
import { copiesTotals, formatMoney, setStats } from "@/lib/price";
import { SCENE, sceneImg } from "@/lib/scene";
import { NAME_PARTS, OS_NAME } from "@/lib/site";
import { sfx, startAmbient, stopAmbient } from "@/lib/sound";
import { useStore } from "@/lib/store";
import type { BinderDef } from "@/lib/types";
import { useTotals } from "@/lib/useTotals";
import { useViewport } from "@/lib/useViewport";
import { LAVA_THEMES, drawDust, drawLava, drawRain, drawSunDust } from "./sceneAnim";
import { Monitor } from "./Monitor";
import { ShelfBinder, binderLabel, binderSize } from "./ShelfBinder";
import styles from "./PaintedRoom.module.css";
import { langLabel } from "@/lib/cardLang";
import { useLang, useT } from "@/lib/lang";

interface Props {
  openId: string | null;
  compact: boolean;
  /** a binder or the OS covers the room: stop animating it */
  paused: boolean;
  onOpen: (binder: BinderDef) => void;
  onOpenComputer: (rect: DOMRect) => void;
  /** the "+" at the end of the shelf */
  onAddBinder: () => void;
  /** the notebook among the books: "about" */
  onOpenAbout: () => void;
  /**
   * Under the loader: drawn and downloading, but invisible. Browsers count a hidden-behind picture as the page's
   * biggest paint (the 463 KB room on phones), not an invisible one.
   */
  veiled?: boolean;
  /** a phone's binder is open over it: faded out and not drawn, its big pictures and layers are memory the binder needs */
  behind?: boolean;
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
/** A binder shows its side cover when nothing stands on its right: end of a shelf, or of the row. */
const rowEnd = (i: number) => {
  const a = SCENE.slots[i];
  const b = SCENE.slots[i + 1];
  return !b || Math.abs(b.y - a.y) > 100;
};
/** The books at the end of the bottom shelf (scene px): one of them is the "about" notebook. */
const BOOKS = { x: 2378, y: 515, w: 305, h: 272 };
/** the cork board under the shelf, its sticky notes: the blog */
const BOARD = { x: 1944, y: 846, w: 328, h: 250 };
const SCREEN_QUAD = SCENE.screenQuad.map(([x, y]) => [x - SCENE.screen.x, y - SCENE.screen.y] as [number, number]);

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

export function PaintedRoom({ openId, compact, paused, onOpen, onOpenComputer, onAddBinder, onOpenAbout, veiled, behind }: Props) {
  const uiLang = useLang();
  const router = useRouter();
  /** "EN" on an English binder of the French site (and the other way round): the language it isn't in */
  const langTag = (b: BinderDef) => (b.lang && b.lang !== uiLang ? langLabel(b.lang, uiLang) : null);
  const tr = useT();
  const cam = useCamera(compact);
  const lampOn = useStore((s) => s.lampOn);
  const ambient = useStore((s) => s.ambient);
  const toggleLamp = useStore((s) => s.toggleLamp);
  const daytime = useStore((s) => s.daytime);
  const toggleDaytime = useStore((s) => s.toggleDaytime);
  const setAmbient = useStore((s) => s.setAmbient);
  const collection = useStore((s) => s.collection);
  const userBinders = useStore((s) => s.binders);
  const binders = useMemo(() => shelfBinders(userBinders), [userBinders]);
  const sets = useSets((s) => s.sets);
  const cards = useSets((s) => s.cards);

  const world = useRef<HTMLDivElement>(null);
  const fore = useRef<HTMLDivElement>(null);
  const rain = useRef<HTMLCanvasElement>(null);
  const lava = useRef<HTMLCanvasElement>(null);
  const dust = useRef<HTMLCanvasElement>(null);
  const sunDust = useRef<HTMLCanvasElement>(null);
  const sky = useRef<HTMLDivElement>(null);
  const lavaTheme = useRef(0);
  const lampRef = useRef(lampOn);
  const dayRef = useRef(daytime);
  useEffect(() => {
    lampRef.current = lampOn;
    dayRef.current = daytime;
  }, [lampOn, daytime]);

  const [tip, setTip] = useState<Tip | null>(null);
  const [pulling, setPulling] = useState<string | null>(null);
  const [shaking, setShaking] = useState<string | null>(null);
  const [returning, setReturning] = useState<string | null>(null);
  const [petting, setPetting] = useState(0);
  const [lavaIdx, setLavaIdx] = useState(0);
  const prevOpen = useRef<string | null>(null);
  const prevIds = useRef<string[] | null>(null);

  // A binder that was just added drops onto the shelf (the drop itself is its CSS entrance): its sound.
  useEffect(() => {
    const ids = binders.map((b) => b.id);
    const before = prevIds.current;
    prevIds.current = ids;
    if (!before || !ids.some((id) => !before.includes(id))) return;
    const t = setTimeout(() => sfx.shelfIn(), 250);
    return () => clearTimeout(t);
  }, [binders]);

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
    const sc = sunDust.current?.getContext("2d");
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
        // rain only at night, dust in the sunbeams only by day
        if (rc && !dayRef.current) drawRain(rc, t);
        if (lc) drawLava(lc, t, LAVA_THEMES[lavaTheme.current], SCENE.lavaRows);
        if (dc) drawDust(dc, t, lampRef.current);
        if (sc && dayRef.current) drawSunDust(sc, t);
      }
      const wt = `${(-cur.x * 16 + weave.x).toFixed(1)}px ${(-cur.y * 9 + weave.y).toFixed(1)}px`;
      if (world.current && world.current.style.translate !== wt) world.current.style.translate = wt;
      // the sky is far away: it moves less than the room behind the glass
      const st = `${(cur.x * 11).toFixed(1)}px ${(cur.y * 6).toFixed(1)}px`;
      if (sky.current && sky.current.style.translate !== st) sky.current.style.translate = st;
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

  const clickBinder = async (b: BinderDef) => {
    if (openId || pulling) return;
    if (b.setId && !sets[b.setId]) {
      setTip((t) => (t ? { ...t, sub: tr("on sort les cartes…", "getting the cards out…") } : t));
      try {
        await loadSet(b.setId);
      } catch {
        sfx.locked();
        setShaking(b.id);
        setTip((t) => (t ? { ...t, sub: tr("pas de réseau ? réessaie", "no network? try again") } : t));
        setTimeout(() => setShaking(null), 450);
        return;
      }
    }
    sfx.shelfOut();
    setPulling(b.id);
    setTip(null);
    setTimeout(() => onOpen(b), 200);
  };

  /** "112/245 cartes · 38 €" on a set binder, "12 cartes · 20 €" on a free one */
  const summary = (b: BinderDef) => {
    if (b.setId) {
      const set = sets[b.setId];
      if (!set) return { sub: `${b.code} · ${catalogTotal(b)} ${tr("cartes", "cards")}`, pct: null };
      const st = setStats(set, collection);
      return { sub: `${st.owned}/${st.total} ${tr("cartes", "cards")} · ${formatMoney(st.trend)}`, pct: st.total ? st.owned / st.total : 0 };
    }
    const items = [...pocketsOf(b.id, collection).values()].flatMap(({ cardId, copy }) => (cards[cardId] ? [{ card: cards[cardId], copies: [copy] }] : []));
    const t = copiesTotals(items);
    return { sub: t.cards ? `${t.cards} ${tr("carte", "card")}${t.cards > 1 ? "s" : ""} · ${formatMoney(t.trend)}` : tr("classeur libre · vide", "free binder · empty"), pct: null };
  };
  const plusSlot = binders.length < MAX_BINDERS ? SCENE.slots[binders.length] : null;
  /** the binder on its left shows its side cover over part of the sketch */
  const besideBinder = binders.length > 0 && !rowEnd(binders.length - 1);

  const sceneStyle = { width: W, height: H, transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})` };
  const place = (r: { x: number; y: number; w: number; h: number }) => ({ left: r.x, top: r.y, width: r.w, height: r.h });
  const lavaBox = SCENE.lavaBox;
  const lavaMask = `url(${sceneImg("lava-mask.png")})`;
  const windowMask = `url(${sceneImg("window-mask.png")})`;
  const glow = (r: { x: number; y: number; w: number; h: number }, pad: number) => ({ left: r.x - pad, top: r.y - pad, width: r.w + pad * 2, height: r.h + pad * 2 });
  const theme = LAVA_THEMES[lavaIdx];

  let binderIndex = 0;

  return (
    <div
      className={`${styles.stage} ${compact ? styles.compact : ""} ${paused ? styles.paused : ""}`}
      style={veiled ? { visibility: "hidden" } : behind ? { visibility: "hidden", opacity: 0, transition: "opacity 0.3s, visibility 0s 0.3s" } : { transition: "opacity 0.3s" }}
    >
      {compact && <CompactHeader />}

      <div className={styles.scene} style={sceneStyle}>
        <div ref={world} className={styles.layer}>
          {/* low priority: the loader's logo goes first */}
          {/* low priority: the loader's logo is fetched first */}
          <img className={styles.plate} src={sceneImg("plate.webp")} alt="" draggable={false} fetchPriority="low" />
          {/* the same room on a sunny afternoon, faded in over the rainy night */}
          <img className={`${styles.plate} ${styles.dayPlate} ${daytime ? "" : styles.off}`} src={sceneImg("day.webp")} alt="" draggable={false} fetchPriority="low" />

          {/* the sky behind the glass: night city in the rain, or sunny afternoon */}
          <div className={styles.sky} style={{ ...place(SCENE.window), maskImage: windowMask, WebkitMaskImage: windowMask }}>
            <div ref={sky} className={styles.skyMove}>
              <div className={styles.skyLayer} style={{ backgroundImage: `url(${sceneImg("sky.webp")})` }} />
              <div
                className={`${styles.skyLayer} ${styles.skyDay} ${daytime ? "" : styles.off}`}
                style={{ backgroundImage: `url(${sceneImg("sky-day.webp")})` }}
              />
            </div>
            <div className={`${styles.skyGlass} ${daytime ? styles.skyGlassDay : ""}`} />
          </div>

          {/* rain running down the window */}
          <canvas
            ref={rain}
            className={`${styles.rain} ${daytime ? styles.off : ""}`}
            width={Math.round(SCENE.window.w / 2)}
            height={Math.round(SCENE.window.h / 2)}
            style={{ ...place(SCENE.window), maskImage: windowMask, WebkitMaskImage: windowMask }}
          />

          {/* steam: the painted wisp, boiling like a hand-drawn loop. One per backdrop, each fading with its
              own room, so the switch never shows a patch of the other one. */}
          {(["plate.webp", "day.webp"] as const).map((file) => (
            <div key={file} className={`${styles.dayPlate} ${(file === "day.webp") === daytime ? "" : styles.off}`}>
              <div
                className={styles.steam}
                style={{
                  ...place(SCENE.steam),
                  backgroundImage: `url(${sceneImg(file)})`,
                  backgroundSize: `${W}px ${H}px`,
                  backgroundPosition: `${-SCENE.steam.x}px ${-SCENE.steam.y}px`,
                }}
              />
            </div>
          ))}

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
            style={place(SCENE.screen)}
            quad={SCREEN_QUAD}
            onHover={() => {
              sfx.hover();
              showTip(SCENE.screen.x + SCENE.screen.w / 2, SCENE.screen.y - 20, OS_NAME, tr("wishlist, doublons, recherche…", "wishlist, duplicates, search…"));
            }}
            onLeave={() => setTip(null)}
            onOpen={(rect) => {
              setTip(null);
              onOpenComputer(rect);
            }}
          />

          {/* a free place on the shelf: a pencil sketch of a binder, to add one (behind the side of its neighbour) */}
          {plusSlot && (
            <button
              key={`plus-${binders.length}`}
              className={`${styles.binder} ${styles.addSlot}`}
              style={place(plusSlot)}
              aria-label={tr("Ajouter un classeur", "Add a binder")}
              onPointerEnter={() => {
                sfx.hover();
                showTip(
                  plusSlot.x + plusSlot.w / 2,
                  plusSlot.y - 8,
                  tr("Nouveau classeur", "New binder"),
                  binders.length ? tr("une extension ou un classeur libre", "a set or a free binder") : tr("choisis ton premier classeur", "pick your first binder"),
                  plusSlot.y + plusSlot.h + 10,
                );
              }}
              onPointerLeave={() => setTip(null)}
              onClick={() => {
                sfx.pop();
                setTip(null);
                onAddBinder();
              }}
            >
              <span className={styles.addSketch}>
                <ShelfBinder slot={plusSlot} sketch />
              </span>
              <span className={styles.addPlus} style={besideBinder ? { left: "75%" } : undefined}>
                +
              </span>
            </button>
          )}

          {/* binders standing on the shelves, with the set logo on their label */}
          {binders.map((b) => {
            const slot = SCENE.slots[b.slot];
            const i = binderIndex++;
            const sum = summary(b);
            const cls = [
              styles.binder,
              (pulling === b.id || openId === b.id) && styles.out,
              returning === b.id && styles.returning,
              shaking === b.id && styles.shake,
            ]
              .filter(Boolean)
              .join(" ");
            const size = binderSize(slot);
            const label = binderLabel(size.w, size.h);
            return (
              <button
                key={b.id}
                className={cls}
                style={place(slot)}
                aria-label={langTag(b) ? `${b.name} · ${langTag(b)}` : b.name}
                onPointerEnter={() => {
                  sfx.spine(i);
                  showTip(slot.x + slot.w / 2, slot.y - 8, langTag(b) ? `${b.name} · ${langTag(b)}` : b.name, sum.sub, slot.y + slot.h + 10);
                }}
                onPointerLeave={() => setTip(null)}
                onClick={() => clickBinder(b)}
              >
                <ShelfBinder slot={slot} color={b.color} last={rowEnd(b.slot) || b.slot === binders.length - 1}>
                  <span
                    className={styles.label}
                    style={{ left: label.x, top: label.y, width: label.w, height: label.h }}
                  >
                    {b.logo ? (
                      <img src={`${b.logo}.png`} alt="" draggable={false} />
                    ) : (
                      <span className={styles.labelText} style={{ color: b.kind === "free" ? "#2b2230" : b.ink }}>
                        {b.kind === "free" ? b.name : b.code}
                      </span>
                    )}
                    {langTag(b) && <span className={styles.langTag}>{langTag(b)}</span>}
                    {sum.pct != null && (
                      <span className={styles.progress}>
                        <span style={{ height: `${sum.pct * 100}%` }} />
                      </span>
                    )}
                  </span>
                </ShelfBinder>
              </button>
            );
          })}

          {/* the lamp head passes in front of the lower binders */}
          <img className={styles.sprite} src={sceneImg("lamp-head.webp")} style={place(SCENE.lamp)} alt="" draggable={false} />
          <img
            className={`${styles.sprite} ${styles.dayPlate} ${daytime ? "" : styles.off}`}
            src={sceneImg("lamp-head-day.webp")}
            style={place(SCENE.lamp)}
            alt=""
            draggable={false}
          />

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

          {/* lamp off: the room's light as Gemini painted it at night, laid over everything painted so far */}
          <div
            className={`${styles.night} ${lampOn || daytime ? styles.off : ""}`}
            style={{ backgroundImage: `url(${sceneImg("night-light.webp")})` }}
          />

          {/* light (softer in daylight) */}
          <div className={`${styles.lights} ${daytime ? styles.daylight : ""}`}>
            <div className={styles.glow} style={{ ...glow(lavaBox, 110), background: `radial-gradient(closest-side, ${theme.glow}, transparent)` }} />
            <div className={`${styles.glow} ${styles.crt}`} style={glow(SCENE.screen, 120)} />
            <div className={`${styles.glow} ${styles.lampPool} ${lampOn ? "" : styles.off}`} style={{ left: 1650, top: 850, width: 1000, height: 500 }} />
            <div
              className={`${styles.glow} ${styles.bulb} ${lampOn ? "" : styles.off}`}
              style={{ left: SCENE.bulb.x - 110, top: SCENE.bulb.y - 110, width: 220, height: 220 }}
            />
          </div>
          <canvas ref={dust} className={styles.dust} width={500} height={300} />
          {/* dust floating in the sunbeams */}
          <canvas ref={sunDust} className={`${styles.sunDust} ${daytime ? "" : styles.off}`} width={650} height={400} />

          {/* hotspots */}
          <button
            className={styles.hotspot}
            style={place(SCENE.window)}
            aria-label={daytime ? tr("Fenêtre : passer à la nuit", "Window: switch to night") : tr("Fenêtre : passer au jour", "Window: switch to day")}
            onPointerEnter={() => {
              sfx.hover();
              showTip(SCENE.window.x + SCENE.window.w / 2, SCENE.window.y + 40, tr("Fenêtre", "Window"), daytime ? tr("clic : attendre la nuit", "click: wait for night") : tr("clic : faire lever le soleil", "click: let the sun rise"));
            }}
            onPointerLeave={() => setTip(null)}
            onClick={() => {
              sfx.dayNight(!daytime);
              toggleDaytime();
              showTip(SCENE.window.x + SCENE.window.w / 2, SCENE.window.y + 40, tr("Fenêtre", "Window"), !daytime ? tr("grand soleil ☀", "bright sun ☀") : tr("pluie de nuit ☾", "night rain ☾"));
            }}
          />
          <button
            className={styles.hotspot}
            style={place(SCENE.radio)}
            aria-label="Radio"
            onPointerEnter={() => {
              sfx.hover();
              showTip(SCENE.radio.x + SCENE.radio.w / 2, SCENE.radio.y, ambient ? "Radio lofi ♪" : "Radio", ambient ? tr("clic : couper", "click: stop") : tr("clic : lancer la musique", "click: play some music"));
            }}
            onPointerLeave={() => setTip(null)}
            onClick={() => {
              sfx.click();
              if (ambient) stopAmbient();
              else startAmbient();
              setAmbient(!ambient);
              showTip(SCENE.radio.x + SCENE.radio.w / 2, SCENE.radio.y, !ambient ? "Radio lofi ♪" : "Radio", !ambient ? (daytime ? tr("soleil & beats", "sun & beats") : tr("pluie & beats", "rain & beats")) : tr("silence…", "silence…"));
            }}
          />
          <button
            className={styles.hotspot}
            style={place(SCENE.lava)}
            aria-label={tr("Lampe à lave", "Lava lamp")}
            onPointerEnter={() => {
              sfx.hover();
              showTip(SCENE.lava.x + SCENE.lava.w / 2, SCENE.lava.y, tr("Lampe à lave", "Lava lamp"), tr("clic : changer la couleur", "click: change the colour"));
            }}
            onPointerLeave={() => setTip(null)}
            onClick={() => {
              sfx.bloop();
              const n = (lavaTheme.current + 1) % LAVA_THEMES.length;
              lavaTheme.current = n;
              setLavaIdx(n);
              showTip(SCENE.lava.x + SCENE.lava.w / 2, SCENE.lava.y, tr("Lampe à lave", "Lava lamp"), tr(LAVA_THEMES[n].name, LAVA_THEMES[n].nameEn));
            }}
          />
          {/* before the lamp: where the lamp's arm crosses the board, the lamp wins */}
          <button
            className={`${styles.hotspot} ${styles.bookSpot}`}
            style={place(BOARD)}
            aria-label={tr("Le tableau : le blog", "The pinboard: the blog")}
            onPointerEnter={() => {
              sfx.hover();
              showTip(BOARD.x + BOARD.w / 2, BOARD.y - 8, tr("Le tableau", "The pinboard"), tr("le blog : actus & prix du JCC", "the blog: TCG news & prices"));
            }}
            onPointerLeave={() => setTip(null)}
            onClick={() => {
              sfx.pop();
              setTip(null);
              router.push("/blog");
            }}
          />
          <button
            className={styles.hotspot}
            style={place(SCENE.lampHit)}
            aria-label={tr("Lampe", "Lamp")}
            onPointerEnter={() => {
              sfx.hover();
              showTip(SCENE.lampHit.x + SCENE.lampHit.w / 2, SCENE.lampHit.y, tr("Lampe", "Lamp"), lampOn ? tr("clic : éteindre", "click: switch off") : tr("clic : allumer", "click: switch on"));
            }}
            onPointerLeave={() => setTip(null)}
            onClick={() => {
              sfx.lamp();
              toggleLamp();
              showTip(SCENE.lampHit.x + SCENE.lampHit.w / 2, SCENE.lampHit.y, tr("Lampe", "Lamp"), !lampOn ? tr("ahh, la lumière", "ahh, light") : daytime ? tr("le soleil suffit", "the sun is enough") : tr("au clair de lune", "by moonlight"));
            }}
          />
          <button
            className={`${styles.hotspot} ${styles.bookSpot}`}
            style={place(BOOKS)}
            data-tour="about"
            aria-label={tr("Le carnet de Johan : à propos", "Johan's notebook: about")}
            onPointerEnter={() => {
              sfx.hover();
              showTip(BOOKS.x + BOOKS.w / 2, BOOKS.y - 8, tr("Le carnet", "The notebook"), tr("qui a fait ce bureau, et pourquoi", "who made this desk, and why"));
            }}
            onPointerLeave={() => setTip(null)}
            onClick={() => {
              sfx.coverOpen();
              setTip(null);
              onOpenAbout();
            }}
          />
          <button
            className={styles.hotspot}
            style={place(SCENE.catSleep)}
            aria-label={tr("Chat", "Cat")}
            onPointerEnter={() => {
              sfx.hover();
              showTip(SCENE.catSleep.x + SCENE.catSleep.w / 2, SCENE.catSleep.y, "Warwick", tr("le gardien du bureau", "keeper of the desk"));
            }}
            onPointerLeave={() => setTip(null)}
            onClick={() => {
              sfx.purr();
              const id = Date.now();
              setPetting(id);
              setTimeout(() => setPetting((p) => (p === id ? 0 : p)), 2600);
              showTip(SCENE.catSleep.x + SCENE.catSleep.w / 2, SCENE.catSleep.y, "Warwick", "rrrrrrr ♥");
            }}
          />
        </div>

        {/* foreground: the chair, closest to us */}
        <div ref={fore} className={styles.layer}>
          <img
            className={`${styles.sprite} ${styles.chair} ${daytime ? styles.chairDay : lampOn ? "" : styles.chairNight}`}
            src={sceneImg("chair.webp")}
            style={place(SCENE.chair)}
            alt=""
            draggable={false}
          />
        </div>
        <div className={styles.vignette} />
      </div>

      {tip && (
        <div key={tip.title + tip.x} className={`${styles.tip} ${tip.below ? styles.tipBelow : ""}`} style={{ left: tip.x, top: tip.y, ["--x" as string]: `${tip.x}px` }}>
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
  const tr = useT();
  const t = useTotals();
  return (
    <header className={styles.header}>
      <h1>
        {NAME_PARTS[0]}
        <span>{NAME_PARTS[1]}</span>
      </h1>
      <p>
        {t.total ? `${t.owned}/${t.total}` : t.cards} {tr("cartes", "cards")} · <b>{formatMoney(t.trend)}</b>
      </p>
    </header>
  );
}

const catalogTotal = (b: BinderDef) => (b.setId ? (catalogSet(b.setId)?.total ?? "?") : 0);
