// What the social renderers (render.mjs: pictures, motion.mjs: TikTok videos) share: the site's card data and prices,
// the fonts, small text helpers.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const APP = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const url = (p) => "file:///" + p.replace(/\\/g, "/");

let ASSETS = "";
/** the social branch's assets folder (app screenshots, photos) */
export const setAssets = (dir) => (ASSETS = dir);
export const asset = (name) => url(join(ASSETS, name));

const CATALOGS = { fr: "catalog.json", en: "catalog-en.json", ja: "catalog-ja.json" };
const OWNER = {};
for (const [lang, f] of Object.entries(CATALOGS)) {
  OWNER[lang] = new Map();
  for (const s of JSON.parse(readFileSync(join(APP, "src/data", f), "utf8"))) [s.id, ...s.subs].forEach((id) => OWNER[lang].set(id, s.id));
}
const sets = new Map();
const readSet = (lang, setId) => {
  const file = join(APP, "public/sets", lang === "fr" ? "" : lang, `${setId}.json`);
  if (!sets.has(file)) sets.set(file, JSON.parse(readFileSync(file, "utf8")));
  return sets.get(file);
};
/** a set by its key: "me05", "en:sv08" */
export const setOf = (key) => {
  const lang = /^(en|ja):/.exec(key)?.[1] ?? "fr";
  return readSet(lang, key.replace(/^(en|ja):/, ""));
};
/** "sv08-238", "en:sv08-238", "ja:SV8-033" -> the card, its set file, its language */
export function card(key) {
  const m = /^(en|ja):/.exec(key);
  const lang = m ? m[1] : "fr";
  const id = m ? key.slice(3) : key;
  const setId = OWNER[lang].get(id.slice(0, id.lastIndexOf("-")));
  if (!setId) throw new Error(`unknown card ${key}`);
  const set = readSet(lang, setId);
  const c = set.cards.find((x) => x.id === id);
  if (!c) throw new Error(`card ${key} not in ${setId}`);
  return { ...c, set, lang, hi: `${c.img}/high.webp` };
}

/**
 * A card's daily trend, from public/history/<lang>/<set>.json (scripts/price-history.mjs, since 2026-10-04): its days
 * with a price from `from` on (YYYY-MM-DD, else all), the first and last, the change in %.
 */
export function historyOf(key, from) {
  const c = card(key);
  const h = JSON.parse(readFileSync(join(APP, "public/history", c.lang, `${c.set.id}.json`), "utf8"));
  const vals = h.cards[c.id] ?? [];
  const pts = h.days.map((day, i) => ({ day, v: vals[i] })).filter((p) => p.v != null && (!from || p.day >= from));
  if (pts.length < 2) throw new Error(`${key}: not enough price history`);
  return { c, pts, first: pts[0], last: pts.at(-1), chg: (pts.at(-1).v / pts[0].v - 1) * 100 };
}

/** "4 oct." */
export const dayShort = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
/** a price on the chart: no cents from 20 on */
const tick = (v, set) => (set.currency === "USD" ? "$" : "") + (v >= 20 ? Math.round(v).toLocaleString("fr-FR").replace(/ /g, " ") : v.toFixed(2).replace(".", ",")) + (set.currency === "USD" ? "" : " €");

/**
 * The price curve, as an SVG (w × h): days spread by date, a soft grid, the line (pathLength 1: `.line` can draw it in),
 * a dot a day, the first, last and extreme prices labelled. `anim` gives each dot and label its `--at` (the video).
 */
export function curveSvg({ pts, c }, w, h, anim) {
  const up = pts.at(-1).v >= pts[0].v;
  const color = up ? "#3d8b2f" : "#b8433d";
  const [L, R, T, B] = [12, 24, 70, 70];
  const t0 = Date.parse(pts[0].day), t1 = Date.parse(pts.at(-1).day);
  const vs = pts.map((p) => p.v);
  const lo = Math.min(...vs), hi = Math.max(...vs), pad = (hi - lo || hi * 0.1) * 0.18;
  const [y0, y1] = [lo - pad, hi + pad];
  const X = (d) => L + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (w - L - R);
  const Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (h - T - B);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${X(p.day).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
  const at = (i) => (anim ? anim.t0 + (anim.t1 - anim.t0) * (i / (pts.length - 1)) : 0);
  const ext = up ? vs.indexOf(lo) : vs.indexOf(hi);
  // the dip before a rise (or the peak before a fall) too, if its pill has room beside the first and last ones
  const room = (i) => Math.abs(X(pts[i].day) - X(pts[ext].day)) > 150;
  const labelled = new Set([0, pts.length - 1, ...(ext > 0 && ext < pts.length - 1 && room(0) && room(pts.length - 1) ? [ext] : [])]);
  // a price in a pill: over the point where the curve has room above (it rose to it, or it is low), else under it
  const label = (p, i) => {
    const text = tick(p.v, c.set);
    const bw = text.length * 17 + 22;
    const x = Math.min(Math.max(X(p.day), L + bw / 2), w - R - bw / 2 + 14);
    const prev = pts[i - 1]?.v ?? p.v, next = pts[i + 1]?.v ?? p.v;
    const peak = p.v >= prev && p.v >= next;
    const above = i === pts.length - 1 ? p.v >= prev : peak || Y(p.v) > T + 90;
    const y = Y(p.v) + (above ? -54 : 22);
    return `<g class="lbl" style="--at:${(at(i) + 0.15).toFixed(2)}s"><rect x="${x - bw / 2}" y="${y}" width="${bw}" height="34" rx="8" fill="${color}"/>
      <text x="${x}" y="${y + 26}" text-anchor="middle" font-family="Press" font-size="18" fill="#f4ecdc">${text}</text></g>`;
  };
  const grid = [0.25, 0.5, 0.75].map((k) => `<line x1="${L}" x2="${w - R}" y1="${T + k * (h - T - B)}" y2="${T + k * (h - T - B)}" stroke="#2b2230" stroke-opacity=".12" stroke-width="2" stroke-dasharray="6 8"/>`).join("");
  const days = [pts[0], pts[Math.floor(pts.length / 2)], pts.at(-1)]
    .map((p, i) => `<text x="${[L + 4, X(p.day), w - R][i]}" y="${h - 14}" text-anchor="${["start", "middle", "end"][i]}" font-family="VT" font-size="30" fill="#6f6068">${dayShort(p.day)}</text>`)
    .join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:block;overflow:visible">${grid}${days}
    <path class="line" d="${line}" pathLength="1" fill="none" stroke="${color}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p, i) => `<circle class="dot" style="--at:${at(i).toFixed(2)}s;transform-origin:${X(p.day).toFixed(1)}px ${Y(p.v).toFixed(1)}px" cx="${X(p.day).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="${labelled.has(i) ? 10 : 6}" fill="${labelled.has(i) ? color : "#f4ecdc"}" stroke="${color}" stroke-width="4"/>`).join("")}
    ${pts.map((p, i) => (labelled.has(i) ? label(p, i) : "")).join("")}</svg>`;
}
/** "+46 %", "−37 %" */
export const pctOf = (v) => `${v < 0 ? "-" : "+"}${Math.abs(Math.round(v))}%`;
/** a set's name for a Press Start kicker: capitals, no accents (the font has none) */
export const plain = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

export const money = (n, set) =>
  n == null ? "—" : set.currency === "USD" ? `$${n.toFixed(2)}` : `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
export const dayOf = (set) => new Date(set.pricesUpdated).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
export const market = (set) => (set.currency === "USD" ? "TCGplayer" : "Cardmarket");
export const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** texts may carry <br>, <b>, <em> on purpose: those three are let through */
export const txt = (s = "") => esc(s).replace(/&lt;(\/?)(br|b|em)\s*\/?&gt;/g, "<$1$2>");

export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .32 0 0 0 0 .22 0 0 0 0 .18 0 0 0 .11 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
export const FONT_FACES = `
@font-face { font-family: Press; src: url(${url(join(APP, "src/assets/fonts/PressStart2P-Regular.ttf"))}); }
@font-face { font-family: VT; src: url(${url(join(APP, "src/assets/fonts/VT323-Regular.ttf"))}); }`;
export const AVATAR = url(join(APP, "public/email/warwick.png"));
export const DESK = url(join(APP, "src/assets/share-desk.jpg"));
