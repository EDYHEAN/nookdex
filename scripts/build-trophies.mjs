// Cuts the trophies' painted trinkets out of img/trophies.jpg (Gemini: 10 columns x 6 rows on white, in the order of
// ORDER below) into one transparent sprite, public/trophies.webp (one CELL px square per trinket, same order), and
// src/data/trophy-art.json (trophy id -> its place in the sprite).
// Run: node scripts/build-trophies.mjs
import fs from "node:fs";
import sharp from "sharp";

const SRC = "img/trophies.jpg";
const COLS = 10;
const ROWS = 6;
const CELL = 128;
/** the sheet's order, left to right, top to bottom (the trophies' order in lib/trophies when it was painted) */
const ORDER = [
  "first-card", "cards-10", "cards-50", "cards-151", "cards-500", "cards-1000", "double", "playset", "reverse", "bilingual",
  "polyglot", "vintage", "first-binder", "free-binder", "first-page", "set-25", "set-50", "set-100", "master-set", "shelf-6",
  "shelf-full", "decorator", "sorter", "art-rare", "sir", "gold-card", "card-50", "card-200", "value-100", "value-1000",
  "value-10000", "bookkeeper", "pulled", "flip", "combo", "pikachu", "charizard", "starters", "birds", "eevee",
  "magikarp", "mew", "radio", "pet", "os", "blog", "about", "cloud", "share", "days-7",
  "days-30", "night-owl", "moonlight", "rainbow", "weather", "pet-20", "xylophone", "konami", "treat", "all",
];

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const px = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
/** how far from paper white a pixel is (0 = white) */
const ink = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  const [r, g, b] = px(i);
  ink[i] = 255 - Math.min(r, g, b);
}

// The background: the near-white reached from the sheet's edges (JPEG noise allowed). White inside an object
// (a card, the cloud, a page) is walled in by its ink outline and stays.
const BG = 22;
const bg = new Uint8Array(W * H);
const stack = [];
for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
while (stack.length) {
  const i = stack.pop();
  if (bg[i] || ink[i] > BG) continue;
  bg[i] = 1;
  const x = i % W;
  if (x > 0) stack.push(i - 1);
  if (x < W - 1) stack.push(i + 1);
  if (i >= W) stack.push(i - W);
  if (i < W * (H - 1)) stack.push(i + W);
}
// Pure white pockets walled in by an object (between the scissors' rings, the xylophone's mallets…): background too
const seen = new Uint8Array(W * H);
for (let s = 0; s < W * H; s++) {
  if (bg[s] || seen[s] || ink[s] > 8) continue;
  const region = [];
  const st = [s];
  seen[s] = 1;
  let edge = 0;
  while (st.length) {
    const i = st.pop();
    region.push(i);
    const x = i % W;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
      if (j < 0 || j >= W * H || seen[j] || bg[j]) continue;
      if (ink[j] > 8) {
        edge += ink[j] > 120 ? 1 : 0;
        continue;
      }
      seen[j] = 1;
      st.push(j);
    }
  }
  // flat paper white, bigger than a highlight, mostly ringed by ink: a hole
  if (region.length > 60 && edge > region.length ** 0.5 * 2) region.forEach((i) => (bg[i] = 1));
}

// A pale glow touching the background (the night light's halo) fades out too: from the background into what's
// lighter than an outline, never past one
const SOFT = 70;
const soft = new Uint8Array(W * H);
const front = [];
for (let i = 0; i < W * H; i++) if (bg[i]) front.push(i);
while (front.length) {
  const i = front.pop();
  const x = i % W;
  for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
    if (j < 0 || j >= W * H || bg[j] || soft[j] || ink[j] >= SOFT) continue;
    soft[j] = 1;
    front.push(j);
  }
}

// Alpha: solid inside, faded on the fringe by how white it is, the white taken out of its colour
const out = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  const [r, g, b] = px(i);
  let a = 1;
  if (bg[i]) a = 0;
  else {
    const x = i % W;
    const nearBg = [i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1, i + W - 1, i + W + 1].some((j) => j >= 0 && j < W * H && Math.abs((j % W) - x) <= 1 && bg[j]);
    if (soft[i] || nearBg) a = Math.min(1, ink[i] / SOFT);
  }
  const un = (c) => (a > 0 ? Math.max(0, Math.min(255, Math.round((c - (1 - a) * 255) / a))) : 0);
  out[i * 4] = un(r);
  out[i * 4 + 1] = un(g);
  out[i * 4 + 2] = un(b);
  out[i * 4 + 3] = Math.round(a * 255);
}

// The painted shapes, one by one (8-connected). Gemini's grid isn't even: each big shape goes to the cell its centre
// falls in, the specks (sparkles, coins, splashes) to the big shape nearest to them.
const label = new Int32Array(W * H).fill(-1);
const shapes = [];
for (let s0 = 0; s0 < W * H; s0++) {
  if (label[s0] >= 0 || out[s0 * 4 + 3] < 40) continue;
  const id = shapes.length;
  const sh = { px: [], minX: W, minY: H, maxX: 0, maxY: 0, sx: 0, sy: 0 };
  const st = [s0];
  label[s0] = id;
  while (st.length) {
    const i = st.pop();
    const x = i % W, y = (i - x) / W;
    sh.px.push(i);
    sh.sx += x; sh.sy += y;
    sh.minX = Math.min(sh.minX, x); sh.maxX = Math.max(sh.maxX, x); sh.minY = Math.min(sh.minY, y); sh.maxY = Math.max(sh.maxY, y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (label[j] >= 0 || out[j * 4 + 3] < 40) continue;
        label[j] = id;
        st.push(j);
      }
    }
  }
  sh.cx = sh.sx / sh.px.length; sh.cy = sh.sy / sh.px.length;
  shapes.push(sh);
}
const cw = W / COLS;
const ch = H / ROWS;
const big = shapes.filter((sh) => sh.px.length > 600);
big.forEach((sh) => (sh.cell = Math.min(COLS - 1, Math.floor(sh.cx / cw)) + Math.min(ROWS - 1, Math.floor(sh.cy / ch)) * COLS));
for (const sh of shapes) {
  if (sh.cell != null) continue;
  // distance to a big shape's box
  const d = (b) => Math.hypot(Math.max(b.minX - sh.cx, 0, sh.cx - b.maxX), Math.max(b.minY - sh.cy, 0, sh.cy - b.maxY));
  const near = big.reduce((m, b) => (d(b) < d(m) ? b : m));
  if (d(near) < 40) sh.cell = near.cell;
}
const cells = Array.from({ length: COLS * ROWS }, () => ({ minX: W, minY: H, maxX: 0, maxY: 0, shapes: new Set() }));
shapes.forEach((sh, id) => {
  if (sh.cell == null) return;
  const c = cells[sh.cell];
  c.shapes.add(id);
  c.minX = Math.min(c.minX, sh.minX); c.maxX = Math.max(c.maxX, sh.maxX); c.minY = Math.min(c.minY, sh.minY); c.maxY = Math.max(c.maxY, sh.maxY);
});
cells.forEach((c, k) => {
  if (!c.shapes.size) throw new Error(`nothing painted for ${ORDER[k]}`);
  c.box = { left: c.minX, top: c.minY, width: c.maxX - c.minX + 1, height: c.maxY - c.minY + 1 };
});

const PAD = 4;
const room = CELL - PAD * 2;
// one scale for the whole set (the sprout stays smaller than the moving box), a small one grown a little
const uniform = room / Math.max(...cells.map(({ box }) => Math.max(box.width, box.height)));
const tiles = await Promise.all(
  cells.map(async ({ box, shapes: mine }, k) => {
    const s = Math.min(room / Math.max(box.width, box.height), uniform * 1.3);
    // only this cell's shapes: a neighbour's corner inside the box is left out
    const crop = Buffer.alloc(box.width * box.height * 4);
    for (let y = 0; y < box.height; y++) {
      for (let x = 0; x < box.width; x++) {
        const i = (box.top + y) * W + box.left + x;
        const own = mine.has(label[i]) || (label[i] < 0 && out[i * 4 + 3] > 0 && [i - 1, i + 1, i - W, i + W].some((j) => mine.has(label[j])));
        if (own) out.copy(crop, (y * box.width + x) * 4, i * 4, i * 4 + 4);
      }
    }
    const w = Math.round(box.width * s);
    const h = Math.round(box.height * s);
    return {
      input: await sharp(crop, { raw: { width: box.width, height: box.height, channels: 4 } }).resize(w, h).png().toBuffer(),
      // standing on the bottom of its square, centred
      left: (k % COLS) * CELL + Math.round((CELL - w) / 2),
      top: Math.floor(k / COLS) * CELL + CELL - PAD - h,
    };
  }),
);
await sharp({ create: { width: COLS * CELL, height: ROWS * CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(tiles)
  .webp({ quality: 88, alphaQuality: 90 })
  .toFile("public/trophies.webp");
fs.writeFileSync("src/data/trophy-art.json", JSON.stringify({ cols: COLS, rows: ROWS, cell: CELL, index: Object.fromEntries(ORDER.map((id, i) => [id, i])) }, null, 2) + "\n");
console.log("public/trophies.webp", fs.statSync("public/trophies.webp").size, "bytes");
