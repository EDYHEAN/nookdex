// Builds the painted room layers from the Gemini images in img/.
// Every edit (no cat, no chair, no binders…) is the master scene with one change:
// the difference between the two gives a clean cut-out of that element.
//
//   node scripts/build-scene.mjs
//
// Output: public/scene/*.webp + src/data/scene.json (positions for the code).
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const SRC = "img";
const OUT = "public/scene";
await mkdir(OUT, { recursive: true });

/* ------------------------------------------------------------------ */
/* image helpers (RGB float-free, plain Uint8 buffers)                 */
/* ------------------------------------------------------------------ */

const master = sharp(`${SRC}/scene.jpg`);
const { width: W, height: H } = await master.metadata();

async function load(name, w = W, h = H) {
  const data = await sharp(`${SRC}/${name}`).resize(w, h, { fit: "fill" }).removeAlpha().raw().toBuffer();
  return { data, w, h };
}

const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

/** 0/255 mask where the two images differ, restricted to a box. */
function diffMask(a, b, T, box) {
  const m = new Uint8Array(W * H);
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      const p = y * W + x;
      const i = p * 3;
      const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
      if (d > T) m[p] = 255;
    }
  }
  return m;
}

async function blur(m, sigma, w = W, h = H) {
  return new Uint8Array(await sharp(Buffer.from(m), { raw: { width: w, height: h, channels: 1 } }).blur(sigma).extractChannel(0).raw().toBuffer());
}

const threshold = (m, t) => m.map((v) => (v > t ? 255 : 0));

/** Removes speckles, fills small holes, grows a little. */
async function clean(m, { open = 2, close = 6, grow = 0.25 } = {}) {
  let r = threshold(await blur(m, open), 140); // opening-ish: kills isolated noise
  r = threshold(await blur(r, close), 255 * grow); // closing + dilation
  return r;
}

function inBox(m, box) {
  const r = new Uint8Array(W * H);
  for (let y = Math.max(0, box.y); y < Math.min(H, box.y + box.h); y++)
    for (let x = Math.max(0, box.x); x < Math.min(W, box.x + box.w); x++) r[y * W + x] = m[y * W + x];
  return r;
}

/** dst = dst*(1-a) + src*a */
function paste(dst, src, alpha) {
  for (let p = 0; p < W * H; p++) {
    const a = alpha[p] / 255;
    if (!a) continue;
    const i = p * 3;
    for (let c = 0; c < 3; c++) dst[i + c] = dst[i + c] * (1 - a) + src[i + c] * a;
  }
}

/** Keeps only the biggest connected blob of a 0/255 mask. */
function largestComponent(m) {
  const label = new Int32Array(W * H);
  let best = 0, bestSize = 0, next = 0;
  const stack = [];
  for (let p = 0; p < W * H; p++) {
    if (!m[p] || label[p]) continue;
    next++;
    let size = 0;
    stack.push(p);
    label[p] = next;
    while (stack.length) {
      const q = stack.pop();
      size++;
      const x = q % W;
      for (const r of [q - 1, q + 1, q - W, q + W]) {
        if (r < 0 || r >= W * H || (r === q - 1 && x === 0) || (r === q + 1 && x === W - 1)) continue;
        if (m[r] && !label[r]) {
          label[r] = next;
          stack.push(r);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = next;
    }
  }
  return m.map((v, i) => (label[i] === best ? 255 : 0));
}

function bounds(alpha, min = 8) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (alpha[y * W + x] > min) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Writes an RGBA cut-out, cropped to its alpha bounds. Returns its rect. */
async function sprite(name, rgb, alpha, quality = 86) {
  const b = bounds(alpha);
  const buf = Buffer.alloc(b.w * b.h * 4);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const p = (y + b.y) * W + (x + b.x);
      const o = (y * b.w + x) * 4;
      buf[o] = rgb[p * 3];
      buf[o + 1] = rgb[p * 3 + 1];
      buf[o + 2] = rgb[p * 3 + 2];
      buf[o + 3] = alpha[p];
    }
  await sharp(buf, { raw: { width: b.w, height: b.h, channels: 4 } }).webp({ quality, alphaQuality: 90 }).toFile(`${OUT}/${name}.webp`);
  return b;
}

const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/* ------------------------------------------------------------------ */
/* sources                                                             */
/* ------------------------------------------------------------------ */

const scene = await load("scene.jpg");
const noCat = await load("no-cat.jpg");
const noChair = await load("no-chair.jpg");
const noBinders = await load("no-binders.jpg");
const lavaEmpty = await load("lava-empty.jpg");
const catAwake = await load("cat-awake.jpg");
const plate = Buffer.from(scene.data);
const meta = { width: W, height: H };

/* ---------------- cat (asleep + awake) ---------------- */
{
  const box = { x: 1930, y: 1010, w: 410, h: 245 };
  const m = await clean(diffMask(scene, noCat, 70, box), { close: 7 });
  const region = inBox(m, box);
  const alpha = await blur(region, 1.4);
  meta.catSleep = await sprite("cat-sleep", scene.data, alpha);
  paste(plate, noCat.data, await blur(inBox(threshold(await blur(region, 6), 20), box), 3));

  const awakeBox = { x: 1950, y: 840, w: 430, h: 410 };
  const ma = await clean(diffMask(catAwake, noCat, 70, awakeBox), { close: 7 });
  meta.catAwake = await sprite("cat-awake", catAwake.data, await blur(inBox(ma, awakeBox), 1.4));
}

/* ---------------- chair (foreground) ---------------- */
{
  const box = { x: 800, y: 1170, w: 680, h: H - 1170 };
  const m = await clean(diffMask(scene, noChair, 55, box), { close: 9, grow: 0.3 });
  const region = inBox(m, box);
  meta.chair = await sprite("chair", scene.data, await blur(region, 1.6));
  paste(plate, noChair.data, await blur(inBox(threshold(await blur(region, 8), 20), box), 4));
}

/* ---------------- shelves: empty on the plate, the binders are drawn by the code ---------------- */

/**
 * Where binders stand. Each shelf row: the spines' left edges, and the lines their tops and bottoms follow
 * (measured on the painted binders and on the shelf edge: they converge to a vanishing point far on the left).
 * Each place is a quad [TL, TR, BR, BL] the code projects its binder onto, plus its bounding box.
 */
const ROWS = [
  // top shelf, up to the Pokéball: above the eye, it rises to the right
  { xs: [1766, 1859, 1949, 2040, 2131, 2224, 2319], top: (x) => 103 - 0.12 * (x - 1766), bottom: (x) => 395 - 0.0617 * (x - 1766) },
  // bottom shelf, up to the books (the lamp passes in front)
  { xs: [1788, 1878, 1963, 2048, 2138, 2226, 2316], top: (x) => 484 - 0.034 * (x - 1788), bottom: () => 776 },
];
const SLOTS = ROWS.flatMap(({ xs, top, bottom }) =>
  xs.slice(0, -1).map((x0, i) => {
    const x1 = xs[i + 1];
    const quad = [
      [x0, top(x0)],
      [x1, top(x1)],
      [x1, bottom(x1)],
      [x0, bottom(x0)],
    ].map(([x, y]) => [x, Math.round(y * 10) / 10]);
    const y = Math.floor(Math.min(quad[0][1], quad[1][1]));
    const h = Math.ceil(Math.max(quad[2][1], quad[3][1])) - y;
    return { x: x0, y, w: x1 - x0, h, quad };
  }),
);

/** Around the whole desk lamp (head, arm, foot), generous: the "no binders" edit redrew it a few px off. */
const LAMP = [
  [2112, 745], [2170, 680], [2230, 648], [2300, 648], [2335, 690], [2372, 702], [2380, 740],
  [2540, 842], [2562, 878], [2545, 915], [2505, 1060], [2490, 1120], [2525, 1150], [2520, 1205],
  [2420, 1215], [2318, 1200], [2312, 1140], [2380, 1120], [2400, 1070], [2470, 905], [2330, 812],
  [2312, 895], [2220, 895], [2150, 870], [2110, 820],
];

function inPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Fills the holes of a 0/255 mask inside a box (whatever the border of the box can't reach). */
function fillHoles(m, box) {
  const seen = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    if (x < box.x || y < box.y || x >= box.x + box.w || y >= box.y + box.h) return;
    const p = y * W + x;
    if (m[p] || seen[p]) return;
    seen[p] = 1;
    stack.push(p);
  };
  for (let x = box.x; x < box.x + box.w; x++) {
    push(x, box.y);
    push(x, box.y + box.h - 1);
  }
  for (let y = box.y; y < box.y + box.h; y++) {
    push(box.x, y);
    push(box.x + box.w - 1, y);
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % W, y = (p / W) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  const out = Buffer.from(m);
  for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) if (!seen[y * W + x]) out[y * W + x] = 255;
  return new Uint8Array(out);
}

{
  // The "no binders" edit on the shelves and on the whole lamp, so nothing is half one image, half the other.
  const area = new Uint8Array(W * H);
  for (let y = 12; y < 828; y++) for (let x = 1672; x < 2600; x++) area[y * W + x] = 255;
  for (let y = 630; y < 1230; y++) for (let x = 2090; x < 2580; x++) if (inPolygon(x, y, LAMP)) area[y * W + x] = 255;
  paste(plate, noBinders.data, await blur(area, 4));

  // The lamp head, its cord and upper arm pass in front of the bottom binders: cut them out on color.
  const box = { x: 2100, y: 640, w: 460, h: 260 };
  const m = new Uint8Array(W * H);
  const d = noBinders.data;
  for (let y = box.y; y < box.y + box.h; y++)
    for (let x = box.x; x < box.x + box.w; x++) {
      if (!inPolygon(x, y, LAMP)) continue;
      if (x > 2346 && y < 779) continue; // a book behind the arm, where a binder stands
      const i = (y * W + x) * 3;
      const orange = d[i] > d[i + 1] * 1.12 && d[i] > d[i + 2] * 1.35 && d[i] > 110;
      const ink = lum(d, i) < 95;
      if (orange || ink) m[y * W + x] = 255;
    }
  // close the small gaps (highlights, vents), fill the bulb, keep the lamp only
  let lamp = threshold(await blur(m, 1.2), 70);
  const filled = fillHoles(lamp, box);
  // ...but not the bit of wall seen through the loop of the cord (warm grey, where the bulb is yellow)
  for (let p = 0; p < W * H; p++) {
    if (!filled[p] || lamp[p]) continue;
    const i = p * 3;
    if (d[i + 1] - d[i + 2] < 22) filled[p] = 0;
  }
  lamp = largestComponent(filled);
  meta.lamp = await sprite("lamp-head", noBinders.data, await blur(lamp, 0.6));
  meta.slots = SLOTS;
}

/* ---------------- lava lamp: empty glass on the plate ---------------- */
{
  const box = { x: 870, y: 800, w: 130, h: 240 };
  const m = await clean(diffMask(scene, lavaEmpty, 45, box), { close: 8, grow: 0.2 });
  paste(plate, lavaEmpty.data, await blur(inBox(m, box), 3));
  // the liquid inside the glass (purple), shrunk a little so the lava never touches the outline
  const liquid = new Uint8Array(W * H);
  for (let y = box.y; y < box.y + box.h; y++)
    for (let x = box.x; x < box.x + box.w; x++) {
      const i = (y * W + x) * 3;
      const d = lavaEmpty.data;
      if (d[i + 2] > d[i + 1] + 25 && d[i + 2] > d[i] - 10 && lum(d, i) < 175) liquid[y * W + x] = 255;
    }
  let glass = await clean(liquid, { open: 1.5, close: 6, grow: 0.5 });
  glass = largestComponent(threshold(await blur(glass, 3), 215)); // erode ~3px, drop stray bits
  const lb = bounds(glass);
  const buf = Buffer.alloc(lb.w * lb.h * 4, 255);
  const rows = [];
  for (let y = 0; y < lb.h; y++) {
    let x0 = -1, x1 = -1;
    for (let x = 0; x < lb.w; x++) {
      const a = glass[(y + lb.y) * W + x + lb.x];
      buf[(y * lb.w + x) * 4 + 3] = a;
      if (a) {
        if (x0 < 0) x0 = x;
        x1 = x;
      }
    }
    rows.push([x0, x1]);
  }
  await sharp(buf, { raw: { width: lb.w, height: lb.h, channels: 4 } }).blur(0.6).png().toFile(`${OUT}/lava-mask.png`);
  meta.lavaBox = lb;
  meta.lavaRows = rows;
}

/* ---------------- clock: erase the painted hands, the code draws live ones ---------------- */
{
  const c = { x: 1547, y: 373 };
  const hands = [
    [1513, 345, 11],
    [1597, 320, 10],
    [1575, 437, 6],
  ];
  const near = (x, y) => {
    if (Math.hypot(x - c.x, y - c.y) < 14) return true;
    return hands.some(([hx, hy, w]) => {
      const vx = hx - c.x, vy = hy - c.y;
      const t = Math.max(0, Math.min(1, ((x - c.x) * vx + (y - c.y) * vy) / (vx * vx + vy * vy)));
      return Math.hypot(x - (c.x + vx * t), y - (c.y + vy * t)) < w;
    });
  };
  const src = Buffer.from(plate);
  for (let y = c.y - 110; y < c.y + 110; y++)
    for (let x = c.x - 110; x < c.x + 110; x++) {
      if (!near(x, y)) continue;
      // average of the nearby light face pixels that are not hands
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -26; dy <= 26; dy += 2)
        for (let dx = -26; dx <= 26; dx += 2) {
          const X = x + dx, Y = y + dy;
          if (near(X, Y)) continue;
          const i = (Y * W + X) * 3;
          if (lum(src, i) < 175) continue;
          r += src[i];
          g += src[i + 1];
          b += src[i + 2];
          n++;
        }
      if (!n) continue;
      const i = (y * W + x) * 3;
      plate[i] = r / n;
      plate[i + 1] = g / n;
      plate[i + 2] = b / n;
    }
  meta.clock = { x: c.x, y: c.y, rx: 82, ry: 104 };
}

/* ---------------- window glass mask (rain overlay) ---------------- */
{
  const box = { x: 186, y: 40, w: 634, h: 700 };
  const m = new Uint8Array(W * H);
  for (let y = box.y; y < box.y + box.h; y++)
    for (let x = box.x; x < box.x + box.w; x++) {
      const i = (y * W + x) * 3;
      const d = scene.data;
      if (d[i + 2] > d[i] + 14 && lum(d, i) < 180) m[y * W + x] = 255;
    }
  const alpha = await blur(await clean(m, { open: 1.5, close: 3, grow: 0.5 }), 1.5);
  const buf = Buffer.alloc(box.w * box.h * 4, 255);
  for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) buf[(y * box.w + x) * 4 + 3] = alpha[(y + box.y) * W + x + box.x];
  await sharp(buf, { raw: { width: box.w, height: box.h, channels: 4 } }).png({ compressionLevel: 9 }).toFile(`${OUT}/window-mask.png`);
  meta.window = box;
}

/* ---------------- fixed spots used by the code ---------------- */
Object.assign(meta, {
  screen: { x: 1076, y: 788, w: 272, h: 218, r: 26 },
  // corners of the CRT glass (TL, TR, BR, BL): the screen content is projected onto them
  screenQuad: [[1083, 792], [1340, 788], [1345, 998], [1085, 1008]],
  radio: { x: 480, y: 935, w: 385, h: 285 },
  lava: { x: 870, y: 790, w: 125, h: 300 },
  lampHit: { x: 2110, y: 660, w: 270, h: 240 },
  bulb: { x: 2212, y: 842 },
  steam: { x: 1612, y: 860, w: 110, h: 170 },
  mug: { x: 1620, y: 1020, w: 110, h: 115 },
});

await sharp(plate, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 84 }).toFile(`${OUT}/plate.webp`);
await sharp(`${SRC}/sky.jpg`).resize(1600).webp({ quality: 80 }).toFile(`${OUT}/sky.webp`);

/* ---------------- logo: paper, letters, capture ball ---------------- */
{
  const img = sharp(`${SRC}/logo.jpg`);
  const { width: LW, height: LH } = await img.metadata();
  const logo = await img.removeAlpha().raw().toBuffer();
  const ball = { x: 1571, y: 851, r: 116 };
  const out = { width: LW, height: LH, ball };

  // ball cut-out
  const bw = ball.r * 2 + 8;
  const bb = Buffer.alloc(bw * bw * 4);
  for (let y = 0; y < bw; y++)
    for (let x = 0; x < bw; x++) {
      const X = ball.x - ball.r - 4 + x, Y = ball.y - ball.r - 4 + y;
      const d = Math.hypot(X - ball.x, Y - ball.y);
      const a = Math.max(0, Math.min(1, ball.r + 1.5 - d));
      const i = (Y * LW + X) * 3, o = (y * bw + x) * 4;
      bb[o] = logo[i];
      bb[o + 1] = logo[i + 1];
      bb[o + 2] = logo[i + 2];
      bb[o + 3] = a * 255;
    }
  await sharp(bb, { raw: { width: bw, height: bw, channels: 4 } }).webp({ quality: 90 }).toFile(`${OUT}/logo-ball.webp`);

  // paper without the ball: fill the disc with paper taken lower on the sheet
  const paper = Buffer.from(logo);
  for (let y = ball.y - ball.r - 6; y < ball.y + ball.r + 6; y++)
    for (let x = ball.x - ball.r - 6; x < ball.x + ball.r + 6; x++) {
      const d = Math.hypot(x - ball.x, y - ball.y);
      const a = Math.max(0, Math.min(1, (ball.r + 5 - d) / 4));
      if (!a) continue;
      const i = (y * LW + x) * 3, j = ((y + 520) * LW + x) * 3;
      for (let c = 0; c < 3; c++) paper[i + c] = paper[i + c] * (1 - a) + logo[j + c] * a;
    }
  // letters = ink columns between the paper gaps
  const ink = (x, y) => {
    const i = (y * LW + x) * 3;
    return paper[i] > 170 && paper[i + 1] < 150 && paper[i + 2] < 130;
  };
  const cols = [];
  for (let x = 0; x < LW; x++) {
    let c = 0;
    for (let y = 420; y < 1100; y += 2) if (ink(x, y)) c++;
    cols.push(c);
  }
  const letters = [];
  let start = -1;
  for (let x = 0; x < LW; x++) {
    if (cols[x] > 0 && start < 0) start = x;
    if ((cols[x] === 0 || x === LW - 1) && start >= 0) {
      if (x - start > 20) letters.push({ x0: start, x1: x });
      start = -1;
    }
  }
  out.letters = letters;
  await sharp(paper, { raw: { width: LW, height: LH, channels: 3 } }).webp({ quality: 88 }).toFile(`${OUT}/logo-paper.webp`);
  meta.logo = out;
}

await writeFile("src/data/scene.json", JSON.stringify(meta, null, 1));
console.log("binder slots:", meta.slots.length);
console.log("logo letters:", meta.logo.letters.length, meta.logo.letters.map((l) => `${l.x0}-${l.x1}`).join(" "));
console.log("cat", meta.catSleep, "awake", meta.catAwake, "chair", meta.chair, "lamp", meta.lamp);
