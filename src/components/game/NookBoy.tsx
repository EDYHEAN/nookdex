"use client";

// The NookBoy: the Game Boy on the desk, zoomed in, with a survival game in it. Loaded only when it's opened
// (the room imports it lazily): the engine, its sprites and its sounds stay out of the room's bundle.

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BONUSES, COMBOS, MOVES, ITEMS, NAMES, PENSION, RARITY, STARTERS, pensionCost, say, type ItemId, type Lang, type MoveId } from "@/lib/game/data";
import { gsfx, music } from "@/lib/game/audio";
import { Game, dailyOf, today, type Choice, type FireMode, type Mode, type Phase } from "@/lib/game/engine";
import { ATLAS_URL, Gfx, PALETTES, SH, SPRITES, SW, anim, loadAtlas } from "@/lib/game/gfx";
import { lastName, submitScore, topScores, type Period, type Score } from "@/lib/game/scores";
import { buyLevel, usePension } from "@/lib/pensionStore";
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

type Screen = "boot" | "menu" | "ladder" | "options" | "credits" | "daily";

/** the ladder's boards */
const BOARDS: { mode: Mode; period: Period; label: [string, string] }[] = [
  { mode: "classic", period: "season", label: ["Saison", "Season"] },
  { mode: "daily", period: "day", label: ["Défi du jour", "Daily"] },
  { mode: "classic", period: "all", label: ["Tout temps", "All time"] },
  { mode: "coop", period: "season", label: ["Coop", "Coop"] },
];
/** the title menu's entries, by screen: where B comes back to */
const MENU_INDEX: Partial<Record<Screen, number>> = { daily: 2, ladder: 3, options: 5, credits: 6 };
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
  // the biggest whole-number zoom that fits: pixels stay square
  const scale = Math.max(1, Math.floor(Math.min((vp.h - 110) / 330, (vp.w - 80) / SHELL_W)));
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
  const [board, setBoard] = useState(0);
  /** the Pension's screen: with the run's gold to spend, or just to look (gold null) */
  const [pension, setPension] = useState<{ gold: number | null } | null>(null);
  const [pensionUsed, setPensionUsed] = useState(false);
  /** picking the starters: solo, or coop (P1's pick kept while P2 chooses) */
  const [selectMode, setSelectMode] = useState<"classic" | "coop">("classic");
  const [coopFirst, setCoopFirst] = useState<number | null>(null);
  const levels = usePension((s) => s.levels);

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
        eng.onChange = () => {
          setPhase(eng.phase);
          setRev((r) => r + 1);
          if (eng.phase === "levelup") setCursor(0);
        };
        setG(eng);
        // dev: the engine at hand in the console (and for screenshots)
        if (process.env.NODE_ENV !== "production") (window as unknown as { nookboy: Game }).nookboy = eng;
      })
      .catch(() => setFailed(true));
    return () => {
      alive = false;
    };
    // the engine is made once; the language is passed on below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => g?.setLang(lang), [g, lang]);

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
    const playing = phase === "play" || phase === "levelup" || phase === "paused" || phase === "evolve" || phase === "center";
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
    const b = BOARDS[i];
    setLadder(await topScores(b.mode, b.period, b.period === "day" ? today() : undefined));
  };
  /** a run: classic with the Pension's levels, or the day's challenge without them */
  const startRun = (mode: Mode) => {
    if (!g) return;
    gsfx.ok();
    setSent("idle");
    setPension(null);
    setPensionUsed(false);
    unlock("game-first");
    if (mode === "daily") g.start(0, { mode: "daily", perm: {}, daily: dailyOf(today()) });
    else if (mode === "coop") g.start(coopFirst ?? 0, { mode: "coop", perm: usePension.getState().levels }, g.selected);
    else g.start(g.selected, { mode: "classic", perm: usePension.getState().levels });
  };
  /** the end of a run: what's left of its gold goes to the Pension (the daily's bonus once a day) */
  const openPension = () => {
    const run = g?.lastStats;
    if (!run || pensionUsed) return;
    const st = usePension.getState();
    const bonus = run.mode === "daily" && st.dailyPaid !== run.day ? run.dailyBonus : 0;
    if (bonus) usePension.setState({ dailyPaid: run.day ?? null });
    setPensionUsed(true);
    setCursor(0);
    setPension({ gold: run.gold + bonus });
  };
  const buyPension = (i: number) => {
    const d = PENSION[i];
    const lv = levels[d.id] ?? 0;
    if (!pension || pension.gold == null || lv >= d.max || pension.gold < pensionCost(d, lv)) return gsfx.back();
    gsfx.coin();
    buyLevel(d.id);
    unlock("game-pension");
    setPension({ gold: pension.gold - pensionCost(d, lv) });
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
          { label: t("Pension", "Pension"), go: () => (gsfx.ok(), setCursor(0), setPension({ gold: null })) },
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
      if (b === "up" || b === "down") {
        gsfx.move();
        setCursor((c) => (c + (b === "up" ? -1 : 1) + PENSION.length + 1) % (PENSION.length + 1));
      } else if (b === "a" && cursor < PENSION.length) buyPension(cursor);
      else if (b === "b" || b === "start" || b === "a") {
        gsfx.back();
        setPension(null);
        setCursor(3);
      }
      return;
    }
    if (p === "title" && screen === "ladder" && (b === "left" || b === "right")) {
      gsfx.move();
      return void openLadder((board + (b === "left" ? -1 : 1) + BOARDS.length) % BOARDS.length);
    }
    if (p === "title" && screen === "daily" && (b === "a" || b === "start")) return startRun("daily");
    if (p === "shop") {
      const n = eng.offers.length + 3;
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
        else {
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
      if (b === "left" || b === "right") {
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
    if (p === "center") {
      const rows = centerRows(eng);
      if (b === "up" || b === "down") {
        gsfx.move();
        setCursor((c) => (c + (b === "up" ? -1 : 1) + rows.length + 1) % (rows.length + 1));
      } else if (b === "start" || (b === "a" && cursor >= rows.length)) {
        setCursor(0);
        eng.leaveCenter();
      } else if (b === "a") {
        eng.forget(rows[cursor].kind, rows[cursor].id);
        setCursor((c) => Math.min(c, rows.length - 1));
      }
      return;
    }
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
      gsfx.ok();
      void openLadder();
    } else gsfx.back();
  };

  /* ---------------- keyboard and mouse ---------------- */

  const pressRef = useRef(press);
  const pensionOpen = useRef(false);
  useEffect(() => {
    pressRef.current = press;
    pensionOpen.current = !!pension;
  });
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
      if (b || /^Digit[1-4]$/.test(e.code) || e.code === "KeyM") e.preventDefault();
      set(e.code, true);
      if (e.repeat) return;
      if (e.code === "KeyR" && eng.phase === "levelup") return eng.reroll();
      if (/^Digit[1-4]$/.test(e.code)) {
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
              <p className={styles.dim}>
                {t(
                  "Les mêmes règles et les mêmes cartes pour tout le monde, sans les bonus de la Pension. Ta première partie du jour rapporte un bonus d'or.",
                  "The same rules and cards for everyone, without the Pension's boosts. Your first run of the day earns a gold bonus.",
                )}
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
            <Ladder rows={ladder} nameOf={nameOf} t={t} />
            <p className={styles.keys} onClick={() => press("b")}>
              {t("◀ ▶ changer · B : retour", "◀ ▶ switch · B: back")}
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
      const s = STARTERS[g.selected];
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
            {STARTERS.map((st, i) => (
              <button
                key={st.dex}
                className={i === g.selected ? styles.on : ""}
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
            </p>
            <p>{say(s.blurb, lang)}</p>
            <p className={styles.dim}>
              {t("PV", "HP")} {s.hp} · {t("vitesse", "speed")} {s.speed} · {t("évolue", "evolves")}{" "}
              {s.evolves.map(([d, l]) => `${nameOf(d)} (${t("N.", "lv")}${l})`).join(", ")}
            </p>
          </div>
          <p className={styles.keys}>
            {selectMode === "coop"
              ? t("J1 : ZQSD + souris · J2 : flèches · Entrée : valider", "P1: WASD + mouse · P2: arrows · Enter: confirm")
              : t("◂ ▸ choisir · Entrée : c'est parti !", "◂ ▸ choose · Enter: let's go!")}
          </p>
        </div>
      );
    }
    if (phase === "levelup")
      return (
        <div className={styles.level}>
          <h2>
            {t("NIVEAU", "LEVEL")} {g.level - g.pendingLevels + 1} !
          </h2>
          <div className={styles.cards}>
            {g.choices.map((c, i) => {
              const move = c.kind === "move" || c.kind === "evolve" ? MOVES.find((m) => m.id === c.id) : undefined;
              const def = move ?? (c.kind === "item" ? ITEMS.find((it) => it.id === c.id) : c.kind === "bonus" ? BONUSES.find((b) => b.id === c.id) : undefined);
              const tag = { move: t("CAPACITÉ", "MOVE"), item: t("OBJET", "ITEM"), heal: t("SOIN", "HEAL"), evolve: t("ÉVOLUTION", "EVOLUTION"), bonus: "BONUS" }[c.kind];
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
          {g.moves.length >= 4 && g.choices.every((c) => c.kind !== "move" || c.level > 1) && (
            <p className={styles.keys}>{t(`${nameOf(g.dex)} connaît déjà 4 capacités.`, `${nameOf(g.dex)} already knows 4 moves.`)}</p>
          )}
        </div>
      );
    if (phase === "center") {
      const rows = centerRows(g);
      return (
        <div className={styles.page}>
          <h2>{t("CENTRE POKéMON", "POKéMON CENTER")}</h2>
          <p className={`${styles.box} ${styles.centerMsg}`}>
            {t(
              `${nameOf(g.dex)} est en pleine forme ! Tu peux oublier des capacités ou lâcher des objets pour faire de la place.`,
              `${nameOf(g.dex)} is fully healed! You can forget moves or drop items to make room.`,
            )}
          </p>
          <ul className={`${styles.box} ${styles.menu} ${styles.forget}`}>
            {rows.map((r, i) => (
              <li key={r.id} className={i === cursor ? styles.on : ""} onPointerEnter={() => setCursor(i)} onClick={() => g.forget(r.kind, r.id)}>
                <span>
                  {r.name} <i>{"●".repeat(r.level)}</i>
                </span>
                <b>{r.kind === "move" ? t("oublier", "forget") : t("lâcher", "drop")}</b>
              </li>
            ))}
            <li className={cursor >= rows.length ? styles.on : ""} onPointerEnter={() => setCursor(rows.length)} onClick={() => (setCursor(0), g.leaveCenter())}>
              {t("Continuer ▶", "Continue ▶")}
            </li>
          </ul>
        </div>
      );
    }
    if (phase === "shop")
      return (
        <div className={styles.level}>
          <h2>
            {t("BOUTIQUE DE KECLEON", "KECLEON'S SHOP")} · <span className={styles.goldText}>{g.gold} {t("or", "gold")}</span>
          </h2>
          <div className={styles.cards}>
            {g.offers.map((o, i) => (
              <CardView
                key={i}
                c={o.choice}
                i={i}
                on={i === cursor}
                lang={lang}
                t={t}
                price={o.sold ? t("vendu", "sold") : `${o.price} ${t("or", "gold")}`}
                dim={o.sold || g.gold < o.price}
                onHover={() => i !== cursor && (gsfx.move(), setCursor(i))}
                onPick={() => g.buy(i)}
              />
            ))}
          </div>
          <ul className={`${styles.box} ${styles.menu} ${styles.shopRow}`}>
            {[
              [t(`Baie Sitrus (+50 % PV) · ${g.healPrice} or`, `Sitrus Berry (+50% HP) · ${g.healPrice} gold`), () => g.buyHeal()],
              [t(`Relancer · ${g.rerollPrice} or`, `Reroll · ${g.rerollPrice} gold`), () => g.shopReroll()],
              [t("Partir", "Leave"), () => (setCursor(0), g.leaveShop())],
            ].map(([label, go], k) => (
              <li key={k} className={cursor === g.offers.length + k ? styles.on : ""} onPointerEnter={() => setCursor(g.offers.length + k)} onClick={go as () => void}>
                {label as string}
              </li>
            ))}
          </ul>
        </div>
      );
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
            {run.dex2
              ? t(`${nameOf(run.dex)} et ${nameOf(run.dex2)} sont K.O. !`, `${nameOf(run.dex)} and ${nameOf(run.dex2)} fainted!`)
              : t(`${nameOf(run.dex)} est K.O. !`, `${nameOf(run.dex)} fainted!`)}
          </p>
          <div className={`${styles.box} ${styles.stats}`}>
            <p>
              <span>{t("Vague atteinte", "Wave reached")}</span>
              <b>{run.wave}</b>
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
                {Math.floor(run.seconds / 60)}:{String(run.seconds % 60).padStart(2, "0")}
              </b>
            </p>
            <p>
              <span>{t("Or en poche", "Gold left")}</span>
              <b className={styles.goldText}>{run.gold}</b>
            </p>
            <p>
              <span>{run.mode === "daily" ? t("Défi du jour", "Daily") : t("Mode", "Mode")}</span>
              <b>{run.mode === "daily" ? `+${run.dailyBonus}` : run.mode === "coop" ? "coop" : t("classique", "classic")}</b>
            </p>
          </div>
          {typeof sent === "number" ? (
            <>
              <p className={styles.rank}>{sent <= 3 ? t(`★ ${sent}e du classement ! ★`, `★ #${sent} on the ladder! ★`) : t(`${sent}e du classement`, `#${sent} on the ladder`)}</p>
              <Ladder rows={ladder} nameOf={nameOf} t={t} small highlight={name.trim()} />
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
                if (run.mode === "daily") startRun("daily");
                else g.toSelect();
              }}
            >
              {t("Rejouer", "Play again")}
            </button>
            <button onClick={quitRun}>{t("Menu", "Menu")}</button>
            {!pensionUsed && (
              <button className={styles.pensionBtn} onClick={openPension}>
                {t("Pension ▶", "Pension ▶")}
              </button>
            )}
          </div>
          {!pensionUsed && <p className={styles.err}>{t("L'or non dépensé à la Pension est perdu.", "Gold not spent at the Pension is lost.")}</p>}
        </div>
      );
    return null;
  })();

  const pensionView = pension && (
    <div className={styles.page}>
      <h2>
        {t("PENSION", "PENSION")}
        {pension.gold != null && (
          <>
            {" "}
            · <span className={styles.goldText}>{pension.gold} {t("or", "gold")}</span>
          </>
        )}
      </h2>
      <ul className={`${styles.box} ${styles.menu} ${styles.pension}`}>
        {PENSION.map((d, i) => {
          const lv = levels[d.id] ?? 0;
          const cost = pensionCost(d, lv);
          const max = lv >= d.max;
          return (
            <li
              key={d.id}
              className={`${i === cursor ? styles.on : ""} ${pension.gold != null && !max && pension.gold >= cost ? "" : styles.dim}`}
              onPointerEnter={() => setCursor(i)}
              onClick={() => buyPension(i)}
            >
              <span>
                {say(d.name, lang)} <i>{"●".repeat(lv)}{"○".repeat(d.max - lv)}</i>
                <small>{say(d.desc, lang)}</small>
              </span>
              <b>{max ? "MAX" : `${cost}`}</b>
            </li>
          );
        })}
        <li className={cursor >= PENSION.length ? styles.on : ""} onPointerEnter={() => setCursor(PENSION.length)} onClick={() => (gsfx.back(), setPension(null))}>
          {pension.gold != null ? t("Terminer ▶", "Done ▶") : t("Retour", "Back")}
        </li>
      </ul>
      <p className={styles.keys}>
        {pension.gold != null
          ? t("Des bonus pour toutes tes parties (sauf le défi du jour).", "Boosts for all your runs (but the daily).")
          : t("Termine une partie pour y dépenser ton or.", "Finish a run to spend your gold here.")}
      </p>
    </div>
  );

  const L = (b: Button) => (pressed[b] ? styles.down : "");
  /** a coop run shows two screens; its menus on the screen of the player they're for */
  const coopRun = !!g && g.setup.mode === "coop" && phase !== "title" && phase !== "select";
  const coopScale = Math.min((vp.w - 40) / (2 * SHELL_W), (vp.h - 70) / SHELL_H);
  const uiOn = coopRun && g && !["paused", "over", "dying"].includes(phase) && !pension ? g.cur.id : 0;
  /** one Game Boy: the screen of player pid (in coop, one each, side by side) */
  const shell = (pid: number, sc: number, left: string) => (
      <div key={pid} className={styles.shell} style={{ width: SHELL_W, height: SHELL_H, left, top: coopRun ? 56 : undefined, transform: `translateX(-50%) scale(${sc})` }}>
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
            {pid !== uiOn && overlay && ["levelup", "center", "shop", "evolve"].includes(phase) && (
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
    <motion.div
      className={styles.overlay}
      style={{ transformOrigin: `${origin.x}px ${origin.y}px` }}
      initial={{ scale: 0.06, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.06, opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
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
  );
}

/** a card: a level-up's, or one of Kecleon's (with its price) */
function CardView(props: {
  c: Choice;
  i: number;
  on: boolean;
  lang: Lang;
  t: (fr: string, en: string) => string;
  price?: string;
  dim?: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  const { c, i, on, lang, t } = props;
  const move = c.kind === "move" || c.kind === "evolve" ? MOVES.find((m) => m.id === c.id) : undefined;
  const def = move ?? (c.kind === "item" ? ITEMS.find((it) => it.id === c.id) : c.kind === "bonus" ? BONUSES.find((b) => b.id === c.id) : undefined);
  const tag = { move: t("CAPACITÉ", "MOVE"), item: t("OBJET", "ITEM"), heal: t("SOIN", "HEAL"), evolve: t("ÉVOLUTION", "EVOLUTION"), bonus: "BONUS" }[c.kind];
  const recipe = move?.evo && `${say(MOVES.find((m) => m.id === move.evo!.from)!.name, lang)} + ${say(ITEMS.find((it) => it.id === move.evo!.item)!.name, lang)}`;
  return (
    <button
      className={`${styles.card} ${on ? styles.on : ""} ${move ? styles[`t_${move.type}`] : ""} ${c.kind === "evolve" ? styles.evoCard : ""} ${c.rarity ? styles[`r_${c.rarity}`] : ""} ${props.dim ? styles.cardDim : ""}`}
      onPointerEnter={props.onHover}
      onClick={props.onPick}
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
      {props.price && <span className={styles.price}>{props.price}</span>}
    </button>
  );
}

/** the Pokémon Center's list: the moves, then the items */
function centerRows(g: Game) {
  const lang = g.lang;
  return [
    ...g.moves.map((m) => ({ kind: "move" as const, id: m.id as MoveId | ItemId, level: m.level, name: say(MOVES.find((d) => d.id === m.id)!.name, lang) })),
    ...g.items.map((it) => ({ kind: "item" as const, id: it.id as MoveId | ItemId, level: it.level, name: say(ITEMS.find((d) => d.id === it.id)!.name, lang) })),
  ];
}

/** the pause's recap: moves, items, and the combos to look for */
function Recap({ g, lang, t }: { g: Game; lang: Lang; t: (fr: string, en: string) => string }) {
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
        <p className={styles.recapTitle}>COMBOS</p>
        {COMBOS.map((c) => (
          <p key={c.on + c.by}>{say(c.name, lang)}</p>
        ))}
      </div>
    </div>
  );
}

/* ---------------- the ladder ---------------- */

function Ladder({ rows, nameOf, t, small, highlight }: { rows: Score[] | null | "loading"; nameOf: (d: number) => string; t: (fr: string, en: string) => string; small?: boolean; highlight?: string }) {
  if (rows === "loading") return <p className={`${styles.box} ${styles.blink}`}>{t("Connexion…", "Connecting…")}</p>;
  if (!rows) return <p className={styles.box}>{t("Classement indisponible pour l'instant.", "The ladder is unavailable for now.")}</p>;
  if (!rows.length) return <p className={styles.box}>{t("Personne encore : à toi d'ouvrir le bal !", "Nobody yet: be the first!")}</p>;
  return (
    <ol className={`${styles.box} ${styles.ladder} ${small ? styles.ladderSmall : ""}`}>
      {rows.slice(0, small ? 5 : 20).map((r, i) => (
        <li key={`${r.name}${i}`} className={highlight && r.name.toLowerCase() === highlight.toLowerCase() ? styles.me : ""}>
          <span className={styles.lRank}>{i + 1}</span>
          <Mini dex={r.starter} label={nameOf(r.starter)} />
          <span className={styles.lName}>{r.name}</span>
          <span className={styles.lWave}>
            {t("V.", "W")}
            {r.wave}
          </span>
          <span className={styles.lKo}>{r.kills} KO</span>
        </li>
      ))}
    </ol>
  );
}

/** a starter's first frame, cut from the atlas */
function Mini({ dex, label }: { dex: number; label: string }) {
  const a = useMemo(() => (SPRITES.mons[dex] ? anim(dex, "Idle") : null), [dex]);
  if (!a) return <span className={styles.mini} />;
  return (
    <span className={styles.mini} title={label}>
      <span style={{ width: a.w, height: a.h, backgroundImage: `url(${ATLAS_URL})`, backgroundPosition: `-${a.x}px -${a.y}px`, transform: `scale(0.5)` }} />
    </span>
  );
}
