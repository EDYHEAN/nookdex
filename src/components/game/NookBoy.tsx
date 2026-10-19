"use client";

// The NookBoy: the Game Boy on the desk, zoomed in, with a survival game in it. Loaded only when it's opened
// (the room imports it lazily): the engine, its sprites and its sounds stay out of the room's bundle.

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BONUSES, COMBOS, MOVES, ITEMS, NAMES, PACKS, PENSION, STATUSES, STATUS_NOTES, type Txt, RANK2_WAVE, RARITY, STARTERS, pensionCost, pensionMax2, say, type Elem, type Lang } from "@/lib/game/data";
import { gsfx, music } from "@/lib/game/audio";
import { Game, MAX_WAVE, TIERS, dailyOf, dailyReward, pickX, tierLevel, tierPicks, today, type Choice, type FireMode, type Mode, type Phase } from "@/lib/game/engine";
import { DEFI_FROM, DEFI_WAVES, DEFI_WIN_GOLD, defiOf, defiWaveGold } from "@/lib/game/defi";
import { ATLAS_URL, Gfx, PALETTES, SH, SPRITES, SW, anim, loadAtlas } from "@/lib/game/gfx";
import { lastName, myRewards, submitScore, topScores, type Period, type Score } from "@/lib/game/scores";
import { bestWave, buyLevel, reachWave, setGold, usePension } from "@/lib/pensionStore";
import { unlock } from "@/lib/trophyStore";
import { startAmbient, stopAmbient } from "@/lib/sound";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/lang";
import { useViewport } from "@/lib/useViewport";
import styles from "./NookBoy.module.css";

interface Props {
  /** where the painted Game Boy is on screen, to zoom out of it */
  origin: { x: number; y: number };
  onClose: () => void;
}

type Screen = "boot" | "menu" | "ladder" | "options" | "credits" | "daily" | "guide";

/** the ladder's boards */
/** a ladder page: what the Game Boy screen holds without scrolling */
const LADDER_ROWS = 15;
const BOARDS: { mode: Mode; period: Period; label: [string, string] }[] = [
  { mode: "classic", period: "season", label: ["Saison", "Season"] },
  { mode: "daily", period: "day", label: ["Défi du jour", "Daily"] },
  { mode: "classic", period: "all", label: ["Tout temps", "All time"] },
  { mode: "coop", period: "season", label: ["Coop", "Coop"] },
];
/** the daily challenge replaced the old daily on DEFI_FROM (UTC day): its board, its screen, its runs */
const defiNow = () => today() >= DEFI_FROM;
const boardOf = (i: number) => (BOARDS[i].mode === "daily" && defiNow() ? { ...BOARDS[i], mode: "defi" as Mode } : BOARDS[i]);
const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
/** the title menu's entries, by screen: where B comes back to */
const MENU_INDEX: Partial<Record<Screen, number>> = { daily: 2, ladder: 3, guide: 5, options: 6, credits: 7 };
type Button = "up" | "down" | "left" | "right" | "a" | "b" | "start" | "select";

interface Options {
  fire: FireMode;
  manual: boolean;
  palette: number;
  music: boolean;
}
const OPTIONS_KEY = "nookdex:game-options";
const DEFAULTS: Options = { fire: "auto", manual: false, palette: 0, music: true };
function readOptions(): Options {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

/** the shell, in game pixels; the screen inside is 320x288 */
const SHELL_W = 380;
const SHELL_H = 450;

const KEYS: Record<string, Button> = {
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  Enter: "a", Space: "a", KeyK: "a", Escape: "b", Backspace: "b", KeyL: "b", KeyP: "start", Tab: "select",
};

export default function NookBoy({ origin, onClose }: Props) {
  const lang = useLang() as Lang;
  const t = useCallback((fr: string, en: string) => (lang === "fr" ? fr : en), [lang]);
  const vp = useViewport();
  // the whole console fits the window: a zoom of whole device pixels when one comes close (pixels stay square), else the
  // exact fit (whole numbers only gave a small window a tiny console stuck to the top, or one cut at the waist)
  const fit = Math.min((vp.h - 32) / SHELL_H, (vp.w - 80) / SHELL_W);
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const snapped = Math.floor(fit * dpr) / dpr;
  const scale = Math.max(0.5, snapped >= fit * 0.85 ? snapped : fit);
  /** the keys' reminder, left of the console when there's room */
  const hintW = (vp.w - SHELL_W * scale) / 2 - 36;
  const nickname = useStore((s) => s.profile?.name) ?? "";

  const canvas = useRef<HTMLCanvasElement>(null);
  /** the second player's screen, in coop */
  const canvas2 = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  /** the engine lives outside React: it calls onChange when its phase or the menus' data change */
  const [g, setG] = useState<Game | null>(null);
  const ready = !!g;
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>("title");
  const [screen, setScreen] = useState<Screen>("boot");
  const [cursor, setCursor] = useState(0);
  const [, setRev] = useState(0);
  const [opts, setOpts] = useState<Options>(readOptions);
  const [pressed, setPressed] = useState<Partial<Record<Button, boolean>>>({});
  const [name, setName] = useState(() => lastName(nickname));
  const [sent, setSent] = useState<"idle" | "sending" | "error" | number>("idle");
  const [ladder, setLadder] = useState<Score[] | null | "loading">("loading");
  const [ladderPage, setLadderPage] = useState(0);
  /** the guide's tab and page */
  const [guide, setGuide] = useState({ tab: 0, page: 0 });
  const [board, setBoard] = useState(0);
  /** the Pension's screen, open over the menu or the game over: it spends the purse */
  const [pension, setPension] = useState(false);
  /** the Pension's grid scrolls: how many tiles are still out of sight below (its "▼ 6 more" chip) */
  const pGrid = useRef<HTMLDivElement>(null);
  const [pMore, setPMore] = useState(0);
  const purse = usePension((s) => s.gold);
  /** the run's gold went back to the purse */
  const settled = useRef(true);
  const [rewards, setRewards] = useState<string[]>([]);
  /** picking the starters: solo, or coop (P1's pick kept while P2 chooses) */
  const [selectMode, setSelectMode] = useState<"classic" | "coop">("classic");
  const [coopFirst, setCoopFirst] = useState<number | null>(null);
  /** the start tier picked on the starter screen (1: from the start), kept from run to run */
  const [tier, setTier] = useState(1);
  const levels = usePension((s) => s.levels);
  const dailyPaid = usePension((s) => s.dailyPaid);
  /** this run's daily bonus went to the Pension */
  const [bonusTaken, setBonusTaken] = useState(false);

  // The room's radio gives way to the game's music, and comes back after.
  useEffect(() => {
    const radio = useStore.getState().ambient;
    if (radio) stopAmbient();
    return () => {
      music.stop();
      if (radio && useStore.getState().ambient) startAmbient();
    };
  }, []);

  // Load the sprites, set up the engine.
  useEffect(() => {
    let alive = true;
    loadAtlas()
      .then((img) => {
        if (!alive) return;
        const gfx = new Gfx(img);
        const o = readOptions();
        gfx.setPalette(PALETTES[o.palette] ?? PALETTES[0]);
        const eng = new Game(gfx, lang);
        eng.configure(o.fire, o.manual);
        let was = eng.phase;
        eng.onChange = () => {
          setPhase(eng.phase);
          setRev((r) => r + 1);
          // a new menu starts on its first card (the stall kept the last screen's cursor)
          if (eng.phase === "levelup" || (eng.phase === "shop" && was !== "shop")) setCursor(0);
          was = eng.phase;
        };
        setG(eng);
        // dev: the engine at hand in the console (and for screenshots)
        if (process.env.NODE_ENV !== "production") Object.assign(window, { nookboy: eng, nookdefi: defiOf });
      })
      .catch(() => setFailed(true));
    return () => {
      alive = false;
    };
    // the engine is made once; the language is passed on below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => g?.setLang(lang), [g, lang]);
  useEffect(() => {
    void myRewards().then(setRewards);
  }, []);
  // Mewtwo, Gengar: Pokémon of their own for the players given them (game_rewards "skin-mewtwo", "skin-gengar")
  useEffect(() => g?.setRoster(rewards), [g, rewards]);

  // The boot: the logo slides down, "ding", then the menu.
  useEffect(() => {
    if (!ready || screen !== "boot") return;
    const a = setTimeout(() => gsfx.boot(), 1500);
    const b = setTimeout(() => setScreen("menu"), 2600);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [ready, screen]);

  // The loop: 60 steps a second, drawn on every frame; it stops when the tab is hidden.
  useEffect(() => {
    if (!g) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      g.tick((now - last) / 1000);
      last = now;
      // the canvases are read each frame: going to two screens (coop) mounts new ones
      const c1 = canvas.current;
      if (c1) g.draw(c1.getContext("2d")!, 0);
      const c2 = canvas2.current;
      if (c2) g.draw(c2.getContext("2d")!, 1);
    };
    raf = requestAnimationFrame(loop);
    const onHide = () => {
      if (document.hidden) g.pause(true);
    };
    const onBlur = () => g.pause(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("blur", onBlur);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("blur", onBlur);
    };
  }, [g]);

  // The music plays during a run (if wanted).
  useEffect(() => {
    const playing = phase === "play" || phase === "levelup" || phase === "paused" || phase === "evolve" || phase === "countdown";
    if (playing && opts.music) music.start();
    else if (!playing || !opts.music) music.stop();
  }, [phase, opts.music]);

  const saveOpts = (o: Options) => {
    setOpts(o);
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(o));
    } catch {}
    if (!g) return;
    g.configure(o.fire, o.manual);
    if (g.gfx.palette !== PALETTES[o.palette]) g.gfx.setPalette(PALETTES[o.palette]);
  };
  const cyclePalette = () => {
    gsfx.move();
    saveOpts({ ...opts, palette: (opts.palette + 1) % PALETTES.length });
  };

  const openLadder = async (i = board) => {
    setBoard(i);
    setLadder("loading");
    const b = boardOf(i);
    const rows = await topScores(b.mode, b.period, b.period === "day" ? today() : undefined);
    setLadder(rows);
    // opens on the page with the player's own name, else the top
    const me = rows?.findIndex((r) => r.name.toLowerCase() === lastName("").trim().toLowerCase()) ?? -1;
    setLadderPage(me > 0 ? Math.floor(me / LADDER_ROWS) : 0);
  };
  const ladderPages = Array.isArray(ladder) ? Math.max(1, Math.ceil(ladder.length / LADDER_ROWS)) : 1;
  const turnLadder = (d: number) => {
    const next = Math.min(ladderPages - 1, Math.max(0, ladderPage + d));
    if (next === ladderPage) return gsfx.back();
    gsfx.move();
    setLadderPage(next);
  };
  /**
   * A run: classic and coop bring the purse in (Kecleon takes it) and the Pension's levels; the day's challenge starts
   * from nothing, the same for all.
   */
  const startRun = (mode: Mode) => {
    if (!g) return;
    gsfx.ok();
    setSent("idle");
    setPension(false);
    setBonusTaken(false);
    unlock("game-first");
    settled.current = false;
    const st = usePension.getState();
    if (mode === "daily" && defiNow()) return g.start(0, { mode: "defi", perm: {}, defi: defiOf(today()) });
    if (mode === "daily") return g.start(0, { mode: "daily", perm: {}, daily: dailyOf(today()) });
    const start = tiers.includes(tier) ? tier : 1;
    if (mode === "coop") g.start(coopFirst ?? 0, { mode: "coop", perm: st.levels, start }, g.selected);
    else g.start(g.selected, { mode: "classic", perm: st.levels, start });
  };
  /**
   * The run's gold goes to the purse (the Pension's money: a run starts with none), once: at the game over, or when the
   * console is put away mid-run (Johan, 2026-10-13: nothing is lost). The daily's adds to it, with its bonus on the first
   * run of the day.
   */
  const settle = () => {
    if (!g || settled.current) return;
    settled.current = true;
    const st = usePension.getState();
    let gold = st.gold + g.gold;
    const run = g.lastStats;
    if (g.phase === "over" && run?.mode === "daily" && st.dailyPaid !== run.day) {
      gold += run.dailyBonus;
      usePension.setState({ dailyPaid: run.day ?? null });
      setBonusTaken(true);
    }
    // the daily challenge: a little for each wave cleared, every run; its bonus on the day's first win
    if (g.phase === "over" && run?.mode === "defi") {
      gold += defiWaveGold(run.won ? DEFI_WAVES : run.wave - 1);
      if (run.won && st.dailyPaid !== run.day) {
        gold += DEFI_WIN_GOLD;
        usePension.setState({ dailyPaid: run.day ?? null });
        setBonusTaken(true);
      }
    }
    setGold(gold);
    if (g.setup.mode === "classic" || g.setup.mode === "coop") reachWave(run?.wave ?? g.wave);
  };
  const openPension = () => {
    gsfx.ok();
    setCursor(0);
    setPension(true);
  };
  const onPensionScroll = () => {
    const el = pGrid.current;
    if (!el) return;
    const bottom = el.scrollTop + el.clientHeight;
    setPMore([...el.children].filter((c) => (c as HTMLElement).offsetTop + 20 > bottom).length);
  };
  // with the keys, the grid follows the cursor; opened, it counts what's below
  useEffect(() => {
    if (pension) pGrid.current?.children[cursor]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [pension, cursor]);
  useEffect(() => {
    if (pension) onPensionScroll();
  }, [pension]);
  /** wave 100 reached once: every upgrade gets its 2nd rank */
  const rank2 = bestWave(levels) >= RANK2_WAVE;
  /** the start tiers reached (1 = from the start), and the next one: shown locked, something to aim at */
  const tiers = [1, ...TIERS.filter((w) => bestWave(levels) >= w)];
  const nextTier = TIERS.find((w) => bestWave(levels) < w);
  const capOf = (d: (typeof PENSION)[number]) => (rank2 ? pensionMax2(d) : d.max);
  const buyPension = (i: number) => {
    const d = PENSION[i];
    const lv = levels[d.id] ?? 0;
    const cost = pensionCost(d, lv);
    if (lv >= capOf(d) || !buyLevel(d.id, cost)) return gsfx.back();
    gsfx.coin();
    unlock("game-pension");
    if (lv >= d.max) unlock("game-rank2");
  };

  /* ---------------- what each button does, screen by screen ---------------- */

  const menuItems: { label: string; go: () => void }[] =
    screen === "menu"
      ? [
          { label: t("Jouer", "Play"), go: () => (gsfx.ok(), setCursor(0), setSelectMode("classic"), g?.toSelect()) },
          {
            label: t("Jouer à deux (même PC)", "Two players (same PC)"),
            go: () => (gsfx.ok(), setCursor(0), setSelectMode("coop"), setCoopFirst(null), g?.toSelect()),
          },
          { label: t("Défi du jour", "Daily challenge"), go: () => (gsfx.ok(), setScreen("daily")) },
          { label: t("Classement", "Ladder"), go: () => (gsfx.ok(), setScreen("ladder"), void openLadder()) },
          { label: t(`Pension · ${purse} or`, `Pension · ${purse} gold`), go: openPension },
          { label: t("Guide", "Guide"), go: () => (gsfx.ok(), setGuide({ tab: 0, page: 0 }), setScreen("guide")) },
          { label: t("Options", "Options"), go: () => (gsfx.ok(), setCursor(0), setScreen("options")) },
          { label: t("Crédits", "Credits"), go: () => (gsfx.ok(), setScreen("credits")) },
          { label: t("Ranger la console", "Put it away"), go: () => (gsfx.back(), onClose()) },
        ]
      : [];
  const optionRows: { label: string; value: string; go: (d: number) => void }[] = [
    {
      label: t("Attaque", "Attack"),
      value: { auto: t("auto, vers la souris", "auto, at the mouse"), click: t("au clic (ou Espace)", "on click (or Space)"), nearest: t("visée auto", "auto-aim") }[opts.fire],
      go: (d) => {
        const all: FireMode[] = ["auto", "click", "nearest"];
        saveOpts({ ...opts, fire: all[(all.indexOf(opts.fire) + d + 3) % 3] });
      },
    },
    { label: t("Capacités", "Moves"), value: opts.manual ? t("touches 1 à 4", "keys 1 to 4") : t("automatiques", "automatic"), go: () => saveOpts({ ...opts, manual: !opts.manual }) },
    {
      label: t("Palette", "Palette"),
      value: say(PALETTES[opts.palette].name, lang),
      go: (d) => saveOpts({ ...opts, palette: (opts.palette + d + PALETTES.length) % PALETTES.length }),
    },
    { label: t("Musique", "Music"), value: opts.music ? "ON" : "OFF", go: () => saveOpts({ ...opts, music: !opts.music }) },
  ];

  const press = (b: Button) => {
    const eng = g;
    if (!eng) return;
    const p = eng.phase;
    if (b === "select") return cyclePalette();
    if (pension) {
      const n = PENSION.length;
      if (b === "left" || b === "right") {
        gsfx.move();
        setCursor((c) => (c >= n ? c : (c + (b === "left" ? -1 : 1) + n) % n));
      } else if (b === "up" || b === "down") {
        gsfx.move();
        // a 3-wide grid; below its last row, Done
        setCursor((c) => (b === "down" ? (c >= n ? 1 : c + 3 >= n ? n : c + 3) : c >= n ? Math.max(0, n - 2) : c - 3 < 0 ? n : c - 3));
      } else if (b === "a" && cursor < n) buyPension(cursor);
      else if (b === "b" || b === "start" || b === "a") {
        gsfx.back();
        setPension(false);
        setCursor(4);
      }
      return;
    }
    if (p === "title" && screen === "guide" && (b === "left" || b === "right")) {
      gsfx.move();
      return setGuide((gd) => ({ tab: (gd.tab + (b === "left" ? -1 : 1) + GUIDE_TABS.length) % GUIDE_TABS.length, page: 0 }));
    }
    if (p === "title" && screen === "guide" && (b === "up" || b === "down")) {
      const pages = guidePages(guide.tab);
      const next = Math.min(pages - 1, Math.max(0, guide.page + (b === "up" ? -1 : 1)));
      if (next === guide.page) return gsfx.back();
      gsfx.move();
      return setGuide({ ...guide, page: next });
    }
    if (p === "title" && screen === "ladder" && (b === "up" || b === "down")) return turnLadder(b === "up" ? -1 : 1);
    if (p === "title" && screen === "ladder" && (b === "left" || b === "right")) {
      gsfx.move();
      return void openLadder((board + (b === "left" ? -1 : 1) + BOARDS.length) % BOARDS.length);
    }
    if (p === "title" && screen === "daily" && (b === "a" || b === "start")) return startRun("daily");
    if (p === "shop" && eng.swapMode) {
      // the swap: what you give (and Keep it all after it), then the three to take
      const n = eng.swapList.length + (eng.swapMode === "give" ? 1 : 0);
      if (b === "left" || b === "up") {
        gsfx.move();
        setCursor((c) => (c + n - 1) % n);
      } else if (b === "right" || b === "down") {
        gsfx.move();
        setCursor((c) => (c + 1) % n);
      } else if (b === "a" && cursor < eng.swapList.length) {
        setCursor(0);
        eng.swapPick(cursor);
      } else if (eng.swapMode === "give" && (b === "b" || (b === "a" && cursor >= eng.swapList.length))) {
        // back out only before paying: once paid, one of the three is taken
        setCursor(eng.offers.length + 2);
        eng.swapCancel();
      }
      return;
    }
    if (p === "shop") {
      const n = eng.offers.length + 4;
      if (b === "left" || b === "up") {
        gsfx.move();
        setCursor((c) => (c + n - 1) % n);
      } else if (b === "right" || b === "down") {
        gsfx.move();
        setCursor((c) => (c + 1) % n);
      } else if (b === "a") {
        if (cursor < eng.offers.length) eng.buy(cursor);
        else if (cursor === eng.offers.length) eng.buyHeal();
        else if (cursor === eng.offers.length + 1) eng.shopReroll();
        else if (cursor === eng.offers.length + 2) {
          setCursor(0);
          eng.swapOpen();
        } else {
          setCursor(0);
          eng.leaveShop();
        }
      } else if (b === "b" || b === "start") {
        setCursor(0);
        eng.leaveShop();
      }
      return;
    }
    if (p === "title") {
      if (screen === "boot") return setScreen("menu");
      if (screen === "menu") {
        if (b === "up" || b === "down") {
          gsfx.move();
          setCursor((c) => (c + (b === "up" ? -1 : 1) + menuItems.length) % menuItems.length);
        } else if (b === "a" || b === "start") menuItems[cursor]?.go();
        else if (b === "b") {
          gsfx.back();
          onClose();
        }
        return;
      }
      if (screen === "options") {
        if (b === "up" || b === "down") {
          gsfx.move();
          setCursor((c) => (c + (b === "up" ? -1 : 1) + optionRows.length + 1) % (optionRows.length + 1));
        } else if ((b === "a" || b === "left" || b === "right") && cursor < optionRows.length) {
          gsfx.move();
          optionRows[cursor].go(b === "left" ? -1 : 1);
        } else if (b === "b" || b === "a") {
          gsfx.back();
          setCursor(MENU_INDEX.options ?? 0);
          setScreen("menu");
        }
        return;
      }
      if (b === "b" || b === "a" || b === "start") {
        gsfx.back();
        setCursor(MENU_INDEX[screen] ?? 0);
        setScreen("menu");
      }
      return;
    }
    if (p === "select") {
      if ((b === "up" || b === "down") && tiers.length > 1) {
        gsfx.move();
        const k = Math.max(0, tiers.indexOf(tier));
        setTier(tiers[(k + (b === "up" ? -1 : 1) + tiers.length) % tiers.length]);
      } else if (b === "left" || b === "right") {
        gsfx.move();
        eng.select(eng.selected + (b === "left" ? -1 : 1));
      } else if ((b === "a" || b === "start") && selectMode === "coop" && coopFirst == null) {
        gsfx.ok();
        setCoopFirst(eng.selected);
      } else if (b === "a" || b === "start") startRun(selectMode);
      else if (b === "b" && coopFirst != null) {
        gsfx.back();
        setCoopFirst(null);
      } else if (b === "b") {
        gsfx.back();
        eng.set("title");
        setScreen("menu");
      }
      return;
    }
    if (p === "play" && (b === "start" || b === "b")) {
      gsfx.move();
      setCursor(0);
      return eng.pause(true);
    }
    if (p === "paused") {
      if (b === "up" || b === "down") {
        gsfx.move();
        setCursor((c) => (c + 1) % 2);
      } else if (b === "start" || b === "b" || (b === "a" && cursor === 0)) {
        gsfx.ok();
        eng.pause(false);
      } else if (b === "a" && cursor === 1) {
        gsfx.back();
        eng.giveUp();
      }
      return;
    }
    if (p === "levelup") {
      if (!eng.canChoose) return;
      if (b === "left" || b === "up") {
        gsfx.move();
        setCursor((c) => (c + eng.choices.length - 1) % eng.choices.length);
      } else if (b === "right" || b === "down") {
        gsfx.move();
        setCursor((c) => (c + 1) % eng.choices.length);
      } else if (b === "a") eng.choose(eng.choices[cursor]);
      return;
    }
    if (p === "evolve" && b === "b") return eng.cancelEvolution();
  };

  const quitRun = () => {
    music.stop();
    g?.set("title");
    setCursor(0);
    setScreen("menu");
  };

  const send = async () => {
    const run = g?.lastStats;
    if (!run || sent === "sending" || typeof sent === "number") return;
    setSent("sending");
    const rank = await submitScore(name.trim() || t("Dresseur", "Trainer"), run);
    setSent(rank ?? "error");
    if (rank != null) {
      if (rank <= 3) unlock("game-top3");
      // the challenge's rank is the day's board
      if (rank === 1 && run.mode === "defi") unlock("defi-top1");
      gsfx.ok();
      void openLadder(run.mode === "coop" ? 3 : run.mode === "classic" ? 0 : 1);
    } else gsfx.back();
  };

  /* ---------------- keyboard and mouse ---------------- */

  const pressRef = useRef(press);
  const pensionOpen = useRef(false);
  const settleRef = useRef(settle);
  useEffect(() => {
    pressRef.current = press;
    pensionOpen.current = pension;
    settleRef.current = settle;
  });
  useEffect(() => {
    if (phase === "over") settleRef.current();
  }, [phase]);
  useEffect(() => () => settleRef.current(), []);
  useEffect(() => {
    if (!g) return;
    const set = (code: string, down: boolean) => {
      const b = KEYS[code];
      if (b === "up" || b === "down" || b === "left" || b === "right") g.move(b, down, g.setup.mode === "coop" && code.startsWith("Arrow") ? 1 : 0);
      if (code === "Space") g.fire("key", down);
      if (b) setPressed((p) => (p[b] === down ? p : { ...p, [b]: down }));
    };
    const onDown = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === "INPUT";
      if (typing) {
        if (e.key === "Escape") (e.target as HTMLInputElement).blur();
        return;
      }
      const eng = g;
      const b = KEYS[e.code];
      if (b || /^Digit[1-5]$/.test(e.code) || e.code === "KeyM") e.preventDefault();
      set(e.code, true);
      if (e.repeat) return;
      if (e.code === "KeyR" && eng.phase === "levelup") return eng.reroll();
      if (/^Digit[1-5]$/.test(e.code)) {
        const n = +e.code.slice(5) - 1;
        if (eng.phase === "levelup") eng.choose(eng.choices[n]);
        else eng.castKey(n);
        return;
      }
      if (e.code === "KeyM") return saveOpts({ ...opts, music: !opts.music });
      if (!b) return;
      // in a run, Enter and Escape are Start; arrows and WASD move the Pokémon, not a menu
      const inRun = eng.phase === "play";
      if (inRun && (e.code === "Enter" || e.code === "Escape" || e.code === "KeyP")) return pressRef.current("start");
      if (inRun && b !== "select") return;
      // the game over has its own buttons (and the name field); its Pension screen takes the keys
      if (eng.phase === "over" && !pensionOpen.current) return;
      pressRef.current(b);
    };
    const onUp = (e: KeyboardEvent) => set(e.code, false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
    // saveOpts changes with opts, which is listed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g, opts]);

  const toGame = (e: React.PointerEvent) => {
    const r = screenRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SW, y: ((e.clientY - r.top) / r.height) * SH };
  };

  // the Game Boy's own buttons, clicked
  const hold = (b: Button) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      setPressed((p) => ({ ...p, [b]: true }));
      if (g?.phase === "play") {
        if (b === "up" || b === "down" || b === "left" || b === "right") g.move(b, true);
        if (b === "a") g.fire("key", true);
        if (b === "start" || b === "select" || b === "b") press(b === "b" ? "start" : b);
      } else press(b);
    },
    onPointerUp: () => release(b),
    onPointerLeave: () => release(b),
  });
  const release = (b: Button) => {
    setPressed((p) => (p[b] ? { ...p, [b]: false } : p));
    if (b === "up" || b === "down" || b === "left" || b === "right") g?.move(b, false);
    if (b === "a") g?.fire("key", false);
  };

  /* ---------------- the screens ---------------- */

  const pal = PALETTES[opts.palette];
  const shades = pal.shades ?? ["#2b2230", "#6b4a7a", "#c9b9d6", "#fff8f0"];
  const screenVars = { "--c0": shades[0], "--c1": shades[1], "--c2": shades[2], "--c3": shades[3] } as React.CSSProperties;
  const nameOf = (dex: number) => say(NAMES[dex] ?? ["?", "?"], lang);
  const run = g?.lastStats;

  const overlay = (() => {
    if (failed) return <div className={styles.center}><p className={styles.box}>{t("Cartouche illisible… réessaie plus tard.", "Cartridge error… try again later.")}</p></div>;
    if (!ready || !g) return <div className={styles.center}><p className={styles.blink}>{t("Chargement…", "Loading…")}</p></div>;
    if (phase === "title") {
      if (screen === "boot")
        return (
          <div className={styles.boot} onClick={() => setScreen("menu")}>
            <p className={styles.bootLogo}>NookDex<sup>®</sup></p>
          </div>
        );
      if (screen === "menu")
        return (
          <div className={styles.title}>
            <div className={styles.logo}>
              <span className={styles.logoSmall}>NOOKBOY</span>
              <span className={styles.logoBig}>NOOK</span>
              <span className={styles.logoBig2}>SURVIVORS</span>
              <span className={styles.logoSub}>{t("les vagues sauvages", "the wild waves")}</span>
            </div>
            <ul className={`${styles.box} ${styles.menu}`}>
              {menuItems.map((it, i) => (
                <li
                  key={it.label}
                  className={i === cursor ? styles.on : ""}
                  onPointerEnter={() => i !== cursor && (gsfx.move(), setCursor(i))}
                  onClick={it.go}
                >
                  {it.label}
                </li>
              ))}
            </ul>
            <p className={styles.keys}>{t("↑↓ choisir · Entrée valider · Tab palette", "↑↓ choose · Enter confirm · Tab palette")}</p>
          </div>
        );
      if (screen === "options")
        return (
          <div className={styles.page}>
            <h2>{t("OPTIONS", "OPTIONS")}</h2>
            <ul className={`${styles.box} ${styles.menu} ${styles.options}`}>
              {optionRows.map((o, i) => (
                <li key={o.label} className={i === cursor ? styles.on : ""} onPointerEnter={() => setCursor(i)} onClick={() => (gsfx.move(), o.go(1))}>
                  <span>{o.label}</span>
                  <b>◂ {o.value} ▸</b>
                </li>
              ))}
              <li className={cursor === optionRows.length ? styles.on : ""} onPointerEnter={() => setCursor(optionRows.length)} onClick={() => press("b")}>
                {t("Retour", "Back")}
              </li>
            </ul>
            <div className={`${styles.box} ${styles.help}`}>
              <p>{t("ZQSD / WASD / flèches : bouger", "WASD / arrows: move")}</p>
              <p>{t("Souris : viser · Entrée / Échap : pause", "Mouse: aim · Enter / Esc: pause")}</p>
              <p>{t("1-4 : capacités (mode touches) · M : musique", "1-4: moves (keys mode) · M: music")}</p>
              <p>{t("Tab (Select) : palette · B pendant une évolution…", "Tab (Select): palette · B during an evolution…")}</p>
            </div>
          </div>
        );
      if (screen === "daily" && defiNow()) {
        const { d } = defiOf(today());
        const mon = d.mon;
        const evo = mon.evolves.map(([dex, l]) => `${nameOf(dex)} (${t("N.", "lv")}${l})`).join(", ");
        return (
          <div className={styles.page}>
            <h2>{t("DÉFI DU JOUR", "DAILY CHALLENGE")}</h2>
            <div className={`${styles.box} ${styles.daily}`}>
              <p className={styles.dailyDay}>
                {new Date(today() + "T12:00:00Z").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long" })} ·{" "}
                {say(d.theme, lang)}
              </p>
              <p className={styles.dailyStarter}>
                <Mini dex={mon.dex} label={nameOf(mon.dex)} /> <b>{nameOf(mon.dex)}</b> <span className={styles.type}>{say(mon.basic.name, lang)}</span>
                {evo && <span className={styles.dim}> → {evo}</span>}
              </p>
              {mon.talent && (
                <p className={styles.dailyMod}>
                  <b>{say(mon.talent.name, lang)}</b> · {say(mon.talent.desc, lang)}
                </p>
              )}
              <p className={styles.dailyGoal}>
                <span>{t("OBJECTIF", "GOAL")}</span>
                {t(
                  `${DEFI_WAVES} vagues : chacune finit au dernier K.O. ${nameOf(d.boss.dex)} à la 5e, le giga boss ${nameOf(d.giga.dex)} à la 10e. Bats-le, le plus vite possible.`,
                  `${DEFI_WAVES} waves, each over at its last KO. ${nameOf(d.boss.dex)} at the 5th, the giga boss ${nameOf(d.giga.dex)} at the 10th. Beat it, as fast as you can.`,
                )}
              </p>
              <p className={styles.dailyGoal}>
                <span>{t("GAIN", "REWARD")}</span>
                {t(
                  `${defiWaveGold(1)} or par vague nettoyée, et ${DEFI_WIN_GOLD} or pour ta 1re victoire du jour.`,
                  `${defiWaveGold(1)} gold per wave cleared, and ${DEFI_WIN_GOLD} gold for your 1st win of the day.`,
                )}
              </p>
              <p className={styles.dim}>
                {dailyPaid === today()
                  ? t("Victoire du jour déjà payée : rejoue pour battre ton temps.", "Today's win is paid already: play again to beat your time.")
                  : t("Plus fort et plus rapide qu'une partie normale. Mêmes ennemis et mêmes cartes pour tous : sans la Pension ni ta bourse.", "Stronger and quicker than a normal run. Same foes and cards for all: no Pension, no purse.")}
              </p>
            </div>
            <ul className={`${styles.box} ${styles.menu}`}>
              <li className={styles.on} onClick={() => startRun("daily")}>
                {t("Relever le défi", "Take the challenge")}
              </li>
            </ul>
            <p className={styles.keys} onClick={() => press("b")}>
              {t("Entrée : jouer · B : retour", "Enter: play · B: back")}
            </p>
          </div>
        );
      }
      if (screen === "daily") {
        const d = dailyOf(today());
        const st = STARTERS[d.starter];
        return (
          <div className={styles.page}>
            <h2>{t("DÉFI DU JOUR", "DAILY CHALLENGE")}</h2>
            <div className={`${styles.box} ${styles.daily}`}>
              <p className={styles.dailyDay}>{new Date(d.day + "T12:00:00Z").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
              <p className={styles.dailyStarter}>
                <Mini dex={st.dex} label={nameOf(st.dex)} /> {t("Pokémon imposé :", "Your Pokémon:")} <b>{nameOf(st.dex)}</b>
              </p>
              <p className={styles.dailyMod}>
                <b>{say(d.mod.name, lang)}</b> · {say(d.mod.desc, lang)}
              </p>
              <p className={styles.dailyGoal}>
                <span>{t("OBJECTIF", "GOAL")}</span> {t(`Tenir jusqu'à la vague ${d.target}.`, `Hold out until wave ${d.target}.`)}
              </p>
              <p className={styles.dailyGoal}>
                <span>{t("GAIN", "REWARD")}</span>
                {t(
                  `Réussi : ${dailyReward(d.target, true)} or et +10 par vague de plus. Raté : 10 or par vague.`,
                  `Met: ${dailyReward(d.target, true)} gold and +10 per wave beyond. Missed: 10 gold per wave.`,
                )}
              </p>
              <p className={styles.dim}>
                {dailyPaid === d.day
                  ? t("Ton bonus du jour est déjà touché : rejoue pour le classement du jour.", "Today's bonus is already yours: play again for the day's ladder.")
                  : t("Le bonus va dans ta bourse, sur ta 1re partie du jour. Mêmes règles et mêmes cartes pour tous : sans la Pension ni ta bourse.", "The bonus goes to your purse, on your 1st run of the day. Same rules and cards for all: no Pension, no purse.")}
              </p>
            </div>
            <ul className={`${styles.box} ${styles.menu}`}>
              <li className={styles.on} onClick={() => startRun("daily")}>
                {t("Relever le défi", "Take the challenge")}
              </li>
            </ul>
            <p className={styles.keys} onClick={() => press("b")}>
              {t("Entrée : jouer · B : retour", "Enter: play · B: back")}
            </p>
          </div>
        );
      }
      if (screen === "guide") {
        const pages = guidePages(guide.tab);
        const turn = (d: number) => press(d < 0 ? "up" : "down");
        return (
          <div className={styles.page}>
            <h2>{t("GUIDE", "GUIDE")}</h2>
            <div className={styles.tabs}>
              {GUIDE_TABS.map((tb, i) => (
                <button key={i} className={i === guide.tab ? styles.on : ""} onClick={() => (gsfx.move(), setGuide({ tab: i, page: 0 }))}>
                  {say(tb, lang)}
                </button>
              ))}
            </div>
            <div className={`${styles.box} ${styles.guide}`} onWheel={(e) => Math.abs(e.deltaY) > 8 && turn(e.deltaY)}>
              {guideRows(guide.tab, lang).slice(guide.page * guideRowsPer(guide.tab), (guide.page + 1) * guideRowsPer(guide.tab)).map((r, i) => (
                <p key={i}>
                  <b>{r[0]}</b> {r[1]}
                </p>
              ))}
              {pages > 1 && (
                <p className={styles.lPages}>
                  <button disabled={guide.page === 0} onClick={() => turn(-1)}>
                    ▲
                  </button>
                  <span>
                    {guide.page + 1}/{pages}
                  </span>
                  <button disabled={guide.page >= pages - 1} onClick={() => turn(1)}>
                    ▼
                  </button>
                </p>
              )}
            </div>
            <p className={styles.keys} onClick={() => press("b")}>
              {t("◀ ▶ rubrique · ▲ ▼ pages · B : retour", "◀ ▶ section · ▲ ▼ pages · B: back")}
            </p>
          </div>
        );
      }
      if (screen === "ladder")
        return (
          <div className={styles.page}>
            <h2>{t("CLASSEMENT", "LADDER")}</h2>
            <div className={styles.tabs}>
              {BOARDS.map((bd, i) => (
                <button key={i} className={i === board ? styles.on : ""} onClick={() => (gsfx.move(), void openLadder(i))}>
                  {say(bd.label, lang)}
                </button>
              ))}
            </div>
            <Ladder
              rows={ladder}
              nameOf={nameOf}
              t={t}
              highlight={lastName("")}
              timed={boardOf(board).mode === "defi"}
              page={ladderPage}
              pages={ladderPages}
              onTurn={turnLadder}
            />
            <p className={styles.keys} onClick={() => press("b")}>
              {ladderPages > 1
                ? t("◀ ▶ changer · ▲ ▼ pages · B : retour", "◀ ▶ switch · ▲ ▼ pages · B: back")
                : t("◀ ▶ changer · B : retour", "◀ ▶ switch · B: back")}
            </p>
          </div>
        );
      return (
        <div className={styles.page}>
          <h2>{t("CRÉDITS", "CREDITS")}</h2>
          <div className={`${styles.box} ${styles.credits}`}>
            <p>{t("Un jeu de fan, gratuit et non officiel, fait pour NookDex.", "A free, unofficial fan game, made for NookDex.")}</p>
            <p>
              {t("Sprites : ", "Sprites: ")}
              <a href="https://sprites.pmdcollab.org/" target="_blank" rel="noreferrer">PMD SpriteCollab</a> (CC BY-NC 4.0) —{" "}
              {SPRITES.credits.map((c) => (c.name === "CHUNSOFT" ? "Spike Chunsoft" : c.name)).join(", ")}.
            </p>
            <p>{t("Pokémon © Nintendo, Creatures, Game Freak. NookDex n'y est pas affilié.", "Pokémon © Nintendo, Creatures, Game Freak. NookDex isn't affiliated with them.")}</p>
            <p>{t("Code, sons et musique : NookDex.", "Code, sounds and music: NookDex.")}</p>
          </div>
          <p className={styles.keys} onClick={() => press("b")}>
            {t("B : retour", "B: back")}
          </p>
        </div>
      );
    }
    if (phase === "select") {
      const s = g.roster[g.selected];
      return (
        <div className={styles.select}>
          <h2>
            {selectMode === "coop"
              ? coopFirst == null
                ? t("J1 : CHOISIS TON POKéMON", "P1: CHOOSE YOUR POKéMON")
                : t("J2 : CHOISIS TON POKéMON", "P2: CHOOSE YOUR POKéMON")
              : t("CHOISIS TON POKéMON", "CHOOSE YOUR POKéMON")}
          </h2>
          <div className={styles.pickRow}>
            {g.roster.map((st, i) => (
              <button
                key={st.dex}
                className={i === g.selected ? styles.on : ""}
                style={{ left: pickX(i, g.roster.length) - 32 }}
                onPointerEnter={() => {
                  if (g.selected === i) return;
                  gsfx.move();
                  g.select(i);
                }}
                onClick={() => press("a")}
                aria-label={nameOf(st.dex)}
              />
            ))}
          </div>
          <div className={`${styles.box} ${styles.starter}`}>
            <p className={styles.starterName}>
              {nameOf(s.dex)} <span className={styles.type}>{say(s.basic.name, lang)}</span>
              {s.reward && <span className={styles.legend}>{t("LÉGENDAIRE", "LEGENDARY")}</span>}
            </p>
            <p>{say(s.blurb, lang)}</p>
            <p className={styles.dim}>
              {t("PV", "HP")} {s.hp} · {t("vitesse", "speed")} {s.speed} · {t("évolue", "evolves")}{" "}
              {s.evolves.map(([d, l]) => `${nameOf(d)} (${t("N.", "lv")}${l})`).join(", ")}
            </p>
          </div>
          {/* where the run starts: the tiers reached, the next one locked (shown once the player is getting there) */}
          {(tiers.length > 1 || bestWave(levels) >= 15) && (
            <div className={styles.tiers}>
              <span className={styles.tierLabel}>{t("DÉPART", "START")}</span>
              {tiers.map((w) => (
                <button key={w} className={w === tier ? styles.on : ""} onClick={() => w !== tier && (gsfx.move(), setTier(w))}>
                  {t("V", "W")}
                  {w}
                </button>
              ))}
              {nextTier && <span className={styles.tierLock}>🔒 {t("V", "W")}{nextTier}</span>}
              {tier > 1 && (
                <span className={styles.tierInfo}>
                  {t("N.", "lv")}
                  {tierLevel(tier)} · {tierPicks(tier)} {t("cartes", "cards")}
                </span>
              )}
            </div>
          )}
          <p className={styles.keys}>
            {selectMode === "coop"
              ? t("J1 : ZQSD + souris · J2 : flèches · Entrée : valider", "P1: WASD + mouse · P2: arrows · Enter: confirm")
              : tiers.length > 1
                ? t("◂ ▸ Pokémon · ▴ ▾ départ · Entrée : go !", "◂ ▸ Pokémon · ▴ ▾ start · Enter: go!")
                : t("◂ ▸ choisir · Entrée : c'est parti !", "◂ ▸ choose · Enter: let's go!")}
          </p>
        </div>
      );
    }
    if (phase === "levelup")
      return (
        <div className={styles.level}>
          <h2>
            {/* before the first second: the Pension's backpack */}
            {g.choices[0]?.kind === "pack"
              ? t("CHOISIS TON BUILD", "PICK YOUR BUILD")
              : g.time !== g.startAt
              ? `${t("NIVEAU", "LEVEL")} ${g.level - g.pendingLevels + 1} !`
              : g.startAt > 0
                ? t(`DÉPART · ENCORE ${g.pendingLevels}`, `HEAD START · ${g.pendingLevels} LEFT`)
                : t("SAC À DOS !", "BACKPACK!")}
          </h2>
          <div className={styles.cards}>
            {g.choices.map((c, i) => {
              const pack = c.kind === "pack" ? PACKS.find((x) => x.id === c.id) : undefined;
              if (pack)
                return (
                  <button
                    key={pack.id}
                    className={`${styles.card} ${styles.packCard} ${i === cursor ? styles.on : ""} ${styles[`r_${pack.rarity}`]}`}
                    onPointerEnter={() => i !== cursor && (gsfx.move(), setCursor(i))}
                    onClick={() => g.choose(c)}
                  >
                    <span className={styles.cardTag}>{i + 1} · BUILD</span>
                    <span className={styles.rarity}>{say(RARITY[pack.rarity].name, lang)}</span>
                    <span className={styles.cardName}>{say(pack.name, lang)}</span>
                    <span className={styles.packList}>
                      {pack.moves.map((id) => (
                        <i key={id} className={styles[`t_${MOVES.find((m) => m.id === id)!.type}`]}>
                          {say(MOVES.find((m) => m.id === id)!.name, lang)}
                        </i>
                      ))}
                    </span>
                    <span className={styles.packItems}>{pack.items.map((id) => say(ITEMS.find((x) => x.id === id)!.name, lang)).join(" · ")}</span>
                  </button>
                );
              const move = c.kind === "move" || c.kind === "evolve" ? MOVES.find((m) => m.id === c.id) : undefined;
              const def = move ?? (c.kind === "item" ? ITEMS.find((it) => it.id === c.id) : c.kind === "bonus" ? BONUSES.find((b) => b.id === c.id) : undefined);
              const tag = { move: t("CAPACITÉ", "MOVE"), item: t("OBJET", "ITEM"), heal: t("SOIN", "HEAL"), evolve: t("ÉVOLUTION", "EVOLUTION"), bonus: "BONUS", pack: "BUILD" }[c.kind];
              // an evolution says what it's made of: the move and its item
              const recipe = move?.evo && `${say(MOVES.find((m) => m.id === move.evo!.from)!.name, lang)} + ${say(ITEMS.find((it) => it.id === move.evo!.item)!.name, lang)}`;
              return (
                <button
                  key={`${c.kind}${c.id}`}
                  className={`${styles.card} ${i === cursor ? styles.on : ""} ${move ? styles[`t_${move.type}`] : ""} ${c.kind === "evolve" ? styles.evoCard : ""} ${c.rarity ? styles[`r_${c.rarity}`] : ""}`}
                  onPointerEnter={() => i !== cursor && (gsfx.move(), setCursor(i))}
                  onClick={() => g.choose(c)}
                >
                  <span className={styles.cardTag}>
                    {i + 1} · {tag}
                  </span>
                  {c.rarity && <span className={styles.rarity}>{say(RARITY[c.rarity].name, lang)}</span>}
                  <span className={styles.cardName}>{def ? say(def.name, lang) : t("Baie Sitrus", "Sitrus Berry")}</span>
                  <span className={styles.cardLvl}>
                    {c.kind === "heal"
                      ? "+40 % PV"
                      : c.kind === "evolve"
                        ? recipe
                        : c.kind === "bonus"
                          ? t("cumulable", "stacks")
                          : c.level === 1
                            ? t("nouveau !", "new!")
                            : `${"●".repeat(c.level)}${"○".repeat(5 - c.level)}`}
                  </span>
                  <span className={styles.cardDesc}>{def ? say(def.desc, lang) : t("Soigne 40 % de tes PV.", "Heals 40% of your HP.")}</span>
                </button>
              );
            })}
          </div>
          {g.rerolls > 0 && (
            <p className={styles.keys} onClick={() => g.reroll()}>
              {t(`R : relancer les cartes (${g.rerolls})`, `R: reroll the cards (${g.rerolls})`)}
            </p>
          )}
          {g.moves.length >= g.moveSlots && g.choices.every((c) => c.kind !== "move" || c.level > 1) && (
            <p className={styles.keys}>{t(`${nameOf(g.dex)} connaît déjà ${g.moveSlots} capacités.`, `${nameOf(g.dex)} already knows ${g.moveSlots} moves.`)}</p>
          )}
        </div>
      );
    if (phase === "shop") {
      // Kecleon's stall, between two waves: its own look, nothing like the level-up cards
      const cheapest = Math.min(g.healPrice, ...g.offers.filter((o) => !o.sold).map((o) => o.price));
      const bought = g.offers.some((o) => o.sold);
      const say2 =
        g.gold < cheapest
          ? t("Hmm… pas assez d'or. Ramasse des pépites !", "Hmm… not enough gold. Pick up some Nuggets!")
          : bought
            ? t("Merci bien ! Autre chose ?", "Thank you kindly! Anything else?")
            : g.setup.daily?.mod.noCenter
              ? t("Bienvenue ! Les vagues attendent, prends ton temps.", "Welcome! The waves will wait, take your time.")
              : t("Bienvenue ! Ton Pokémon est soigné. Les vagues attendent.", "Welcome! Your Pokémon is healed. The waves will wait.");
      const swapping = g.swapMode;
      return (
        <div className={styles.shop}>
          <div className={styles.awning} />
          <div className={styles.shopHead}>
            <Mini dex={352} label="Kecleon" big />
            <p className={styles.bubble}>
              <b>KECLEON</b>{" "}
              {swapping === "give"
                ? t(`Tu me laisses quoi ? Ça te coûtera ${g.swapPrice} or.`, `What will you leave me? That's ${g.swapPrice} gold.`)
                : swapping === "take"
                  ? t("Marché conclu ! Prends-en un, au même niveau.", "Deal! Take one, at the same level.")
                  : say2}
            </p>
            <span className={styles.goldPill}>
              {g.gold} {t("or", "gold")}
            </span>
          </div>
          {swapping === "give" && (
            <div className={styles.swapGrid}>
              {g.swapList.map((c, i) => {
                const def = c.kind === "move" ? MOVES.find((m) => m.id === c.id) : ITEMS.find((x) => x.id === c.id);
                return (
                  <button
                    key={`${c.kind}${c.id}`}
                    className={`${i === cursor ? styles.on : ""} ${c.rarity ? styles[`r_${c.rarity}`] : ""}`}
                    onPointerEnter={() => i !== cursor && (gsfx.move(), setCursor(i))}
                    onClick={() => g.swapPick(i)}
                  >
                    <span>{def ? say(def.name, lang) : ""}</span>
                    <i>{"●".repeat(c.level)}</i>
                  </button>
                );
              })}
            </div>
          )}
          {swapping === "take" && (
            <div className={styles.goods}>
              {g.swapList.map((c, i) => (
                <Good
                  key={`${c.kind}${c.id}`}
                  c={c}
                  on={i === cursor}
                  sold={false}
                  price={0}
                  label="✓"
                  poor={false}
                  lang={lang}
                  t={t}
                  onHover={() => i !== cursor && (gsfx.move(), setCursor(i))}
                  onPick={() => (setCursor(0), g.swapPick(i))}
                />
              ))}
            </div>
          )}
          {!swapping && <div className={styles.goods}>
            {g.offers.map((o, i) => (
              <Good
                key={i}
                c={o.choice}
                on={i === cursor}
                sold={o.sold}
                price={o.price}
                poor={g.gold < o.price || !g.canTake(o.choice)}
                lang={lang}
                t={t}
                onHover={() => i !== cursor && (gsfx.move(), setCursor(i))}
                onPick={() => g.buy(i)}
              />
            ))}
          </div>}
          <div className={styles.counter}>
            {(swapping === "give"
              ? ([[t("Garder tout", "Keep it all"), null, () => (setCursor(g.offers.length + 2), g.swapCancel())]] as const)
              : swapping === "take"
                ? []
                : ([
                    [t("Baie ♥+50%", "Berry ♥+50%"), g.healPrice, () => g.buyHeal()],
                    [t("Relancer", "Reroll"), g.rerollPrice, () => g.shopReroll()],
                    [t("Échanger", "Swap"), g.swapPrice, () => (setCursor(0), g.swapOpen())],
                    [t("Reprendre ▶", "Back to it ▶"), null, () => (setCursor(0), g.leaveShop())],
                  ] as const)
            ).map(([label, price, go], k) => (
              <button
                key={k}
                className={`${cursor === (swapping ? g.swapList.length : g.offers.length) + k ? styles.on : ""} ${price != null && g.gold < price ? styles.cardDim : ""}`}
                onPointerEnter={() => setCursor((swapping ? g.swapList.length : g.offers.length) + k)}
                onClick={go}
              >
                {label}
                {price != null && <i>{price}</i>}
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (phase === "paused")
      return (
        <div className={styles.pause}>
          <Recap g={g} lang={lang} t={t} />
          <ul className={`${styles.box} ${styles.menu}`}>
            <li className={styles.menuTitle}>PAUSE</li>
            {[t("Reprendre", "Resume"), t("Abandonner", "Give up")].map((l, i) => (
              <li key={l} className={i === cursor ? styles.on : ""} onPointerEnter={() => setCursor(i)} onClick={() => (i ? g.giveUp() : g.pause(false))}>
                {l}
              </li>
            ))}
          </ul>
          <p className={styles.keys}>
            {t("Palette : Tab · Musique : M", "Palette: Tab · Music: M")} · {say(pal.name, lang)} · ♪ {opts.music ? "ON" : "OFF"}
          </p>
        </div>
      );
    if (phase === "evolve" && g.evo) {
      const e = g.evo;
      const done = g.dex === e.to;
      return (
        <div className={styles.textbox}>
          <p className={styles.box}>
            {e.cancelled
              ? t(`Hein ? ${nameOf(e.from)} n'a pas évolué !`, `Huh? ${nameOf(e.from)} stopped evolving!`)
              : done
                ? t(`Félicitations ! Ton ${nameOf(e.from)} a évolué en ${nameOf(e.to)} !`, `Congratulations! Your ${nameOf(e.from)} evolved into ${nameOf(e.to)}!`)
                : t(`Quoi ? ${nameOf(e.from)} évolue !`, `What? ${nameOf(e.from)} is evolving!`)}
          </p>
        </div>
      );
    }
    if (phase === "over" && run)
      return (
        <div className={styles.over}>
          <p className={`${styles.box} ${styles.ko}`}>
            {run.won
              ? run.mode === "defi"
                ? t(`VICTOIRE en ${fmtTime(run.seconds)} !`, `VICTORY in ${fmtTime(run.seconds)}!`)
                : t(`VICTOIRE : les ${MAX_WAVE} vagues !`, `VICTORY: all ${MAX_WAVE} waves!`)
              : run.dex2
                ? t(`${nameOf(run.dex)} et ${nameOf(run.dex2)} sont K.O. !`, `${nameOf(run.dex)} and ${nameOf(run.dex2)} fainted!`)
                : t(`${nameOf(run.dex)} est K.O. !`, `${nameOf(run.dex)} fainted!`)}
          </p>
          <div className={`${styles.box} ${styles.stats}`}>
            <p>
              <span>{run.mode === "defi" ? t("Vagues nettoyées", "Waves cleared") : t("Vague atteinte", "Wave reached")}</span>
              <b>{run.mode === "defi" ? `${run.won ? DEFI_WAVES : run.wave - 1}/${DEFI_WAVES}` : run.wave}</b>
            </p>
            <p>
              <span>{t("Pokémon K.O.", "Pokémon KO'd")}</span>
              <b>{run.kills}</b>
            </p>
            <p>
              <span>{t("Niveau", "Level")}</span>
              <b>{run.level}</b>
            </p>
            <p>
              <span>{t("Temps", "Time")}</span>
              <b>
                {/* the time played: a start tier's skipped waves are on the run's clock, not on the player's */}
                {fmtTime(run.seconds - (run.start - 1) * 30)}
              </b>
            </p>
            <p>
              <span>{t("Ta bourse", "Your purse")}</span>
              <b className={styles.goldText}>{purse}</b>
            </p>
            {run.mode === "defi" ? (
              <p>
                <span>{run.won ? t("Défi réussi ✓", "Challenge won ✓") : t("Défi raté", "Challenge lost")}</span>
                <b className={styles.goldText}>
                  +{defiWaveGold(run.won ? DEFI_WAVES : run.wave - 1) + (run.won && bonusTaken ? DEFI_WIN_GOLD : 0)}
                </b>
              </p>
            ) : run.mode === "daily" ? (
              <p>
                <span>{run.dailyWon ? t("Défi réussi ✓", "Challenge met ✓") : t("Défi raté", "Challenge missed")}</span>
                <b className={styles.goldText}>{bonusTaken || dailyPaid !== run.day ? `+${run.dailyBonus}` : t("déjà touché", "already paid")}</b>
              </p>
            ) : (
              <p>
                <span>{t("Or de la partie", "Gold this run")}</span>
                <b className={styles.goldText}>+{run.gold}</b>
              </p>
            )}
          </div>
          {typeof sent === "number" ? (
            <>
              <p className={styles.rank}>{sent <= 3 ? t(`★ ${sent}e du classement ! ★`, `★ #${sent} on the ladder! ★`) : t(`${sent}e du classement`, `#${sent} on the ladder`)}</p>
              <Ladder rows={ladder} nameOf={nameOf} t={t} small highlight={name.trim()} timed={run.mode === "defi"} />
            </>
          ) : (
            <form
              className={styles.send}
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <label>
                {t("Ton pseudo", "Your name")}
                <input
                  value={name}
                  maxLength={run.mode === "coop" ? 35 : 16}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={run.mode === "coop" ? t("Toi & ton pote", "You & your mate") : t("Dresseur", "Trainer")}
                  spellCheck={false}
                />
              </label>
              <button type="submit" disabled={sent === "sending"}>
                {sent === "sending" ? "…" : t("Envoyer au classement", "Send to the ladder")}
              </button>
              {sent === "error" && <p className={styles.err}>{t("Classement injoignable, réessaie.", "Couldn't reach the ladder, try again.")}</p>}
            </form>
          )}
          <div className={styles.overBtns}>
            <button
              onClick={() => {
                gsfx.ok();
                setSent("idle");
                if (run.mode === "daily" || run.mode === "defi") startRun("daily");
                else g.toSelect();
              }}
            >
              {t("Rejouer", "Play again")}
            </button>
            <button onClick={quitRun}>{t("Menu", "Menu")}</button>
            <button className={styles.pensionBtn} onClick={openPension}>
              {t("Pension ▶", "Pension ▶")}
            </button>
          </div>
        </div>
      );
    return null;
  })();

  const pensionView = pension && (
    <div className={styles.page}>
      <h2 className={styles.pHead}>
        {t("PENSION", "PENSION")}
        <span className={styles.goldPill}>
          {purse} {t("or", "gold")}
        </span>
      </h2>
      {/* one grid that scrolls (Johan, 2026-10-17: pages were easy to miss): faded at the bottom while there's more */}
      <div className={`${styles.pScroll} ${pMore > 0 ? styles.pScrollMore : ""}`}>
      <div ref={pGrid} className={styles.pensionGrid} onScroll={onPensionScroll}>
        {PENSION.map((d, i) => {
          const lv = levels[d.id] ?? 0;
          const cost = pensionCost(d, lv);
          const cap = capOf(d);
          const max = lv >= cap;
          const can = !max && purse >= cost;
          const num = (v: number) => (Math.round(v * 100) / 100).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB");
          const fmt = (l: number) => (d.pct ? `${d.less ? "−" : "+"}${num(d.per * l)} %` : d.per < 1 ? `+${num(d.per * l)}` : `${d.per * l}`);
          return (
            <button
              key={d.id}
              className={`${styles.pTile} ${i === cursor ? styles.on : ""} ${can || max ? "" : styles.pDim}`}
              onPointerEnter={() => setCursor(i)}
              onClick={() => buyPension(i)}
            >
              <span className={styles.pName}>{say(d.name, lang)}</span>
              <span className={styles.pPips}>
                {/* the 2nd rank's levels show from the start, locked until wave 100 */}
                {Array.from({ length: pensionMax2(d) }, (_, k) => (
                  <i key={k} className={`${k < lv ? styles.pPipOn : ""} ${k >= d.max ? (rank2 ? styles.pPip2 : styles.pPipLock) : ""}`} />
                ))}
              </span>
              <span className={styles.pEff}>
                {max ? (
                  <>
                    {fmt(lv)} {say(d.stat, lang)}
                  </>
                ) : (
                  <>
                    {lv ? fmt(lv) : "—"} → <b>{fmt(lv + 1)}</b> {say(d.stat, lang)}
                  </>
                )}
              </span>
              <span className={`${styles.pPrice} ${can ? styles.pPriceOk : ""}`}>
                {max ? (rank2 ? "MAX" : t(`🔒 V${RANK2_WAVE}`, `🔒 W${RANK2_WAVE}`)) : `${cost} ${t("or", "gold")}`}
              </span>
            </button>
          );
        })}
      </div>
      {pMore > 0 && (
        <button
          className={styles.pMore}
          onClick={() => (gsfx.move(), pGrid.current?.scrollBy({ top: pGrid.current.clientHeight * 0.8, behavior: "smooth" }))}
        >
          {t(`${pMore} de plus`, `${pMore} more`)}
        </button>
      )}
      </div>
      <div className={styles.pFoot}>
        <p>
          {t("Pour toutes tes parties (sauf le défi du jour). L'or de chaque partie remplit ta bourse.", "For all your runs (but the daily). Each run's gold fills your purse.")}
        </p>
        <button
          className={cursor >= PENSION.length ? styles.on : ""}
          onPointerEnter={() => setCursor(PENSION.length)}
          onClick={() => (gsfx.back(), setPension(false))}
        >
          {t("Retour", "Back")}
        </button>
      </div>
    </div>
  );

  const L = (b: Button) => (pressed[b] ? styles.down : "");
  /** a coop run shows two screens; its menus on the screen of the player they're for */
  const coopRun = !!g && g.setup.mode === "coop" && phase !== "title" && phase !== "select";
  const coopScale = Math.min((vp.w - 40) / (2 * SHELL_W), (vp.h - 70) / SHELL_H);
  const uiOn = coopRun && g && !["paused", "over", "dying"].includes(phase) && !pension ? g.cur.id : 0;
  /** one Game Boy: the screen of player pid (in coop, one each, side by side) */
  const shell = (pid: number, sc: number, left: string) => (
      <div key={pid} className={styles.shell} style={{ width: SHELL_W, height: SHELL_H, left, top: coopRun ? 56 : Math.max(16, (vp.h - SHELL_H * sc) / 2), transform: `translateX(-50%) scale(${sc})` }}>
        <div className={styles.topStrip}>
          <span>◂ OFF · ON ▸</span>
        </div>
        <div className={styles.bezel}>
          <p className={styles.bezelLabel}>
            <i />
            DOT MATRIX WITH STEREO SOUND
            <i />
          </p>
          <span className={`${styles.led} ${ready ? styles.ledOn : ""}`} />
          <span className={styles.battery}>BATTERY</span>
          <div
            ref={pid === 0 ? screenRef : undefined}
            className={styles.screen}
            style={screenVars}
            data-palette={pal.id}
            onPointerMove={(e) => pid === 0 && g?.aimAt(toGame(e))}
            onPointerLeave={() => pid === 0 && g?.aimAt(null)}
            onPointerDown={(e) => {
              if (pid !== 0) return;
              g?.aimAt(toGame(e));
              if ((e.target as HTMLElement).tagName === "CANVAS") g?.fire("mouse", true);
            }}
            onPointerUp={() => pid === 0 && g?.fire("mouse", false)}
            onContextMenu={(e) => e.preventDefault()}
          >
            <canvas
              ref={pid === 0 ? canvas : canvas2}
              width={SW}
              height={SH}
              className={`${styles.canvas} ${pid === 0 && phase === "play" && opts.fire !== "nearest" ? styles.aiming : ""}`}
            />
            {pid === uiOn && (pensionView || overlay) && <div className={styles.ui}>{pensionView || overlay}</div>}
            {pid !== uiOn && overlay && ["levelup", "shop", "evolve"].includes(phase) && (
              <div className={styles.ui}>
                <p className={`${styles.box} ${styles.waiting}`}>{t(`J${uiOn + 1} choisit…`, `P${uiOn + 1} is choosing…`)}</p>
              </div>
            )}
            <div className={styles.lcd} />
          </div>
        </div>
        <p className={styles.brand}>
          Nook<b>Boy</b>
          <sup>{coopRun ? `J${pid + 1}` : "DEX"}</sup>
        </p>
        <div className={styles.controls}>
          <div className={styles.dpad}>
            <button className={`${styles.dUp} ${L("up")}`} {...hold("up")} aria-label="↑" />
            <button className={`${styles.dDown} ${L("down")}`} {...hold("down")} aria-label="↓" />
            <button className={`${styles.dLeft} ${L("left")}`} {...hold("left")} aria-label="←" />
            <button className={`${styles.dRight} ${L("right")}`} {...hold("right")} aria-label="→" />
            <span className={styles.dMid} />
          </div>
          <div className={styles.ab}>
            <button className={`${styles.b} ${L("b")}`} {...hold("b")} aria-label="B">
              <span>B</span>
            </button>
            <button className={`${styles.a} ${L("a")}`} {...hold("a")} aria-label="A">
              <span>A</span>
            </button>
          </div>
        </div>
        <div className={styles.pills}>
          <button className={L("select")} {...hold("select")}>
            <i />
            SELECT
          </button>
          <button className={L("start")} {...hold("start")}>
            <i />
            START
          </button>
        </div>
        <div className={styles.speaker}>
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
      </div>
  );


  return (
    // the dark backdrop only fades; the console zooms out of the desk over it (Johan, 2026-10-17: zoomed with it, its
    // edges showed)
    <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
      <motion.div
        className={styles.zoom}
        style={{ transformOrigin: `${origin.x}px ${origin.y}px` }}
        initial={{ scale: 0.06, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.06, opacity: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget) return;
          // a click beside the console mid-run only pauses it (Johan, 2026-10-17: a friend lost a run that way)
          if (g && !["title", "select", "over"].includes(g.phase)) return g.pause(true);
          onClose();
        }}
      >
      <button className={styles.close} onClick={onClose} aria-label={t("Ranger la console", "Put the console away")}>
        ✕ {t("Ranger", "Put away")}
      </button>
      {coopRun ? (
        <>
          {shell(0, coopScale, "25%")}
          {shell(1, coopScale, "75%")}
        </>
      ) : (
        shell(0, scale, "50%")
      )}
      <p className={styles.hint} style={{ width: hintW, display: hintW < 150 || coopRun ? "none" : undefined }}>
        {t("ZQSD / flèches : bouger · souris : viser · Entrée : pause · Tab : palette", "WASD / arrows: move · mouse: aim · Enter: pause · Tab: palette")}
      </p>
      </motion.div>
    </motion.div>
  );
}

/** the pause's recap: moves, items, and the combos to look for */
function Recap({ g, lang, t }: { g: Game; lang: Lang; t: (fr: string, en: string) => string }) {
  const combos = combosOf(g);
  return (
    <div className={styles.recap}>
      <div className={styles.box}>
        <p className={styles.recapTitle}>{t("CAPACITÉS", "MOVES")}</p>
        {g.moves.length ? (
          g.moves.map((m) => {
            const d = MOVES.find((x) => x.id === m.id)!;
            return (
              <p key={m.id}>
                {say(d.name, lang)} <i>{"●".repeat(m.level)}</i>
              </p>
            );
          })
        ) : (
          <p className={styles.dim}>{t("aucune pour l'instant", "none yet")}</p>
        )}
        <p className={styles.recapTitle}>{t("OBJETS", "ITEMS")}</p>
        {g.items.length ? (
          g.items.map((it) => (
            <p key={it.id}>
              {say(ITEMS.find((x) => x.id === it.id)!.name, lang)} <i>{"●".repeat(it.level)}</i>
            </p>
          ))
        ) : (
          <p className={styles.dim}>{t("aucun pour l'instant", "none yet")}</p>
        )}
      </div>
      <div className={styles.box}>
        <p className={styles.recapTitle}>{t("STATS", "STATS")}</p>
        {statsOf(g, t).map(([k, v, max]) => (
          <p key={k} className={styles.stat}>
            {k} <i>{v}</i>
            {max && <b className={styles.statMax}>MAX</b>}
          </p>
        ))}
      </div>
      <div className={`${styles.box} ${styles.recapCombos}`}>
        <p className={styles.recapTitle}>{t("TES COMBOS", "YOUR COMBOS")}</p>
        {combos.length ? (
          combos.map(({ c, both }) => (
            <p key={c.on + c.by} className={both ? styles.comboOn : ""}>
              {both ? "✓ " : ""}
              {say(c.name, lang)}
            </p>
          ))
        ) : (
          <p className={styles.dim}>{t("Mélange les types pour en trouver !", "Mix the types to find some!")}</p>
        )}
      </div>
    </div>
  );
}

/** the run's numbers, live, in the pause (Johan, 2026-10-18: "am I capped or not?"): label, value, at its cap */
function statsOf(g: Game, t: (fr: string, en: string) => string): [string, string, boolean][] {
  const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.round(Math.abs(v) * 100)} %`;
  return [
    [t("Dégâts", "Damage"), `×${g.power.toFixed(1)}`, false],
    [t("Recharge", "Cooldown"), pct(g.haste - 1), g.hasteMaxed],
    [t("Critique", "Crit"), `${Math.round(g.crit * 100)} % ×${g.critMul.toFixed(2)}`, false],
    [t("Zone", "Area"), pct(g.area - 1), false],
    [t("Vitesse", "Speed"), pct(g.speed / g.starter.speed - 1), false],
    [t("Coups reçus", "Damage taken"), pct(g.guard - 1), false],
    [t("PV max", "Max HP"), `${Math.round(g.maxHp)}`, false],
  ];
}

/* ---------------- the guide (menu) ---------------- */

const GUIDE_TABS: Txt[] = [
  ["Statuts", "Statuses"],
  ["Combos", "Combos"],
  ["Évolutions", "Evolutions"],
  ["Objets", "Items"],
];
/** what the Game Boy's screen holds without scrolling (the statuses' rows run on two lines) */
const guideRowsPer = (tab: number) => (tab === 0 ? 8 : 10);
/** a tab's rows: a bold head, then its text */
function guideRows(tab: number, lang: Lang): [string, string][] {
  if (tab === 0)
    return [
      ...STATUSES.map((s) => [`${say(s.name, lang)} (${say(s.by, lang)})`, say(s.does, lang)] as [string, string]),
      ...STATUS_NOTES.map((n) => ["★", say(n, lang)] as [string, string]),
    ];
  if (tab === 1) return COMBOS.map((c) => [`×${c.mul}`, say(c.name, lang)]);
  if (tab === 2)
    return MOVES.filter((m) => m.evo).map((m) => [
      say(m.name, lang),
      `= ${say(MOVES.find((x) => x.id === m.evo!.from)!.name, lang)} ${lang === "fr" ? "niv. 5" : "lv 5"} + ${say(ITEMS.find((x) => x.id === m.evo!.item)!.name, lang)}`,
    ]);
  return ITEMS.map((it) => [say(it.name, lang), say(it.desc, lang)]);
}
const guidePages = (tab: number) => Math.max(1, Math.ceil(guideRows(tab, "fr").length / guideRowsPer(tab)));

/** which types put a foe in each state (a dark hit makes it flinch: asleep for a moment) */
const STATUS_BY: Record<(typeof COMBOS)[number]["on"], Elem[]> = { wet: ["water"], burn: ["fire"], poison: ["poison"], sleep: ["grass", "ice", "dark"], charm: ["fairy"] };

/**
 * The combos the run's moves (and the starter's own type) take part in, the ones it has both halves of first: 17 of them
 * don't fit on the pause screen (Johan, 2026-10-17), and those are the ones that matter.
 */
function combosOf(g: Game) {
  const types = new Set<Elem>([g.starter.type, ...g.moves.map((m) => MOVES.find((d) => d.id === m.id)!.type)]);
  return COMBOS.map((c) => ({ c, by: types.has(c.by), on: STATUS_BY[c.on].some((e) => types.has(e)) }))
    .filter((x) => x.by || x.on)
    .map((x) => ({ c: x.c, both: x.by && x.on }))
    .sort((a, b) => Number(b.both) - Number(a.both));
}

/* ---------------- the ladder ---------------- */

/**
 * A board, page by page like the games' menus (a scrollbar on the Game Boy's screen looked out of place): ▲ ▼ or the wheel
 * turn the pages, the player's own row stands out.
 */
function Ladder(props: {
  rows: Score[] | null | "loading";
  nameOf: (d: number) => string;
  t: (fr: string, en: string) => string;
  small?: boolean;
  highlight?: string;
  timed?: boolean;
  page?: number;
  pages?: number;
  onTurn?: (d: number) => void;
}) {
  const { rows, nameOf, t, small, highlight, timed, page = 0, pages = 1, onTurn } = props;
  if (rows === "loading") return <p className={`${styles.box} ${styles.blink}`}>{t("Connexion…", "Connecting…")}</p>;
  if (!rows) return <p className={styles.box}>{t("Classement indisponible pour l'instant.", "The ladder is unavailable for now.")}</p>;
  if (!rows.length) return <p className={styles.box}>{t("Personne encore : à toi d'ouvrir le bal !", "Nobody yet: be the first!")}</p>;
  return (
    <ol
      className={`${styles.box} ${styles.ladder} ${small ? styles.ladderSmall : ""}`}
      onWheel={(e) => !small && pages > 1 && Math.abs(e.deltaY) > 8 && onTurn?.(e.deltaY > 0 ? 1 : -1)}
    >
      {(small ? rows.slice(0, 5) : rows.slice(page * LADDER_ROWS, (page + 1) * LADDER_ROWS)).map((r, k) => {
        const i = small ? k : page * LADDER_ROWS + k;
        return (
        <li key={`${r.name}${i}`} className={highlight && r.name.toLowerCase() === highlight.trim().toLowerCase() ? styles.me : ""}>
          <span className={styles.lRank}>{i + 1}</span>
          <Mini dex={r.starter} label={nameOf(r.starter)} />
          <span className={styles.lName}>{r.name}</span>
          {timed ? (
            // the daily challenge: the time of the win (wave 11), else how far it went
            <>
              <span className={styles.lWave}>{r.wave > DEFI_WAVES ? "✓" : `${t("V.", "W")}${r.wave}`}</span>
              <span className={styles.lKo}>{fmtTime(r.seconds)}</span>
            </>
          ) : (
            <>
              <span className={styles.lWave}>
                {(r.start ?? 1) > 1 && <i className={styles.lStart}>↱{r.start}</i>}
                {t("V.", "W")}
                {r.wave}
              </span>
              <span className={styles.lKo}>{r.kills} KO</span>
            </>
          )}
        </li>
        );
      })}
      {!small && pages > 1 && (
        <li className={styles.lPages}>
          <button disabled={page === 0} onClick={() => onTurn?.(-1)} aria-label={t("Page précédente", "Previous page")}>
            ▲
          </button>
          <span>
            {page + 1}/{pages}
          </span>
          <button disabled={page >= pages - 1} onClick={() => onTurn?.(1)} aria-label={t("Page suivante", "Next page")}>
            ▼
          </button>
        </li>
      )}
    </ol>
  );
}

/** a starter's first frame, cut from the atlas */
function Mini({ dex, label, big }: { dex: number; label: string; big?: boolean }) {
  const a = useMemo(() => (SPRITES.mons[dex] ? anim(dex, "Idle") : null), [dex]);
  const cls = big ? styles.monBig : styles.mini;
  if (!a) return <span className={cls} />;
  return (
    <span className={cls} title={label}>
      <span style={{ width: a.w, height: a.h, backgroundImage: `url(${ATLAS_URL})`, backgroundPosition: `-${a.x}px -${a.y}px`, transform: big ? undefined : `scale(0.5)` }} />
    </span>
  );
}

/** one of Kecleon's goods: on its shelf, a price tag hanging from it */
function Good(props: {
  c: Choice;
  on: boolean;
  sold: boolean;
  price: number;
  /** said on the tag instead of the price */
  label?: string;
  poor: boolean;
  lang: Lang;
  t: (fr: string, en: string) => string;
  onHover: () => void;
  onPick: () => void;
}) {
  const { c, lang, t } = props;
  const move = c.kind === "move" || c.kind === "evolve" ? MOVES.find((m) => m.id === c.id) : undefined;
  const def = move ?? (c.kind === "item" ? ITEMS.find((it) => it.id === c.id) : c.kind === "bonus" ? BONUSES.find((b) => b.id === c.id) : undefined);
  const tag = { move: t("CAPACITÉ", "MOVE"), item: t("OBJET", "ITEM"), heal: t("SOIN", "HEAL"), evolve: t("ÉVOLUTION", "EVOLUTION"), bonus: "BONUS", pack: "BUILD" }[c.kind];
  return (
    <button
      className={`${styles.good} ${props.on ? styles.on : ""} ${c.rarity ? styles[`r_${c.rarity}`] : ""} ${props.sold ? styles.sold : props.poor ? styles.cardDim : ""}`}
      onPointerEnter={props.onHover}
      onClick={props.onPick}
    >
      <span className={`${styles.tagPrice} ${props.poor && !props.sold ? styles.tagPoor : ""}`}>{props.sold ? t("VENDU", "SOLD") : (props.label ?? props.price)}</span>
      <span className={styles.cardTag}>{tag}</span>
      {c.rarity && <span className={styles.rarity}>{say(RARITY[c.rarity].name, lang)}</span>}
      <span className={styles.cardName}>{def ? say(def.name, lang) : t("Baie Sitrus", "Sitrus Berry")}</span>
      <span className={styles.cardLvl}>
        {c.kind === "bonus" ? t("cumulable", "stacks") : c.level === 1 ? t("nouveau !", "new!") : `${"●".repeat(c.level)}${"○".repeat(5 - c.level)}`}
      </span>
      <span className={styles.goodDesc}>{def ? say(def.desc, lang) : ""}</span>
    </button>
  );
}
