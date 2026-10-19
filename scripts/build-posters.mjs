// The wall posters (Johan, 2026-10-19: the player picks the poster above the desk; no Poké Ball by default). Gemini paints
// only their artworks, flat, on one sheet (img/posters.jpg, 4x2 on white, prompt in docs/prompts-gemini.md §5); this script
// cuts them out and pastes each into the poster painted in the room: inside the artwork's own shape on the plates (its torn
// corner and the tape kept), projected onto its four corners, lit like the paper around it (night, day and its sunbeam).
//   node scripts/build-posters.mjs [--debug]
// -> public/scene/posters/<id>-night.webp and <id>-day.webp (the poster's box on the plates, transparent around),
//    <id>-thumb.webp (the picker's), src/data/posters.json (the box and the ids)

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const SHEET = path.join(ROOT, "img/posters.jpg");
const OUT = path.join(ROOT, "public/scene/posters");
const DATA = path.join(ROOT, "src/data/posters.json");
const debug = process.argv.includes("--debug");
/** the sheet's order, left to right, top to bottom */
const IDS = ["moon", "rain", "lake", "cat", "nookboy", "fair", "map", "sakura"];
/** where the poster is on the plates (scene px), with some wall around */
const BOX = { x: 1070, y: 180, w: 350, h: 500 };

/* ---------------- the sheet: 8 rectangles on white ---------------- */

/**
 * The console's ad came with a brand painted under its screen (Gemini was asked for no text): covered with the console's
 * own grey, on the sheet of 2026-10-19: a band along the words, which lean with the console (sheet px, found by eye; a new
 * sheet needs them measured again).
 */
const BRAND = [[226, 1220], [376, 1243], [374, 1274], [224, 1251]];
const GREY_FROM = { left: 300, top: 1280, width: 60, height: 6 };
const grey = await sharp(SHEET).extract(GREY_FROM).stats();
const rgb = grey.channels.slice(0, 3).map((c) => Math.round(c.mean)).join(",");
const meta = await sharp(SHEET).metadata();
const cover = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}"><polygon points="${BRAND.map((q) => q.join(",")).join(" ")}" fill="rgb(${rgb})"/></svg>`,
);
const sheet = sharp(await sharp(SHEET).composite([{ input: cover }]).jpeg({ quality: 95 }).toBuffer());
const { data: sd, info: si } = await sheet.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });
const ink = (x, y) => {
  const i = (y * si.width + x) * 3;
  return Math.min(sd[i], sd[i + 1], sd[i + 2]) < 225;
};
/** the runs of a profile above a share of its length: the posters' columns, then rows */
function runs(len, other, at) {
  const out = [];
  let start = -1;
  for (let a = 0; a < len; a++) {
    let n = 0;
    for (let b = 0; b < other; b += 3) if (at(a, b)) n++;
    const on = n > other / 3 / 3;
    if (on && start < 0) start = a;
    if (!on && start >= 0) (out.push([start, a]), (start = -1));
  }
  if (start >= 0) out.push([start, len]);
  return out.filter(([a, b]) => b - a > 50);
}
const cols = runs(si.width, si.height, (x, y) => ink(x, y));
const rows = runs(si.height, si.width, (y, x) => ink(x, y));
if (cols.length !== 4 || rows.length !== 2) throw new Error(`expected 4x2 posters, found ${cols.length}x${rows.length}`);
const INSET = 6;
const arts = [];
for (const [y0, y1] of rows)
  for (const [x0, x1] of cols) {
    const crop = { left: x0 + INSET, top: y0 + INSET, width: x1 - x0 - INSET * 2, height: y1 - y0 - INSET * 2 };
    arts.push(await sheet.clone().extract(crop).removeAlpha().toBuffer());
  }


/* ---------------- the poster on the plates: its artwork's shape and corners ---------------- */

async function plate(file) {
  const { data, info } = await sharp(path.join(ROOT, "public/scene", file)).extract({ left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
const night = await plate("plate.webp");
const day = await plate("day.webp");
const lum = (p, i) => 0.3 * p.data[i * 3] + 0.59 * p.data[i * 3 + 1] + 0.11 * p.data[i * 3 + 2];

/**
 * The artwork on the night plate. Its blue night sky, reached from its middle, and what it holds (the stars, the ball) give
 * its four corners; the artwork is that quad, less the light paper that comes into it from its edge: the torn notch on the
 * right stays a notch, the tape on the corners stays over it.
 */
function artMask(p) {
  const { w, h } = p;
  const at = (i) => [p.data[i * 3], p.data[i * 3 + 1], p.data[i * 3 + 2]];
  const blue = (i) => {
    const [r, , b] = at(i);
    return b - r > 18;
  };
  const fill = (from, ok) => {
    const seen = new Uint8Array(w * h);
    const stack = [...from];
    for (const i of stack) seen[i] = 1;
    while (stack.length) {
      const i = stack.pop();
      const x = i % w, y = (i - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (!seen[j] && ok(j)) (seen[j] = 1), stack.push(j);
      }
    }
    return seen;
  };
  // the seed: the bluest pixel in the sky's upper middle (a star may sit right on a fixed spot)
  let seed = 0, best = -1;
  for (let y = Math.round(h * 0.2); y < h * 0.3; y++)
    for (let x = Math.round(w * 0.3); x < w * 0.5; x++) {
      const [r, , b] = at(y * w + x);
      if (b - r > best) (best = b - r), (seed = y * w + x);
    }
  const core = fill([seed], blue);
  const edge = [];
  for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) edge.push(y * w, y * w + w - 1);
  const outside = fill(edge.filter((i) => !core[i]), (j) => !core[j]);
  // its four sides, each fitted on the stretch where the sky reaches it (not the notch on the right, not the old
  // painting's yellow glow in the bottom right corner), then crossed for the corners
  const sky = (x, y) => !outside[y * w + x];
  const xs = [], ys = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (sky(x, y)) (xs.push(x), ys.push(y));
  const [top, bottom] = [Math.min(...ys), Math.max(...ys)];
  const [left, right] = [Math.min(...xs), Math.max(...xs)];
  /** a line through points (least squares, as x = a*y + b for the sides, y = a*x + b for top and bottom) */
  const fit = (pairs) => {
    const n = pairs.length, sx = pairs.reduce((s, [t]) => s + t, 0), sy = pairs.reduce((s, [, v]) => s + v, 0);
    const sxx = pairs.reduce((s, [t]) => s + t * t, 0), sxy = pairs.reduce((s, [t, v]) => s + t * v, 0);
    const a = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    return [a, (sy - a * sx) / n];
  };
  const span = (a, b, f) => Array.from({ length: Math.round(b - a) }, (_, k) => f(Math.round(a + k))).filter(Boolean);
  const H = bottom - top, Wd = right - left;
  const leftSide = fit(span(top + H * 0.2, top + H * 0.8, (y) => { for (let x = 0; x < w; x++) if (sky(x, y)) return [y, x]; }));
  const rightSide = fit(span(top + H * 0.1, top + H * 0.35, (y) => { for (let x = w - 1; x >= 0; x--) if (sky(x, y)) return [y, x]; }));
  const topSide = fit(span(left + Wd * 0.2, left + Wd * 0.8, (x) => { for (let y = 0; y < h; y++) if (sky(x, y)) return [x, y]; }));
  const bottomSide = fit(span(left + Wd * 0.1, left + Wd * 0.45, (x) => { for (let y = h - 1; y >= 0; y--) if (sky(x, y)) return [x, y]; }));
  /** where a side (x = a*y + b) crosses a top or bottom (y = c*x + d) */
  const cross = ([a, b], [c, d]) => {
    const y = (c * b + d) / (1 - c * a);
    return [a * y + b, y];
  };
  const quad = [cross(leftSide, topSide), cross(rightSide, topSide), cross(rightSide, bottomSide), cross(leftSide, bottomSide)];
  // inside the quad (each edge's left side, clockwise)
  const inQuad = (x, y) => quad.every(([ax, ay], k) => {
    const [bx, by] = quad[(k + 1) % 4];
    return (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= -0.5;
  });
  const quadMask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) quadMask[y * w + x] = inQuad(x, y) ? 1 : 0;
  // the paper: light and greyish (the stars are small, the moon and the ball are inside, away from the edge)
  const paper = (i) => {
    const [r, g, b] = at(i);
    return 0.3 * r + 0.59 * g + 0.11 * b > 150 && r >= b;
  };
  // the tear is on the right side, around its middle (the old painting's light glow in a corner isn't paper)
  const rim = [];
  for (let i = 0; i < w * h; i++) {
    if (!quadMask[i] || !paper(i)) continue;
    const x = i % w, y = (i - x) / w;
    if (x < w * 0.6 || y < top + H * 0.2 || y > top + H * 0.75) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !quadMask[(y + dy) * w + x + dx])) rim.push(i);
  }
  const notch = fill(rim, (j) => quadMask[j] && paper(j));
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = quadMask[i] && !notch[i] ? 1 : 0;
  return { mask, quad };
}
const { mask, quad } = artMask(night);
const area = mask.reduce((a, b) => a + b, 0);
if (area < 50_000) throw new Error(`the artwork's shape looks wrong (${area} px)`);
console.log("artwork corners (box px):", JSON.stringify(quad), area, "px");

/* ---------------- the light on it: the paper's around it, carried inside ---------------- */

/** the paper's colour in an even light, as the posters were painted */
const PAPER = [244, 236, 216];
/** the paper just around the artwork: a few px away from it, light (not the outline nor the wall's shadow) */
function ring(p) {
  const out = [];
  const near = (x, y, r) => {
    for (let dy = -r; dy <= r; dy += 2) for (let dx = -r; dx <= r; dx += 2) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < BOX.w && ny < BOX.h && mask[ny * BOX.w + nx]) return true;
    }
    return false;
  };
  for (let y = 0; y < BOX.h; y += 3)
    for (let x = 0; x < BOX.w; x += 3) {
      const i = y * BOX.w + x;
      if (mask[i] || !near(x, y, 9) || near(x, y, 3) || lum(p, i) < 120) continue;
      out.push([x, y, p.data[i * 3] / PAPER[0], p.data[i * 3 + 1] / PAPER[1], p.data[i * 3 + 2] / PAPER[2]]);
    }
  return out;
}
/** the light at every pixel of the box, from the ring's (inverse distance), on a coarse grid then smoothed */
async function lightMap(p) {
  const r = ring(p);
  const G = 6;
  const gw = Math.ceil(BOX.w / G), gh = Math.ceil(BOX.h / G);
  const grid = Buffer.alloc(gw * gh * 3);
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++) {
      const x = gx * G + G / 2, y = gy * G + G / 2;
      let s = [0, 0, 0], ws = 0;
      for (const [rx, ry, a, b, c] of r) {
        const wgt = 1 / ((rx - x) ** 2 + (ry - y) ** 2 + 25) ** 1.5;
        s = [s[0] + a * wgt, s[1] + b * wgt, s[2] + c * wgt];
        ws += wgt;
      }
      // stored as x/2 (a multiplier up to 2)
      for (let c = 0; c < 3; c++) grid[(gy * gw + gx) * 3 + c] = Math.max(0, Math.min(255, Math.round((s[c] / ws) * 127.5)));
    }
  const { data } = await sharp(grid, { raw: { width: gw, height: gh, channels: 3 } })
    .resize(BOX.w, BOX.h, { kernel: "cubic" })
    .blur(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}
const light = { night: await lightMap(night), day: await lightMap(day) };

/* ---------------- projecting an artwork onto the corners ---------------- */

/** the homography taking the unit square's corners to the quad's (then the inverse, box px -> artwork 0..1) */
function homography(q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / det, h = (dx1 * dy3 - dx3 * dy1) / det;
  const m = [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
  // its inverse
  const [a, b, c, d, e, f, gg, hh, i] = m;
  const A = e * i - f * hh, B = -(d * i - f * gg), C = d * hh - e * gg;
  const D = -(b * i - c * hh), E = a * i - c * gg, F = -(a * hh - b * gg);
  const G2 = b * f - c * e, H = -(a * f - c * d), I = a * e - b * d;
  const k = a * A + b * B + c * C;
  return [A / k, D / k, G2 / k, B / k, E / k, H / k, C / k, F / k, I / k];
}
const inv = homography(quad);

async function paste(art, lightOf) {
  const { data: a, info } = await sharp(art).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(BOX.w * BOX.h * 4);
  const at = (x, y, c) => a[(Math.min(info.height - 1, Math.max(0, y)) * info.width + Math.min(info.width - 1, Math.max(0, x))) * 3 + c];
  for (let y = 0; y < BOX.h; y++)
    for (let x = 0; x < BOX.w; x++) {
      const i = y * BOX.w + x;
      if (!mask[i]) continue;
      const W = inv[6] * x + inv[7] * y + inv[8];
      // a little past the corners: the notch and the soft edges are the mask's
      const u = Math.min(1, Math.max(0, (inv[0] * x + inv[1] * y + inv[2]) / W)) * (info.width - 1);
      const v = Math.min(1, Math.max(0, (inv[3] * x + inv[4] * y + inv[5]) / W)) * (info.height - 1);
      const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
      for (let c = 0; c < 3; c++) {
        const s = at(x0, y0, c) * (1 - fx) * (1 - fy) + at(x0 + 1, y0, c) * fx * (1 - fy) + at(x0, y0 + 1, c) * (1 - fx) * fy + at(x0 + 1, y0 + 1, c) * fx * fy;
        out[i * 4 + c] = Math.min(255, Math.round(s * (lightOf[i * 3 + c] / 127.5)));
      }
      out[i * 4 + 3] = 255;
    }
  // the edge softened by a pixel, like the paint around it
  const alpha = await sharp(Buffer.from(mask.map((m) => m * 255)), { raw: { width: BOX.w, height: BOX.h, channels: 1 } })
    .blur(0.6)
    .extractChannel(0)
    .raw()
    .toBuffer();
  for (let i = 0; i < BOX.w * BOX.h; i++) out[i * 4 + 3] = alpha[i];
  return sharp(out, { raw: { width: BOX.w, height: BOX.h, channels: 4 } });
}

await fs.mkdir(OUT, { recursive: true });
for (const [k, id] of IDS.entries()) {
  for (const mode of ["night", "day"]) {
    const img = await paste(arts[k], light[mode]);
    await img.clone().webp({ quality: 86, alphaQuality: 90 }).toFile(path.join(OUT, `${id}-${mode}.webp`));
    if (debug && k === 0) {
      const base = await sharp(path.join(ROOT, "public/scene", mode === "night" ? "plate.webp" : "day.webp")).extract({ left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h }).toBuffer();
      await sharp(base).composite([{ input: await img.png().toBuffer() }]).png().toFile(path.join(ROOT, `.cache/poster-${mode}.png`));
    }
  }
  await sharp(arts[k]).resize(150, 200, { fit: "cover" }).webp({ quality: 82 }).toFile(path.join(OUT, `${id}-thumb.webp`));
}
await fs.writeFile(DATA, JSON.stringify({ box: BOX, ids: IDS }, null, 2) + "\n");
console.log(`${IDS.length} posters -> public/scene/posters`);
