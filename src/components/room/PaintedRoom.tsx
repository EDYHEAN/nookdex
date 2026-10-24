"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import POSTERS from "@/data/posters.json";
import { type CSSProperties, memo, useEffect, useMemo, useRef, useState } from "react";
import { MAX_BINDERS, SHELF_LEAD, boxOf, shelfPlace, pocketsOf, shelfBinders, shelfPageCount, wantsOf } from "@/lib/binders";
import { catalogSet, loadSet, useSets } from "@/lib/catalog";
import { copiesTotals, formatMoney, setStats } from "@/lib/price";
import { SCENE, quadMatrix, sceneImg } from "@/lib/scene";
import { NAME_PARTS, OS_NAME } from "@/lib/site";
import { setAmbientMood, sfx, startAmbient, stopAmbient } from "@/lib/sound";
import { useLook, type LavaTheme } from "@/lib/shop";
import { useWantAsk } from "@/lib/calm";
import { openPinned, useCourrier } from "@/lib/courrier";
import { useTradeShelf } from "@/lib/share";
import { useStore } from "@/lib/store";
import { TROPHIES } from "@/lib/trophies";
import { bump, unlock, useTrophyStore } from "@/lib/trophyStore";
import type { BinderDef } from "@/lib/types";
import { useTotals } from "@/lib/useTotals";
import { useViewport } from "@/lib/useViewport";
import { LAVA_THEMES, drawDust, drawLava, drawRain, drawSpooky, drawSunDust } from "./sceneAnim";
import { GbBubble } from "./GbBubble";
import { Monitor } from "./Monitor";
import { SkinSpider } from "./SkinSpider";
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
  /** the Poké Ball on the top shelf: the trophy case (where the ball is on screen) */
  onOpenTrophies: (at: { x: number; y: number }) => void;
  /** the purple box next to it: the cards no binder holds */
  onOpenBox: (at: { x: number; y: number }) => void;
  /** the Game Boy on the desk: the NookBoy game (computers only) */
  onOpenGame: (at: { x: number; y: number }) => void;
  /** the gold binder first on the shelf: the trade binder (share/TradeBinder) */
  onOpenTrade: () => void;
  /** the room is calm and nothing else asked this visit: the trade binder's note may show (once ever) */
  noteCalm: boolean;
  /** the note showed: the other pop-ins wait for another visit */
  onTradeAsked: () => boolean;
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
/** the Poké Ball on its stand, top shelf: the trophy case */
const BALL = { x: 2372, y: 204, w: 128, h: 156, cx: 2435, cy: 267 };
/**
 * The trade binder (Johan, 2026-10-23): gold, every player's from the start, in the shelf's first place (top shelf, page 1;
 * lib/binders SHELF_LEAD moves the player's binders one place on). Drawn like every binder (ShelfBinder).
 */
const TRADE = SCENE.slots[0];
const TRADE_GOLD = "#f0b929";
const TRADE_LABEL = (({ x, y, w, h }) => ({ left: x, top: y, width: w, height: h }))(binderLabel(TRADE.w, TRADE.h));
const TRADE_NOTE_KEY = "nookdex:trade-binder-note";
const readNote = () => {
  try {
    return !!localStorage.getItem(TRADE_NOTE_KEY);
  } catch {
    return true;
  }
};
/** the purple box beside it: the cards no binder holds; its tan label (LABEL) shows how many */
const BOX = { x: 2522, y: 202, w: 216, h: 138, cx: 2630, cy: 270 };
const BOX_LABEL = { cx: 2607, cy: 273 };
/** the shelf's page tag, hanging under the bottom shelf (more than 12 binders: the shelf turns its pages) */
const PAGER = { cx: 1912, y: 790 };
const PAGE_KEY = "nookdex:shelf-page";
const readPage = () => {
  try {
    return Number(localStorage.getItem(PAGE_KEY)) || 0;
  } catch {
    return 0;
  }
};
/**
 * The poster above the desk (Johan, 2026-10-19): the player's pick, clicked through like the lava lamp. Each one is pasted
 * into the painted poster by scripts/build-posters.mjs (its torn corner and tape kept, lit like the paper around it), for
 * the night plate and the day one; the first replaces the painted Poké Ball. Kept on this device.
 */
const POSTER_BOX = POSTERS.box;
const POSTER_HIT = { x: 1105, y: 195, w: 300, h: 470 };
const POSTER_NAMES: Record<string, [string, string]> = {
  moon: ["Nuit de lune", "Moonlit night"],
  rain: ["Pluie en ville", "City rain"],
  lake: ["Lac de montagne", "Mountain lake"],
  cat: ["Accroche-toi !", "Hang in there!"],
  nookboy: ["La NookBoy", "The NookBoy"],
  fair: ["Le salon des cartes", "The card fair"],
  map: ["Carte du monde", "World map"],
  sakura: ["Cerisiers en fleurs", "Cherry blossoms"],
};
const POSTER_KEY = "nookdex:poster";
const readPoster = () => {
  try {
    const id = localStorage.getItem(POSTER_KEY);
    return id && POSTERS.ids.includes(id) ? id : POSTERS.ids[0];
  } catch {
    return POSTERS.ids[0];
  }
};
/** the Game Boy by the mug, and its little screen: the NookBoy game */
const GAMEBOY = { x: 1427, y: 932, w: 120, h: 178 };
const GB_SCREEN = { x: 1461, y: 958, w: 58, h: 52 };
/** the corners of its glass (TL, TR, BR, BL), measured on the plate: the console leans a little, its loop follows */
const GB_GLASS: [number, number][] = [[1462.5, 962], [1514.5, 960.5], [1517.5, 1007], [1464, 1008.5]];
/** the loop is drawn flat on 56x52, then projected onto the glass */
const GB_LCD = quadMatrix(56, 52, GB_GLASS.map(([x, y]) => [x - GB_SCREEN.x, y - GB_SCREEN.y] as [number, number]));
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

/**
 * Drawn again only when what it shows changes: its callbacks only set App's state (stable setters), so a panel opening
 * over the room (the shop, the trophy case…) doesn't redraw it before the panel shows.
 */
export const PaintedRoom = memo(
  PaintedRoomView,
  (a, b) =>
    a.openId === b.openId && a.compact === b.compact && a.paused === b.paused && a.veiled === b.veiled && a.behind === b.behind && a.noteCalm === b.noteCalm,
);

function PaintedRoomView({
  openId,
  compact,
  paused,
  onOpen,
  onOpenComputer,
  onAddBinder,
  onOpenAbout,
  onOpenTrophies,
  onOpenBox,
  onOpenGame,
  onOpenTrade,
  noteCalm,
  onTradeAsked,
  veiled,
  behind,
}: Props) {
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
  // The backdrop that isn't showing (plate, sky, poster: ~570 KB) is only fetched once the room is in view and idle: on a
  // phone the pictures of both times of day competed for the line.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    if (veiled || warm) return;
    const go = () => setWarm(true);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(go, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(go, 2000);
    return () => clearTimeout(id);
  }, [veiled, warm]);
  const showNight = !daytime || warm;
  const showDay = daytime || warm;
  const toggleDaytime = useStore((s) => s.toggleDaytime);
  const setAmbient = useStore((s) => s.setAmbient);
  const collection = useStore((s) => s.collection);
  const userBinders = useStore((s) => s.binders);
  const binders = useMemo(() => shelfBinders(userBinders), [userBinders]);
  // the shelf's page (12 binders a page), kept per device
  const pages = shelfPageCount(binders.length);
  const [pageWanted, setPageWanted] = useState(readPage);
  const page = Math.min(pageWanted, pages - 1);
  /** the page was just turned: its binders drop in one after the other, a wave along the shelves */
  const [wave, setWave] = useState(false);
  useEffect(() => {
    if (!wave) return;
    const id = setTimeout(() => setWave(false), 1600);
    return () => clearTimeout(id);
  }, [wave]);
  const turnPage = (p: number) => {
    if (p !== page) setWave(true);
    setPageWanted(p);
    try {
      localStorage.setItem(PAGE_KEY, String(p));
    } catch {}
  };
  const sets = useSets((s) => s.sets);
  const cards = useSets((s) => s.cards);

  const world = useRef<HTMLDivElement>(null);
  const fore = useRef<HTMLDivElement>(null);
  const rain = useRef<HTMLCanvasElement>(null);
  const lava = useRef<HTMLCanvasElement>(null);
  const dust = useRef<HTMLCanvasElement>(null);
  const sunDust = useRef<HTMLCanvasElement>(null);
  /** a skin's particles (Halloween: embers and wisps), only there while it's worn */
  const spooky = useRef<HTMLCanvasElement>(null);
  const sky = useRef<HTMLDivElement>(null);
  const lavaTheme = useRef(0);
  /** the shop's items worn (lib/shop): their pictures over the room, a lava colour first in the lamp's cycle */
  const skin = useLook();
  const skinLava = skin?.lava;
  const lavaThemes = useMemo<LavaTheme[]>(() => (skinLava ? [skinLava, ...LAVA_THEMES] : LAVA_THEMES), [skinLava]);
  const themesRef = useRef(lavaThemes);
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
  const [poster, setPoster] = useState(readPoster);
  /** a glint across the poster each time it changes (none on load) */
  const [posterGlint, setPosterGlint] = useState(0);
  // a skin put on or taken off: the lamp starts again on the first colour of its cycle
  const [themesSeen, setThemesSeen] = useState(lavaThemes);
  if (themesSeen !== lavaThemes) {
    setThemesSeen(lavaThemes);
    setLavaIdx(0);
  }
  useEffect(() => {
    themesRef.current = lavaThemes;
    lavaTheme.current = 0;
  }, [lavaThemes]);
  // the radio plays the skin's tune
  const skinMusic = skin?.music ?? "lofi";
  useEffect(() => setAmbientMood(skinMusic), [skinMusic]);
  const won = useTrophyStore((s) => s.got);
  const fresh = useTrophyStore((s) => Object.values(s.got).filter((at) => at > s.seenAt).length);
  const [ballHover, setBallHover] = useState(false);
  const [boxHover, setBoxHover] = useState(false);
  const inBox = useMemo(() => boxOf(collection, userBinders).reduce((n, g) => n + g.count, 0), [collection, userBinders]);
  const trade = useTradeShelf();
  /** the letters read (room/Courrier), pinned on the cork board */
  const pins = useCourrier((s) => s.pins);
  /**
   * Its taped note, once ever (per device): « Ton classeur d'échange est là ! », only in a calm room where nothing else
   * asked this visit (App: the account, the cat, the road log wait for another one once it showed).
   */
  const [noteSeen, setNoteSeen] = useState(readNote);
  const [noteUp, setNoteUp] = useState(false);
  // its note would show this visit: the asks after it (the strip, the road log, the cat) hold back (lib/calm)
  useWantAsk("trade-note", !noteSeen && !noteUp && trade.ready);
  useEffect(() => {
    if (noteSeen || noteUp || !noteCalm || !trade.ready || page !== 0) return;
    const t = setTimeout(() => {
      // another ask had this visit's turn (lib/calm): the note waits for another visit
      if (!onTradeAsked()) return;
      setNoteUp(true);
      sfx.pop();
    }, 1800);
    return () => clearTimeout(t);
  }, [noteSeen, noteUp, noteCalm, trade.ready, page, onTradeAsked]);
  const closeNote = () => {
    setNoteUp(false);
    setNoteSeen(true);
    try {
      localStorage.setItem(TRADE_NOTE_KEY, "1");
    } catch {}
  };
  /** the room's little games: a scale on the spines, the weather flipped on and on */
  const scale = useRef({ last: -1, t: 0, n: 0 });
  const weather = useRef({ t: 0, n: 0 });
  const prevOpen = useRef<string | null>(null);
  const prevIds = useRef<string[] | null>(null);

  // A binder that was just added drops onto the shelf (the drop itself is its CSS entrance): its sound.
  useEffect(() => {
    const ids = binders.map((b) => b.id);
    const before = prevIds.current;
    prevIds.current = ids;
    if (!before || !ids.some((id) => !before.includes(id))) return;
    const added = binders.find((b) => !before.includes(b.id));
    // the shelf turns to its page (kept like a turn by hand)
    if (added) {
      setPageWanted(added.page);
      try {
        localStorage.setItem(PAGE_KEY, String(added.page));
      } catch {}
    }
    const t = setTimeout(() => sfx.shelfIn(), 250);
    return () => clearTimeout(t);
  }, [binders]);

  // A binder opened from elsewhere (the OS, the tour) stands on another page: the shelf turns to it
  const openPage = binders.find((b) => b.id === openId)?.page;
  if (openPage != null && openPage !== page) turnPage(openPage);

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
        if (lc) drawLava(lc, t, themesRef.current[lavaTheme.current] ?? LAVA_THEMES[0], SCENE.lavaRows);
        if (dc) drawDust(dc, t, lampRef.current);
        if (sc && dayRef.current) drawSunDust(sc, t);
        // looked up each time: the canvas comes and goes with the skin
        const pc = reduced ? null : spooky.current?.getContext("2d");
        if (pc) drawSpooky(pc, t, !dayRef.current);
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
    const pockets = pocketsOf(b.id, collection);
    const items = [...pockets.values()].flatMap(({ cardId, copy }) => (cards[cardId] ? [{ card: cards[cardId], copies: [copy] }] : []));
    const t = copiesTotals(items);
    if (b.wish) {
      const wanted = [...wantsOf(b)].filter(([pocket]) => !pockets.has(pocket)).length;
      const total = t.cards + wanted;
      return {
        sub: total ? `★ wishlist · ${t.cards}/${total} ${tr("trouvées", "found")}` : tr("★ wishlist · vide", "★ wishlist · empty"),
        pct: total ? t.cards / total : 0,
      };
    }
    return { sub: t.cards ? `${t.cards} ${tr("carte", "card")}${t.cards > 1 ? "s" : ""} · ${formatMoney(t.trend)}` : tr("classeur libre · vide", "free binder · empty"), pct: null };
  };
  /** the binders of the page shown, and the free place for a new one if it's on this page */
  const onPage = binders.filter((b) => b.page === page);
  // the free place: after the trade binder and the player's binders
  const nextPlace = shelfPlace(binders.length + SHELF_LEAD);
  const free = nextPlace.slot;
  const plusSlot = binders.length < MAX_BINDERS && nextPlace.page === page ? SCENE.slots[free] : null;
  /** the binder on its left shows its side cover over part of the sketch */
  const besideBinder = free > 0 && !rowEnd(free - 1);

  const sceneStyle = { width: W, height: H, transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})` };
  const place = (r: { x: number; y: number; w: number; h: number }) => ({ left: r.x, top: r.y, width: r.w, height: r.h });
  const lavaBox = SCENE.lavaBox;
  const lavaMask = `url(${sceneImg("lava-mask.png")})`;
  const windowMask = `url(${sceneImg("window-mask.png")})`;
  const glow = (r: { x: number; y: number; w: number; h: number }, pad: number) => ({ left: r.x - pad, top: r.y - pad, width: r.w + pad * 2, height: r.h + pad * 2 });
  const theme = lavaThemes[lavaIdx] ?? LAVA_THEMES[0];

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
          {showNight && <img className={styles.plate} src={sceneImg("plate.webp")} alt="" draggable={false} fetchPriority="low" />}
          {/* the same room on a sunny afternoon, faded in over the rainy night */}
          {/* the poster above the desk, on the night plate under the day one (they fade together) */}
          {showNight && (
            <span className={styles.poster} style={place(POSTER_BOX)} aria-hidden>
              <img src={sceneImg(`posters/${poster}-night.webp`)} alt="" draggable={false} fetchPriority="low" />
            </span>
          )}
          {showDay && (
            <img className={`${styles.plate} ${styles.dayPlate} ${daytime ? "" : styles.off}`} src={sceneImg("day.webp")} alt="" draggable={false} fetchPriority="low" />
          )}
          {showDay && (
            <span className={`${styles.poster} ${styles.dayPlate} ${daytime ? "" : styles.off}`} style={place(POSTER_BOX)} aria-hidden>
              <img src={sceneImg(`posters/${poster}-day.webp`)} alt="" draggable={false} fetchPriority="low" />
            </span>
          )}
          {/* a new poster catches the light (drawn again for each one) */}
          {posterGlint > 0 && (
            <span key={posterGlint} className={styles.poster} style={place(POSTER_BOX)} aria-hidden>
              <i className={styles.posterGlint} style={{ maskImage: `url(${sceneImg(`posters/${poster}-night.webp`)})`, WebkitMaskImage: `url(${sceneImg(`posters/${poster}-night.webp`)})` }} />
            </span>
          )}

          {/* the sky behind the glass: night city in the rain, or sunny afternoon */}
          <div className={styles.sky} style={{ ...place(SCENE.window), maskImage: windowMask, WebkitMaskImage: windowMask }}>
            <div ref={sky} className={styles.skyMove}>
              {showNight && <div className={styles.skyLayer} style={{ backgroundImage: `url(${skin?.art.sky ?? sceneImg("sky.webp")})` }} />}
              {showDay && (
                <div
                  className={`${styles.skyLayer} ${styles.skyDay} ${daytime ? "" : styles.off}`}
                  style={{ backgroundImage: `url(${skin?.art.skyDay ?? sceneImg("sky-day.webp")})` }}
                />
              )}
            </div>
            <div className={`${styles.skyGlass} ${daytime ? styles.skyGlassDay : ""}`} />
          </div>

          {/* a skin's decorations standing in the room (lib/shop), a warm glow flickering round the lit ones at night */}
          {skin?.art.decor?.map((d, i) => (
            <span key={i}>
              {d.glow && !daytime && <span className={styles.skinGlow} style={glow(d, 60)} aria-hidden />}
              {d.shadow && <span className={styles.skinShadow} style={{ left: d.x + d.w * 0.08, top: d.y + d.h - 12, width: d.w * 0.84, height: 22 }} aria-hidden />}
              <img
                className={`${styles.sprite} ${styles.skinThing}`}
                src={d.src}
                style={{ ...place(d), transform: d.rot ? `rotate(${d.rot}deg)` : undefined }}
                alt=""
                draggable={false}
              />
              {d.flames?.map((f, k) => (
                <span
                  key={k}
                  className={styles.skinFlame}
                  style={{ left: f.x - f.h * 0.28, top: f.y - f.h * 1.05, width: f.h * 0.56, height: f.h * 1.1, animationDelay: `${-k * 0.37}s` }}
                  aria-hidden
                />
              ))}
            </span>
          ))}

          {skin?.art.spider && <SkinSpider spider={skin.art.spider} paused={paused} />}

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
          {(["plate.webp", "day.webp"] as const).filter((file) => (file === "day.webp" ? showDay : showNight)).map((file) => (
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
              key={`plus-${binders.length}-${page}`}
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
            </button>
          )}

          {/* the trade binder: gold, first on the shelf, its badge (the trophies' one) the cards up for trade */}
          {page === 0 && (
            <button
              className={`${styles.binder} ${styles.tradeBinder} ${openId === "trade" ? styles.out : ""}`}
              style={place(TRADE)}
              data-trade-binder
              aria-label={tr(`Mon classeur d'échange · ${trade.count} à échanger`, `My trade binder · ${trade.count} for trade`)}
              onPointerEnter={() => {
                sfx.spine(0);
                showTip(
                  TRADE.x + TRADE.w / 2,
                  TRADE.y - 8,
                  tr("Mon classeur d'échange", "My trade binder"),
                  trade.count ? tr(`${trade.count} à échanger · je cherche · un lien`, `${trade.count} for trade · wanted · a link`) : tr("je cherche, j'échange : un lien", "wanted, for trade: a link"),
                  TRADE.y + TRADE.h + 10,
                );
              }}
              onPointerLeave={() => setTip(null)}
              onClick={() => {
                sfx.shelfOut();
                setTip(null);
                closeNote();
                onOpenTrade();
              }}
            >
              <ShelfBinder slot={TRADE} color={TRADE_GOLD} last={!onPage.some((b) => b.slot === 1)}>
                {/* Warwick's head on the label, a sticker, where a set binder has its logo */}
                <span className={styles.label} style={TRADE_LABEL}>
                  <img className={styles.tradeSticker} src={sceneImg("warwick-head.webp")} alt="" draggable={false} />
                </span>
              </ShelfBinder>
            </button>
          )}
          {page === 0 && trade.count > 0 && (
            <span key={trade.count} className={styles.ballBadge} style={{ left: TRADE.x + TRADE.w - 36, top: TRADE.y - 30 }} aria-hidden>
              {trade.count > 999 ? "999+" : trade.count}
            </span>
          )}

          {/* binders standing on the shelves, with the set logo on their label */}
          {onPage.map((b) => {
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
                style={wave ? ({ ...place(slot), "--drop-delay": `${0.05 + b.slot * 0.06}s` } as CSSProperties) : place(slot)}
                aria-label={langTag(b) ? `${b.name} · ${langTag(b)}` : b.name}
                onPointerEnter={() => {
                  sfx.spine(i);
                  const sc = scale.current;
                  const now = performance.now();
                  sc.n = i === sc.last + 1 && now - sc.t < 700 ? sc.n + 1 : 1;
                  sc.last = i;
                  sc.t = now;
                  if (sc.n >= 5) unlock("xylophone");
                  showTip(slot.x + slot.w / 2, slot.y - 8, langTag(b) ? `${b.name} · ${langTag(b)}` : b.name, sum.sub, slot.y + slot.h + 10);
                }}
                onPointerLeave={() => setTip(null)}
                onClick={() => clickBinder(b)}
              >
                <ShelfBinder slot={slot} color={b.color} last={rowEnd(b.slot) || !onPage.some((x) => x.slot === b.slot + 1)}>
                  <span
                    className={styles.label}
                    style={{ left: label.x, top: label.y, width: label.w, height: label.h }}
                  >
                    {b.logo ? (
                      <img src={`${b.logo}.png`} alt="" draggable={false} />
                    ) : (
                      <span className={styles.labelText} style={{ color: b.kind === "free" ? "#2b2230" : b.ink }}>
                        {b.wish ? `★ ${b.name}` : b.kind === "free" ? b.name : b.code}
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

          {/* more than one page: a tag under the bottom shelf turns them */}
          {pages > 1 && (
            <div className={styles.pager} style={{ left: PAGER.cx, top: PAGER.y }}>
              <button
                aria-label={tr("Page précédente de l'étagère", "Previous shelf page")}
                disabled={page === 0}
                onPointerEnter={sfx.hover}
                onClick={() => {
                  sfx.riffle();
                  setTip(null);
                  turnPage(page - 1);
                }}
              >
                ◀
              </button>
              <span>
                {page + 1}/{pages}
              </span>
              <button
                aria-label={tr("Page suivante de l'étagère", "Next shelf page")}
                disabled={page === pages - 1}
                onPointerEnter={sfx.hover}
                onClick={() => {
                  sfx.riffle();
                  setTip(null);
                  turnPage(page + 1);
                }}
              >
                ▶
              </button>
            </div>
          )}

          {/* the "+" over the sketch, drawn after the binders: the side cover of the one on its left can't hide it */}
          {plusSlot && (
            <span key={`plus-mark-${binders.length}-${page}`} className={styles.addMark} style={place(plusSlot)} aria-hidden>
              <span className={styles.addPlus} style={besideBinder ? { left: "75%" } : undefined}>
                +
              </span>
            </span>
          )}

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
            src={skin?.art.cat?.sleep.src ?? sceneImg("cat-sleep.webp")}
            style={place(skin?.art.cat?.sleep ?? SCENE.catSleep)}
            alt=""
            draggable={false}
          />
          <img
            className={`${styles.sprite} ${styles.catAwake} ${petting ? "" : styles.hidden}`}
            src={skin?.art.cat?.awake.src ?? sceneImg("cat-awake.webp")}
            style={place(skin?.art.cat?.awake ?? SCENE.catAwake)}
            alt=""
            draggable={false}
          />
          {!petting && (
            // with a witch hat on, the z rises off its back instead
            <span className={styles.zzz} style={skin?.art.cat ? { left: SCENE.catSleep.x + 190, top: SCENE.catSleep.y - 30 } : { left: SCENE.catSleep.x + 70, top: SCENE.catSleep.y - 20 }} aria-hidden>
              z
            </span>
          )}
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

          {/* the Game Boy's screen: its game in a loop (a strip of 8 frames, no script), lit up when hovered */}
          <span className={styles.gbScreen} style={place(GB_SCREEN)} aria-hidden>
            <span className={styles.gbLcd} style={{ transform: GB_LCD }} />
          </span>

          {/* lamp off: the room's light as Gemini painted it at night, laid over everything painted so far */}
          <div
            className={`${styles.night} ${lampOn || daytime ? styles.off : ""}`}
            style={{ backgroundImage: `url(${sceneImg("night-light.webp")})` }}
          />

          {/* a skin's light over the whole room (Halloween: a pumpkin glow) */}
          {skin?.tint && <div className={styles.skinTint} style={{ background: skin.tint }} aria-hidden />}
          {skin?.vignette && (
            <div className={styles.skinVignette} style={{ background: `radial-gradient(ellipse 70% 65% at 50% 58%, transparent 30%, ${skin.vignette})` }} aria-hidden />
          )}

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
          {skin?.particles && (
            <canvas ref={spooky} className={styles.spooky} width={Math.round(SCENE.width / 4)} height={Math.round(SCENE.height / 4)} aria-hidden />
          )}

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
              const w = weather.current;
              const now = performance.now();
              w.n = now - w.t < 4000 ? w.n + 1 : 1;
              w.t = now;
              if (w.n >= 10) unlock("weather");
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
              else {
                startAmbient();
                unlock("radio");
              }
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
              const n = (lavaTheme.current + 1) % lavaThemes.length;
              lavaTheme.current = n;
              setLavaIdx(n);
              // back to the first colour: they were all seen
              if (n === 0) unlock("rainbow");
              showTip(SCENE.lava.x + SCENE.lava.w / 2, SCENE.lava.y, tr("Lampe à lave", "Lava lamp"), tr(lavaThemes[n].name, lavaThemes[n].nameEn));
            }}
          />
          <button
            className={styles.hotspot}
            style={place(POSTER_HIT)}
            aria-label={tr("Le poster : en changer", "The poster: change it")}
            onPointerEnter={() => {
              sfx.hover();
              const [fr, en] = POSTER_NAMES[poster] ?? ["", ""];
              showTip(POSTER_HIT.x + POSTER_HIT.w / 2, POSTER_HIT.y, tr(fr, en), tr("clic : un autre poster", "click: another poster"));
            }}
            onPointerLeave={() => setTip(null)}
            onClick={() => {
              const ids = POSTERS.ids;
              const next = ids[(ids.indexOf(poster) + 1) % ids.length];
              sfx.pop();
              setPoster(next);
              setPosterGlint((n) => n + 1);
              try {
                localStorage.setItem(POSTER_KEY, next);
              } catch {}
              const [fr, en] = POSTER_NAMES[next] ?? ["", ""];
              showTip(POSTER_HIT.x + POSTER_HIT.w / 2, POSTER_HIT.y, tr(fr, en), `${ids.indexOf(next) + 1}/${ids.length}`);
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
              unlock("blog");
              router.push("/blog");
            }}
          />
          {/* the letters read, pinned on the board (the newest at the front): a click reads one again */}
          {pins.map((l, i) => (
            <button
              key={l.day}
              className={styles.pin}
              style={{ left: BOARD.x + 30 + i * 62, top: BOARD.y + 150 - (i % 2) * 22, rotate: `${[-8, 6, -3, 9][i]}deg` }}
              aria-label={tr(`Le courrier du ${l.day}`, `The mail of ${l.day}`)}
              onPointerEnter={() => {
                sfx.hover();
                showTip(BOARD.x + 60 + i * 62, BOARD.y + 140, tr("Le courrier", "The mail"), new Date(`${l.day}T12:00:00`).toLocaleDateString(tr("fr-FR", "en-GB"), { day: "numeric", month: "long" }));
              }}
              onPointerLeave={() => setTip(null)}
              onClick={() => {
                sfx.flip();
                setTip(null);
                openPinned(l);
              }}
            >
              <span aria-hidden>✉</span>
            </button>
          ))}
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
              if (lampOn && !daytime) unlock("moonlight");
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
              unlock("about");
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
              unlock("pet");
              if (bump("pets") >= 20) unlock("pet-20");
              const id = Date.now();
              setPetting(id);
              setTimeout(() => setPetting((p) => (p === id ? 0 : p)), 2600);
              showTip(SCENE.catSleep.x + SCENE.catSleep.w / 2, SCENE.catSleep.y, "Warwick", "rrrrrrr ♥");
            }}
          />

          <GbBubble x={GAMEBOY.x + GAMEBOY.w / 2} y={GAMEBOY.y} active={!compact && !paused && !veiled && !behind && !openId} />
          <button
            className={`${styles.hotspot} ${styles.bookSpot} ${styles.gbSpot}`}
            style={place(GAMEBOY)}
            aria-label={tr("La Game Boy : Nook Survivors", "The Game Boy: Nook Survivors")}
            onPointerEnter={() => {
              sfx.hover();
              showTip(GAMEBOY.x + GAMEBOY.w / 2, GAMEBOY.y - 8, "Nook Survivors", compact ? tr("à jouer sur ordinateur", "play it on a computer") : tr("clic : jouer · le classement t'attend", "click: play · the ladder awaits"));
            }}
            onPointerLeave={() => setTip(null)}
            onClick={() => {
              if (compact) {
                sfx.locked();
                showTip(GAMEBOY.x + GAMEBOY.w / 2, GAMEBOY.y - 8, "Nook Survivors", tr("à jouer sur ordinateur", "play it on a computer"));
                return;
              }
              sfx.boot();
              setTip(null);
              onOpenGame(toScreen(GB_SCREEN.x + GB_SCREEN.w / 2, GB_SCREEN.y + GB_SCREEN.h / 2));
            }}
          />

          {/* the Poké Ball on the top shelf: it glows when hovered, a red bubble counts the trophies not seen yet */}
          <span
            className={`${styles.ballGlow} ${ballHover ? styles.ballGlowOn : ""} ${fresh ? styles.ballGlowNew : ""}`}
            style={{ left: BALL.cx - 110, top: BALL.cy - 110 }}
            aria-hidden
          />
          {fresh > 0 && (
            <span key={fresh} className={styles.ballBadge} style={{ left: BALL.cx + 30, top: BALL.cy - 78 }} aria-hidden>
              {fresh}
            </span>
          )}
          <button
            className={`${styles.hotspot} ${styles.bookSpot}`}
            style={place(BALL)}
            data-tour="trophies"
            aria-label={tr("La Poké Ball : tes trophées", "The Poké Ball: your trophies")}
            onPointerEnter={() => {
              sfx.hover();
              setBallHover(true);
              const n = TROPHIES.filter((x) => won[x.id]).length;
              showTip(BALL.cx, BALL.y - 8, tr("Vitrine à trophées", "Trophy case"), `${n}/${TROPHIES.length} ${tr("trophées", "trophies")}${fresh ? tr(` · ${fresh} nouveau${fresh > 1 ? "x" : ""} !`, ` · ${fresh} new!`) : ""}`, BALL.y + BALL.h + 10);
            }}
            onPointerLeave={() => {
              setBallHover(false);
              setTip(null);
            }}
            onClick={() => {
              sfx.ballOpen();
              setTip(null);
              setBallHover(false);
              onOpenTrophies(toScreen(BALL.cx, BALL.cy));
            }}
          />

          {/* the purple box beside the ball: the cards no binder holds, their number pencilled on its label */}
          <span className={`${styles.ballGlow} ${styles.boxGlow} ${boxHover ? styles.ballGlowOn : ""}`} style={{ left: BOX.cx - 150, top: BOX.cy - 110 }} aria-hidden />
          {inBox > 0 && (
            <span key={inBox} className={styles.boxCount} style={{ left: BOX_LABEL.cx, top: BOX_LABEL.cy }} aria-hidden>
              {inBox > 999 ? "999+" : inBox}
            </span>
          )}
          <button
            className={`${styles.hotspot} ${styles.bookSpot}`}
            style={place(BOX)}
            aria-label={tr("La boîte : les cartes sans classeur", "The box: cards with no binder")}
            onPointerEnter={() => {
              sfx.hover();
              setBoxHover(true);
              showTip(
                BOX.cx,
                BOX.y - 8,
                tr("La boîte", "The box"),
                inBox ? tr(`${inBox} carte${inBox > 1 ? "s" : ""} sans classeur`, `${inBox} card${inBox > 1 ? "s" : ""} with no binder`) : tr("vide", "empty"),
                BOX.y + BOX.h + 10,
              );
            }}
            onPointerLeave={() => {
              setBoxHover(false);
              setTip(null);
            }}
            onClick={() => {
              sfx.coverOpen();
              setTip(null);
              setBoxHover(false);
              onOpenBox(toScreen(BOX.cx, BOX.cy));
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

      <AnimatePresence>
        {/* (it points at the binder: only on the shelf's first page) */}
        {noteUp && !paused && page === 0 && (
          <TradeNote
            key="trade-note"
            at={toScreen(TRADE.x, TRADE.y + TRADE.h + 14)}
            onOpen={() => {
              closeNote();
              sfx.shelfOut();
              onOpenTrade();
            }}
            onClose={() => {
              sfx.click();
              closeNote();
            }}
          />
        )}
      </AnimatePresence>

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

/** The trade binder's note, taped under it on the shelf: once, when it first stands there */
function TradeNote({ at, onOpen, onClose }: { at: { x: number; y: number }; onOpen: () => void; onClose: () => void }) {
  const tr = useT();
  return (
    <motion.div
      className={styles.tradeNote}
      style={{ left: Math.max(12, at.x - 30), top: at.y }}
      role="dialog"
      aria-label={tr("Ton classeur d'échange est là !", "Your trade binder is here!")}
      initial={{ opacity: 0, y: -20, rotate: -4, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, rotate: -1, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 280, damping: 18 }}
    >
      <i className={styles.tape} aria-hidden />
      <button className={styles.tradeNoteClose} onClick={onClose} aria-label={tr("Fermer", "Close")}>
        ✕
      </button>
      <h3>
        <span aria-hidden>⇄</span> {tr("Ton classeur d'échange est là !", "Your trade binder is here!")}
      </h3>
      <p>
        {tr(
          "Ce que tu cherches + tes doubles, en un lien toujours à jour pour tes groupes Facebook et ton Discord.",
          "What you're after + your doubles, in one link always up to date for your Facebook groups and your Discord.",
        )}
      </p>
      <button className={styles.tradeNoteOpen} onClick={onOpen}>
        {tr("Ouvrir ▶", "Open ▶")}
      </button>
    </motion.div>
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
        {t.total ? `${t.owned}/${t.total}` : t.cards} {tr("cartes", "cards")}
        {/* under 1 €, the count is the news */}
        {t.trend >= 1 && (
          <>
            {" "}
            · <b>{formatMoney(t.trend)}</b>
          </>
        )}
      </p>
    </header>
  );
}

const catalogTotal = (b: BinderDef) => (b.setId ? (catalogSet(b.setId)?.total ?? "?") : 0);
