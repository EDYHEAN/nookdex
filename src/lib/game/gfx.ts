// The NookBoy's pictures: the sprite atlas (built by scripts/build-game.mjs), its palettes, a 3x5 pixel font and the
// grass tiles. Everything is drawn on a 320x288 canvas, scaled up without smoothing.

import raw from "@/data/game-sprites.json";
import type { Elem } from "./data";

export const SW = 320;
export const SH = 288;

export type AnimName = "Walk" | "Idle" | "Shoot" | "Hurt" | "Faint" | "Pose";
export interface Anim {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  rows: number;
  /** frame durations, 60ths of a second */
  d: number[];
}
interface Mon {
  anims: Partial<Record<AnimName, Anim>>;
  foot: number;
}
export const SPRITES = raw as unknown as { w: number; h: number; mons: Record<string, Mon>; credits: { name: string; dex: number[] }[] };
export const ATLAS_URL = "/game/sprites.png";

export const mon = (dex: number) => SPRITES.mons[dex];
/** an animation, or the closest one the sprite has */
export function anim(dex: number, name: AnimName): Anim {
  const a = mon(dex).anims;
  return (a[name] ?? (name === "Pose" ? a.Idle : undefined) ?? (name === "Faint" ? a.Hurt : undefined) ?? a.Idle ?? a.Walk)!;
}
export const animSeconds = (a: Anim) => a.d.reduce((s, x) => s + x, 0) / 60;
/** the frame shown t seconds into an animation (looping, or held on the last frame) */
export function frameAt(a: Anim, t: number, loop = true) {
  let f = Math.max(0, t) * 60;
  const total = a.d.reduce((s, x) => s + x, 0);
  if (loop) f %= total;
  else if (f >= total) return a.d.length - 1;
  for (let i = 0; i < a.d.length; i++) {
    f -= a.d[i];
    if (f < 0) return i;
  }
  return a.d.length - 1;
}

/** PMD directions: 0 down, 1 down-right, 2 right, 3 up-right, 4 up, 5 up-left, 6 left, 7 down-left */
export function dirOf(dx: number, dy: number) {
  const a = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (((2 - Math.round(a / 45)) % 8) + 8) % 8;
}

/* ---------------- palettes ---------------- */

export interface Palette {
  id: string;
  name: [string, string];
  /** four shades, darkest first; none = the sprites' own colours */
  shades: string[] | null;
}

export const PALETTES: Palette[] = [
  { id: "color", name: ["Couleurs", "Colours"], shades: null },
  { id: "dmg", name: ["DMG vert", "DMG green"], shades: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"] },
  { id: "pocket", name: ["Pocket", "Pocket"], shades: ["#1f1f1f", "#4d533c", "#8b956d", "#c4cfa1"] },
  { id: "lofi", name: ["Lofi violet", "Lofi violet"], shades: ["#2b2230", "#6b4a7a", "#c08cb0", "#f6e2e9"] },
];

/** the colours of everything that isn't a sprite, in the colour palette */
const COLORS = {
  grass: "#7fb26a",
  grassDark: "#5f9457",
  grassLight: "#9cc77f",
  blade: "#4f7f4b",
  flowerA: "#f4d6e4",
  flowerB: "#ffd36e",
  flowerC: "#b9a7f0",
  pebble: "#c9c2b4",
  shadow: "#2b2230",
  white: "#fff8f0",
  ink: "#2b2230",
  fire: "#ff8a3d",
  fire2: "#ffd36e",
  water: "#5fb8ff",
  water2: "#d8f1ff",
  elec: "#ffe14d",
  elec2: "#fffbe0",
  grassFx: "#7ddc6a",
  grassFx2: "#d6ffc4",
  ice: "#a8ecff",
  ice2: "#ffffff",
  ghost: "#8a5cc8",
  ghost2: "#d8b6ff",
  ground: "#b88a52",
  ground2: "#e6c79a",
  psy: "#ff7ac0",
  psy2: "#ffd2ea",
  normal: "#f0e6d6",
  normal2: "#ffffff",
  fly: "#bfe3ff",
  fly2: "#ffffff",
  dragon: "#7a6cf0",
  dragon2: "#d6ceff",
  poison: "#a35bc9",
  poison2: "#d9f59a",
  coin: "#ffc93d",
  coin2: "#fff6c2",
  rock: "#8f8577",
  xp: "#7fd8ff",
  xp2: "#e8fbff",
  xpBig: "#ffb3e0",
  heal: "#ff6b8a",
  hp: "#7ee08a",
  hpMid: "#ffd36e",
  hpLow: "#ff5d5d",
  ui: "#fff8f0",
  uiDim: "#c9b9d6",
  uiDark: "#2b2230",
  gold: "#ffd36e",
  night: "#2a2350",
};
export type ColorKey = keyof typeof COLORS;
export const TYPE_FX: Record<Elem, [ColorKey, ColorKey]> = {
  fire: ["fire", "fire2"],
  water: ["water", "water2"],
  elec: ["elec", "elec2"],
  grass: ["grassFx", "grassFx2"],
  ice: ["ice", "ice2"],
  ghost: ["ghost", "ghost2"],
  ground: ["ground", "ground2"],
  psy: ["psy", "psy2"],
  normal: ["normal", "normal2"],
  fly: ["fly", "fly2"],
  dragon: ["dragon", "dragon2"],
  poison: ["poison", "poison2"],
};

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255);
};
const shadeOf = (l: number) => (l < 60 ? 0 : l < 125 ? 1 : l < 195 ? 2 : 3);

export class Gfx {
  atlas: HTMLImageElement | HTMLCanvasElement;
  private source: HTMLImageElement;
  /** white silhouettes (hit flash, evolution), per palette */
  white: HTMLCanvasElement;
  palette = PALETTES[0];
  c: Record<ColorKey, string> = { ...COLORS };
  tiles: HTMLCanvasElement;
  private fonts = new Map<string, HTMLCanvasElement>();
  private cache = new Map<string, { atlas: HTMLCanvasElement | HTMLImageElement; white: HTMLCanvasElement }>();

  constructor(img: HTMLImageElement) {
    this.source = img;
    this.atlas = img;
    this.white = silhouette(img, "#ffffff");
    this.cache.set("color", { atlas: img, white: this.white });
    this.tiles = makeTiles(this.c);
  }

  setPalette(p: Palette) {
    this.palette = p;
    const shades = p.shades;
    this.c = { ...COLORS };
    if (shades) for (const k of Object.keys(COLORS) as ColorKey[]) this.c[k] = shades[shadeOf(lum(COLORS[k]))];
    let got = this.cache.get(p.id);
    if (!got) {
      const atlas = shades ? quantize(this.source, shades) : this.source;
      got = { atlas, white: silhouette(this.source, shades ? shades[3] : "#ffffff") };
      this.cache.set(p.id, got);
    }
    this.atlas = got.atlas;
    this.white = got.white;
    this.tiles = makeTiles(this.c);
    this.fonts.clear();
  }

  /** a Pokémon's frame, its feet's centre at (x, y) */
  sprite(ctx: CanvasRenderingContext2D, dex: number, name: AnimName, frame: number, dir: number, x: number, y: number, opts?: { white?: boolean; alpha?: number; scale?: number }) {
    const a = anim(dex, name);
    const row = Math.min(dir <= 4 ? dir : 8 - dir, a.rows - 1);
    const flip = dir > 4 && a.rows > 1;
    const s = opts?.scale ?? 1;
    const sx = a.x + (frame % a.d.length) * (a.w + 1);
    const sy = a.y + row * (a.h + 1);
    if (opts?.alpha != null) ctx.globalAlpha = opts.alpha;
    ctx.setTransform(flip ? -s : s, 0, 0, s, Math.round(x), Math.round(y));
    ctx.drawImage(opts?.white ? this.white : this.atlas, sx, sy, a.w, a.h, -a.cx, -a.cy, a.w, a.h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (opts?.alpha != null) ctx.globalAlpha = 1;
  }

  /** pixel text, 3x5 glyphs with a one-pixel outline; returns its width */
  text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, color: ColorKey = "ui", opts?: { align?: "left" | "center" | "right"; outline?: ColorKey; scale?: number }) {
    const s = opts?.scale ?? 1;
    const up = deaccent(str.toUpperCase());
    const w = textWidth(up) * s;
    let cx = Math.round(opts?.align === "center" ? x - w / 2 : opts?.align === "right" ? x - w : x);
    const sheet = this.font(color, opts?.outline ?? "uiDark");
    for (const ch of up) {
      const i = GLYPH_INDEX.get(ch);
      if (i != null) ctx.drawImage(sheet, i * 6, 0, 6, 8, cx - s, Math.round(y) - s, 6 * s, 8 * s);
      cx += (ch === " " ? 3 : 4) * s;
    }
    return w;
  }

  private font(color: ColorKey, outline: ColorKey) {
    const key = color + outline;
    let sheet = this.fonts.get(key);
    if (!sheet) {
      sheet = makeFont(this.c[color], outline === color ? null : this.c[outline]);
      this.fonts.set(key, sheet);
    }
    return sheet;
  }
}

export const loadAtlas = () =>
  new Promise<HTMLImageElement>((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = ko;
    img.src = ATLAS_URL;
  });

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function silhouette(img: CanvasImageSource & { width: number; height: number }, color: string) {
  const c = canvas(img.width, img.height);
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

function quantize(img: HTMLImageElement, shades: string[]) {
  const c = canvas(img.width, img.height);
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  const rgb = shades.map((h) => {
    const n = parseInt(h.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  });
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 8) continue;
    const s = rgb[shadeOf(0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2])];
    px[i] = s[0];
    px[i + 1] = s[1];
    px[i + 2] = s[2];
    px[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return c;
}

/* ---------------- 3x5 font ---------------- */

const GLYPHS: Record<string, string> = {
  "0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "3": "111001011001111", "4": "101101111001001",
  "5": "111100111001111", "6": "111100111101111", "7": "111001010010010", "8": "111101111101111", "9": "111101111001111",
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111",
  F: "111100110100100", G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010",
  K: "101101110101101", L: "100100100100111", M: "101111111101101", N: "110101101101101", O: "010101101101010",
  P: "110101110100100", Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101", Y: "101101010010010",
  Z: "111001010100111", ".": "000000000000010", ":": "000010000010000", "/": "001001010100100", "!": "010010010000010",
  "?": "110001010000010", "+": "000010111010000", "-": "000000111000000", "%": "101001010100101", "×": "000101010101000",
  "'": "010010000000000", "♥": "000101111111010", "★": "010111010101000", "♀": "010101010111010", "♂": "011001010101010",
  ",": "000000000010100", "(": "010100100100010", ")": "010001001001010", " ": "000000000000000",
};
const GLYPH_LIST = Object.keys(GLYPHS);
const GLYPH_INDEX = new Map(GLYPH_LIST.map((g, i) => [g, i]));
const deaccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
export const textWidth = (up: string) => [...deaccent(up.toUpperCase())].reduce((w, ch) => w + (ch === " " ? 3 : 4), 0) - 1;

function makeFont(color: string, outline: string | null) {
  const c = canvas(GLYPH_LIST.length * 6, 8);
  const x = c.getContext("2d")!;
  GLYPH_LIST.forEach((g, i) => {
    const bits = GLYPHS[g];
    const on = (px: number, py: number) => px >= 0 && px < 3 && py >= 0 && py < 5 && bits[py * 3 + px] === "1";
    for (let py = -1; py < 6; py++)
      for (let px = -1; px < 4; px++) {
        if (on(px, py)) {
          x.fillStyle = color;
          x.fillRect(i * 6 + 1 + px, 1 + py, 1, 1);
        } else if (outline && (on(px - 1, py) || on(px + 1, py) || on(px, py - 1) || on(px, py + 1))) {
          x.fillStyle = outline;
          x.fillRect(i * 6 + 1 + px, 1 + py, 1, 1);
        }
      }
  });
  return c;
}

/* ---------------- grass tiles (16x16): plain, tufts, two kinds of flowers swaying (2 frames), tall grass, pebbles ---------------- */

export const TILE = 16;
export const T = { plain: 0, plain2: 1, tuft: 2, flowerA: 3, flowerB: 5, tall: 7, pebble: 9, clover: 10 } as const;

function makeTiles(c: Record<ColorKey, string>) {
  const t = canvas(TILE * 11, TILE);
  const x = t.getContext("2d")!;
  const px = (tile: number, a: number, b: number, col: string, w = 1, h = 1) => {
    x.fillStyle = col;
    x.fillRect(tile * TILE + a, b, w, h);
  };
  const base = (tile: number, seed: number) => {
    x.fillStyle = c.grass;
    x.fillRect(tile * TILE, 0, TILE, TILE);
    for (let i = 0; i < 5; i++) px(tile, (seed * 7 + i * 5) % 15, (seed * 3 + i * 7) % 15, c.grassLight);
    for (let i = 0; i < 3; i++) px(tile, (seed * 11 + i * 9) % 15, (seed * 5 + i * 11) % 15, c.grassDark);
  };
  base(0, 1);
  base(1, 4);
  base(2, 2);
  // a tuft: three blades
  [[5, 9], [7, 8], [9, 9]].forEach(([a, b]) => {
    px(2, a, b, c.blade, 1, 3);
  });
  px(2, 6, 10, c.blade, 1, 2);
  // flowers, swaying one pixel between the two frames
  for (const [tile, col] of [[3, c.flowerA], [5, c.flowerB]] as [number, string][]) {
    for (let f = 0; f < 2; f++) {
      base(tile + f, tile);
      for (const [a, b] of [[4, 5], [10, 9]]) {
        const s = f;
        px(tile + f, a, b + 2, c.blade, 1, 3);
        px(tile + f, a - 1 + s, b - 1, col);
        px(tile + f, a + 1 + s, b - 1, col);
        px(tile + f, a + s, b - 2, col);
        px(tile + f, a + s, b, col);
        px(tile + f, a + s, b - 1, c.flowerB === col ? c.white : c.flowerB);
      }
    }
  }
  // tall grass, the classic encounter patch: rows of blades
  for (let f = 0; f < 2; f++) {
    x.fillStyle = c.grassDark;
    x.fillRect((7 + f) * TILE, 0, TILE, TILE);
    for (let row = 0; row < 2; row++)
      for (let k = 0; k < 4; k++) {
        const a = k * 4 + (row % 2) * 2 + f;
        const b = row * 8 + 1;
        px(7 + f, a, b + 2, c.blade, 1, 5);
        px(7 + f, a + 1, b, c.grassLight, 1, 5);
        px(7 + f, a + 2, b + 3, c.blade, 1, 3);
      }
  }
  base(9, 6);
  px(9, 5, 7, c.pebble, 3, 2);
  px(9, 6, 6, c.pebble, 1, 1);
  px(9, 5, 9, c.grassDark, 3, 1);
  px(9, 11, 11, c.pebble, 2, 1);
  base(10, 3);
  for (const [a, b] of [[4, 4], [11, 10]]) {
    px(10, a, b, c.grassFx, 2, 2);
    px(10, a + 2, b + 1, c.grassFx, 1, 2);
    px(10, a - 1, b + 1, c.grassFx, 1, 1);
  }
  return t;
}
