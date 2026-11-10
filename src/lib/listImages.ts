"use client";

import { catalogSet, setIdOfCard } from "./catalog";
import { formatPrice, priceOf, variantLabel } from "./price";
import type { CardData, Variant } from "./types";

/**
 * The trade list as pictures (Johan, 2026-11-10): Facebook groups turn down posts with a link, so « Je cherche » and
 * « J'échange » can go out as a few images instead, drawn here on a canvas (nothing on the server). Warwick and
 * nookdex.com sit small in a corner: the tool shows itself without pushing. The scans come through our own address
 * (scanSrc); one that still fails gets a drawn card with its name.
 */

export interface ListItem {
  key: string;
  card: CardData | undefined;
  /** a double offered: its version and how many */
  variant?: Variant;
  n?: number;
}

/** cards per picture: columns × rows */
export const DENSITIES = { 20: [5, 4], 30: [6, 5], 42: [7, 6] } as const;
export type Density = keyof typeof DENSITIES;
/** the density a list of this many cards starts on: few pictures, cards still big enough to read */
export const densityFor = (count: number): Density => (count <= 40 ? 20 : count <= 150 ? 30 : 42);

const W = 1080;
const PAD = 36;
const HEAD = 150;
const FOOT = 96;
const GAP = 16;
const RATIO = 342 / 245;

const INK = "#2b2230";
const PAPER = "#f6ecd6";

/** by set (the newest first), then by number */
export function sortItems(items: ListItem[]): ListItem[] {
  const rel = (it: ListItem) => catalogSet(setIdOfCard(it.key) ?? "")?.releaseDate ?? "";
  return [...items].sort((a, b) => {
    const r = rel(b).localeCompare(rel(a));
    if (r) return r;
    const s = (setIdOfCard(a.key) ?? "").localeCompare(setIdOfCard(b.key) ?? "");
    if (s) return s;
    return (a.card?.num ?? a.key).localeCompare(b.card?.num ?? b.key, undefined, { numeric: true });
  });
}

const fontOf = (v: string, fallback: string) => {
  const f = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  return f || fallback;
};

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((done) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = src;
  });
}

/** a card's small scan at our own address (next.config rewrites): a canvas can't use pictures without CORS, and TCGdex's
 * CDN sometimes sends its header twice */
function scanSrc(img: string) {
  const tcgdex = img.match(/^https:\/\/assets\.tcgdex\.net\/(.+)$/);
  if (tcgdex) return `/cardimg/tcgdex/${tcgdex[1]}/low.webp`;
  const tp = img.match(/\/scans\/tp\/(\d+)$/);
  if (tp) return `/cardimg/tp/${tp[1]}`;
  const ours = img.match(/^https:\/\/(?:www\.)?nookdex\.com(\/.+)$/);
  return `${ours ? ours[1] : img}/low.webp`;
}

const kept = new Map<string, Promise<HTMLImageElement | null>>();
const imgOnce = (src: string) => {
  let p = kept.get(src);
  if (!p) kept.set(src, (p = loadImg(src)));
  return p;
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** a line cut to fit, with an ellipsis */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** words wrapped on a few lines, centred */
function wrap(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, max: number, lh: number, lines: number) {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  out.slice(0, lines).forEach((l, i) => ctx.fillText(fit(ctx, l, max), cx, y + i * lh));
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string, fg: string, size: number, right = false) {
  ctx.font = `${size}px ${fontOf("--font-vt", "monospace")}`;
  const w = ctx.measureText(text).width + size * 0.7;
  const h = size * 1.15;
  const left = right ? x - w : x;
  ctx.fillStyle = bg;
  roundRect(ctx, left, y, w, h, 4);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + w / 2, y + h / 2 + 1);
}

export interface PageText {
  title: string;
  /** the title's colour: blue for « je cherche », gold for « j'échange » */
  color: string;
  /** « Johan · 120 cartes » */
  sub: string;
  /** « 1/6 » */
  page: string;
  /** the price source, bottom left (shown with the prices) */
  note: string;
  /** one set picked: its logo on the right of the header */
  logo?: string;
}

/** One picture of the list: its header, the cards in a grid, Warwick and nookdex.com in the corner */
export async function drawPage(items: ListItem[], density: Density, prices: boolean, text: PageText): Promise<Blob> {
  const [cols, maxRows] = DENSITIES[density];
  const rows = Math.max(1, Math.min(maxRows, Math.ceil(items.length / cols)));
  const cw = (W - PAD * 2 - GAP * (cols - 1)) / cols;
  const ch = cw * RATIO;
  const label = cols >= 7 ? 22 : cols >= 6 ? 24 : 27;
  const cell = ch + label + 8;
  const H = Math.round(HEAD + PAD + rows * cell + (rows - 1) * GAP + FOOT);
  const vt = fontOf("--font-vt", "monospace");
  const press = fontOf("--font-press", "monospace");
  await Promise.all([document.fonts.load(`20px ${vt}`), document.fonts.load(`20px ${press}`)]).catch(() => {});

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // the header: a night band, the side's name and the page
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, HEAD);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = text.color;
  ctx.font = `34px ${press}`;
  ctx.fillText(text.title, PAD, 70);
  ctx.fillStyle = "#efe3c8";
  ctx.font = `34px ${vt}`;
  ctx.fillText(fit(ctx, text.sub, W - PAD * 2 - (text.logo ? 300 : 120)), PAD, 118);
  // one set: its logo on the right, the page under it
  const logo = text.logo ? await imgOnce(text.logo) : null;
  const right = W - PAD;
  if (logo) {
    const k = Math.min(260 / logo.width, 84 / logo.height);
    const lw = logo.width * k;
    const lh = logo.height * k;
    ctx.drawImage(logo, right - lw, (HEAD - lh) / 2 - (text.page ? 10 : 0), lw, lh);
    ctx.textAlign = "right";
    ctx.font = `16px ${press}`;
    ctx.fillStyle = "#8a7fae";
    if (text.page) ctx.fillText(text.page, right - lw / 2 + ctx.measureText(text.page).width / 2, HEAD - 14);
  } else {
    ctx.textAlign = "right";
    ctx.font = `26px ${press}`;
    ctx.fillStyle = "#8a7fae";
    ctx.fillText(text.page, right, 70);
  }

  const imgs = await Promise.all(items.map((it) => (it.card?.img && !it.card.unavailable ? imgOnce(scanSrc(it.card.img)) : Promise.resolve(null))));
  items.forEach((it, i) => {
    const x = PAD + (i % cols) * (cw + GAP);
    const y = HEAD + PAD + Math.floor(i / cols) * (cell + GAP);
    // the card, with a soft drop shadow
    ctx.save();
    ctx.shadowColor = "rgba(40, 20, 30, 0.28)";
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "#3b3048";
    roundRect(ctx, x, y, cw, ch, cw * 0.045);
    ctx.fill();
    ctx.restore();
    const img = imgs[i];
    if (img) {
      ctx.save();
      roundRect(ctx, x, y, cw, ch, cw * 0.045);
      ctx.clip();
      ctx.drawImage(img, x, y, cw, ch);
      ctx.restore();
    } else {
      // no scan we may draw: the card's name on a plain card
      ctx.fillStyle = "#efe3c8";
      ctx.font = `${Math.round(cw / 7.5)}px ${vt}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      wrap(ctx, it.card?.name ?? it.key, x + cw / 2, y + ch * 0.42, cw - 16, cw / 7, 3);
    }
    if (it.variant && it.variant !== "normal") pill(ctx, variantLabel(it.variant), x + 6, y + 6, "#ffd35a", INK, label - 4);
    if (it.n && it.n > 1) pill(ctx, `×${it.n}`, x + cw - 6, y + 6, "#fff8e8", INK, label - 2, true);

    // under it: the set's code and number, the price on the right
    const code = catalogSet(setIdOfCard(it.key) ?? "")?.code ?? "";
    const ly = y + ch + 6 + label * 0.8;
    ctx.textBaseline = "alphabetic";
    const price = prices && it.card ? formatPrice(priceOf(it.card, it.variant ?? it.card.variants[0] ?? "normal", "trend")) : "";
    const ref = `${code} ${it.card?.num ?? ""}`.trim();
    // smaller rather than cut: the number is how a trader finds the card
    let size = label;
    do ctx.font = `${size}px ${vt}`;
    while (size-- > 15 && ctx.measureText(`${ref} ${price}`).width > cw);
    ctx.textAlign = "right";
    ctx.fillStyle = "#3d7a4a";
    if (price) ctx.fillText(price, x + cw, ly);
    const pw = price ? ctx.measureText(price).width + 6 : 0;
    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    ctx.fillText(fit(ctx, ref, cw - pw), x, ly);
  });

  // the corner: Warwick and the address, small (the picture speaks for itself)
  const fy = H - FOOT / 2;
  const cat = await imgOnce("/scene/warwick-head.webp");
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.fillStyle = "#6f6280";
  ctx.font = `28px ${vt}`;
  ctx.fillText("nookdex.com", W - PAD, fy + 14);
  const sw = ctx.measureText("nookdex.com").width;
  ctx.font = `16px ${press}`;
  ctx.fillStyle = INK;
  ctx.fillText("NookDex", W - PAD, fy - 12);
  if (cat) {
    const s = 56;
    const cx = W - PAD - Math.max(sw, ctx.measureText("NookDex").width) - 12 - s;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx + s / 2, fy, s / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#fff8e8";
    ctx.fill();
    ctx.clip();
    ctx.drawImage(cat, cx + 2, fy - s / 2 + 3, s - 4, (s - 4) * (150 / 160));
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx + s / 2, fy, s / 2, 0, Math.PI * 2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  if (prices && text.note) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#8a7c6a";
    ctx.font = `22px ${vt}`;
    ctx.fillText(text.note, PAD, fy);
  }

  return new Promise((done, fail) => canvas.toBlob((b) => (b ? done(b) : fail(new Error("canvas"))), "image/jpeg", 0.9));
}
