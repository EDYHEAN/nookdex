"use client";

// The NookBoy: the Game Boy on the desk, zoomed in, with a survival game in it. Loaded only when it's opened
// (the room imports it lazily): the engine, its sprites and its sounds stay out of the room's bundle.

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MOVES, ITEMS, NAMES, STARTERS, say, type Lang } from "@/lib/game/data";
import { gsfx, music } from "@/lib/game/audio";
import { Game, type FireMode, type Phase } from "@/lib/game/engine";
import { ATLAS_URL, Gfx, PALETTES, SH, SPRITES, SW, anim, loadAtlas } from "@/lib/game/gfx";
import { lastName, submitScore, topScores, type Score } from "@/lib/game/scores";
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

type Screen = "boot" | "menu" | "ladder" | "options" | "credits";
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
    const ctx = canvas.current!.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      g.tick((now - last) / 1000);
      last = now;
      g.draw(ctx);
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
    const playing = phase === "play" || phase === "levelup" || phase === "paused" || phase === "evolve";
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

  const openLadder = async () => {
    setLadder("loading");
    setLadder(await topScores(20));
  };

  /* ---------------- what each button does, screen by screen ---------------- */

  const menuItems: { label: string; go: () => void }[] =
    screen === "menu"
      ? [
          { label: t("Jouer", "Play"), go: () => (gsfx.ok(), setCursor(0), g?.toSelect()) },
          { label: t("Classement", "Ladder"), go: () => (gsfx.ok(), setScreen("ladder"), void openLadder()) },
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
          setCursor(2);
          setScreen("menu");
        }
        return;
      }
      if (b === "b" || b === "a" || b === "start") {
        gsfx.back();
        setCursor(screen === "ladder" ? 1 : 3);
        setScreen("menu");
      }
      return;
    }
    if (p === "select") {
      if (b === "left" || b === "right") {
        gsfx.move();
        eng.select(eng.selected + (b === "left" ? -1 : 1));
      } else if (b === "a" || b === "start") {
        gsfx.ok();
        setSent("idle");
        eng.start(eng.selected);
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
        quitRun();
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
      gsfx.ok();
      void openLadder();
    } else gsfx.back();
  };

  /* ---------------- keyboard and mouse ---------------- */

  const pressRef = useRef(press);
  useEffect(() => {
    pressRef.current = press;
  });
  useEffect(() => {
    if (!g) return;
    const set = (code: string, down: boolean) => {
      const b = KEYS[code];
      if (b === "up" || b === "down" || b === "left" || b === "right") g.move(b, down);
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
      if (eng.phase === "over") return;
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
              <span className={styles.logoBig}>POKé</span>
              <span className={styles.logoBig2}>SURVIVAL</span>
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
      if (screen === "ladder")
        return (
          <div className={styles.page}>
            <h2>{t("CLASSEMENT", "LADDER")}</h2>
            <Ladder rows={ladder} nameOf={nameOf} t={t} />
            <p className={styles.keys} onClick={() => press("b")}>
              {t("B : retour", "B: back")}
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
          <h2>{t("CHOISIS TON POKéMON", "CHOOSE YOUR POKéMON")}</h2>
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
          <p className={styles.keys}>{t("◂ ▸ choisir · Entrée : c'est parti !", "◂ ▸ choose · Enter: let's go!")}</p>
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
              const def = c.kind === "move" ? MOVES.find((m) => m.id === c.id)! : c.kind === "item" ? ITEMS.find((it) => it.id === c.id)! : null;
              const tag = c.kind === "move" ? t("CAPACITÉ", "MOVE") : c.kind === "item" ? t("OBJET", "ITEM") : t("SOIN", "HEAL");
              return (
                <button
                  key={`${c.kind}${c.id}`}
                  className={`${styles.card} ${i === cursor ? styles.on : ""} ${c.kind === "move" ? styles[`t_${(def as (typeof MOVES)[number]).type}`] : ""}`}
                  onPointerEnter={() => i !== cursor && (gsfx.move(), setCursor(i))}
                  onClick={() => g.choose(c)}
                >
                  <span className={styles.cardTag}>
                    {i + 1} · {tag}
                  </span>
                  <span className={styles.cardName}>{def ? say(def.name, lang) : t("Baie Sitrus", "Sitrus Berry")}</span>
                  <span className={styles.cardLvl}>
                    {c.kind === "heal" ? "+40 % PV" : c.level === 1 ? t("nouveau !", "new!") : `${"●".repeat(c.level)}${"○".repeat(5 - c.level)}`}
                  </span>
                  <span className={styles.cardDesc}>{def ? say(def.desc, lang) : t("Soigne 40 % de tes PV.", "Heals 40% of your HP.")}</span>
                </button>
              );
            })}
          </div>
          {g.moves.length >= 4 && g.choices.every((c) => c.kind !== "move" || c.level > 1) && (
            <p className={styles.keys}>{t(`${nameOf(g.dex)} connaît déjà 4 capacités.`, `${nameOf(g.dex)} already knows 4 moves.`)}</p>
          )}
        </div>
      );
    if (phase === "paused")
      return (
        <div className={styles.center}>
          <ul className={`${styles.box} ${styles.menu}`}>
            <li className={styles.menuTitle}>PAUSE</li>
            {[t("Reprendre", "Resume"), t("Abandonner", "Give up")].map((l, i) => (
              <li key={l} className={i === cursor ? styles.on : ""} onPointerEnter={() => setCursor(i)} onClick={() => (i ? quitRun() : g.pause(false))}>
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
          <p className={`${styles.box} ${styles.ko}`}>{t(`${nameOf(run.dex)} est K.O. !`, `${nameOf(run.dex)} fainted!`)}</p>
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
                <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder={t("Dresseur", "Trainer")} spellCheck={false} />
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
                g.toSelect();
              }}
            >
              {t("Rejouer", "Play again")}
            </button>
            <button onClick={quitRun}>{t("Menu", "Menu")}</button>
          </div>
        </div>
      );
    return null;
  })();

  const L = (b: Button) => (pressed[b] ? styles.down : "");

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
      <div className={styles.shell} style={{ width: SHELL_W, height: SHELL_H, transform: `translateX(-50%) scale(${scale})` }}>
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
            ref={screenRef}
            className={styles.screen}
            style={screenVars}
            data-palette={pal.id}
            onPointerMove={(e) => g?.aimAt(toGame(e))}
            onPointerLeave={() => g?.aimAt(null)}
            onPointerDown={(e) => {
              g?.aimAt(toGame(e));
              if ((e.target as HTMLElement).tagName === "CANVAS") g?.fire("mouse", true);
            }}
            onPointerUp={() => g?.fire("mouse", false)}
            onContextMenu={(e) => e.preventDefault()}
          >
            <canvas ref={canvas} width={SW} height={SH} className={`${styles.canvas} ${phase === "play" && opts.fire !== "nearest" ? styles.aiming : ""}`} />
            {overlay && <div className={styles.ui}>{overlay}</div>}
            <div className={styles.lcd} />
          </div>
        </div>
        <p className={styles.brand}>
          Nook<b>Boy</b>
          <sup>DEX</sup>
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
      <p className={styles.hint} style={{ width: hintW, display: hintW < 150 ? "none" : undefined }}>
        {t("ZQSD / flèches : bouger · souris : viser · Entrée : pause · Tab : palette", "WASD / arrows: move · mouse: aim · Enter: pause · Tab: palette")}
      </p>
    </motion.div>
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
