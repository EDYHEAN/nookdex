// Builds the NookBoy game's sprites: Pokémon Mystery Dungeon sprites from PMD SpriteCollab (CC BY-NC 4.0, credits kept),
// trimmed and packed into one atlas.
//   node scripts/build-game.mjs
// -> public/game/sprites.png + src/data/game-sprites.json (frames, timings, credits)
//    public/game/attract.png: the little loop shown on the painted Game Boy in the room (DMG greens, no script needed)
// Downloads are cached in .cache/game-sprites (gitignored).

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const CACHE = path.join(ROOT, ".cache", "game-sprites");
const RAW = "https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite";

const PLAYER = ["Walk", "Idle", "Shoot", "Hurt", "Faint", "Pose"];
const ENEMY = ["Walk", "Hurt"];
const BOSS = ["Walk", "Hurt", "Faint"];

// dex number -> the animations the game uses
const ROSTER = {
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 25, 26].map((n) => [n, PLAYER])),
  ...Object.fromEntries(
    [10, 13, 16, 19, 20, 21, 22, 23, 24, 27, 29, 32, 41, 42, 43, 52, 54, 56, 58, 66, 74, 75, 81, 92, 93, 100, 104, 109, 111, 113, 123, 128, 129].map(
      (n) => [n, ENEMY],
    ),
  ),
  ...Object.fromEntries([143, 95, 94, 130, 149, 150, 144, 145, 146, 151].map((n) => [n, BOSS])),
};

// PMD rows: Down, DownRight, Right, UpRight, Up, UpLeft, Left, DownLeft. The last three are mirrors: the game flips them.
const ROWS = 5;
const ATLAS_W = 2048;

const pad = (n) => String(n).padStart(4, "0");

async function cached(url, file, binary) {
  const p = path.join(CACHE, file);
  try {
    return binary ? await fs.readFile(p) : await fs.readFile(p, "utf8");
  } catch {}
  const res = await fetch(url, { headers: { "User-Agent": "NookDex game build (nookdex.com)" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, buf);
  return buf;
}

function parseAnims(xml) {
  const out = {};
  for (const m of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)) {
    const b = m[1];
    const tag = (t) => b.match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1];
    const name = tag("Name");
    out[name] = {
      copyOf: tag("CopyOf"),
      w: +tag("FrameWidth") || 0,
      h: +tag("FrameHeight") || 0,
      hit: tag("HitFrame") != null ? +tag("HitFrame") : undefined,
      durations: [...b.matchAll(/<Duration>(\d+)<\/Duration>/g)].map((d) => +d[1]),
    };
  }
  return out;
}

/** The bounding box of every opaque pixel over all frames of an anim (rows kept only), relative to a frame. */
function unionBox(raw, info, fw, fh, cols, rows) {
  let x0 = fw, y0 = fh, x1 = -1, y1 = -1;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      for (let y = 0; y < fh; y++)
        for (let x = 0; x < fw; x++) {
          const a = raw[((r * fh + y) * info.width + c * fw + x) * 4 + 3];
          if (a > 8) {
            if (x < x0) x0 = x;
            if (y < y0) y0 = y;
            if (x > x1) x1 = x;
            if (y > y1) y1 = y;
          }
        }
  if (x1 < 0) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

const strips = [];
const credits = new Map();
const mons = {};

// the sprite credits name their authors by Discord id: the repo's list turns them into names (blank when the author kept none)
const creditNames = new Map(
  (await cached("https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/credit_names.txt", "credit_names.txt"))
    .split("\n")
    .slice(1)
    .map((l) => l.split("\t"))
    .map(([name, id]) => [id?.trim(), name?.trim()]),
);

for (const [dexStr, wanted] of Object.entries(ROSTER)) {
  const dex = +dexStr;
  const dir = pad(dex);
  const xml = await cached(`${RAW}/${dir}/AnimData.xml`, `${dir}/AnimData.xml`);
  const anims = parseAnims(xml);
  const cr = await cached(`${RAW}/${dir}/credits.txt`, `${dir}/credits.txt`).catch(() => "");
  for (const line of cr.split("\n")) {
    const id = line.split("\t")[1]?.trim();
    if (!id) continue;
    const who = creditNames.get(id) || (id.startsWith("<@") ? "anonymous" : id);
    credits.set(who, (credits.get(who) ?? new Set()).add(dex));
  }
  mons[dex] = { anims: {} };
  for (const name of wanted) {
    let a = anims[name];
    if (!a) continue;
    const src = a.copyOf ?? name;
    if (a.copyOf) a = { ...anims[a.copyOf], hit: a.hit ?? anims[a.copyOf].hit };
    const png = await cached(`${RAW}/${dir}/${src}-Anim.png`, `${dir}/${src}-Anim.png`, true).catch(() => null);
    if (!png) continue;
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const cols = Math.round(info.width / a.w);
    const rows = Math.min(ROWS, Math.round(info.height / a.h));
    const box = unionBox(data, info, a.w, a.h, cols, rows);
    strips.push({ dex, name, png, a, cols, rows, box });
  }
  process.stdout.write(`${dex} `);
}
console.log();

// Shelf packing, tallest strips first.
strips.sort((p, q) => q.box.h * q.rows - p.box.h * p.rows);
let x = 0, y = 0, shelfH = 0;
for (const s of strips) {
  const w = s.box.w * s.cols + s.cols; // 1 px gap between frames
  const h = s.box.h * s.rows + s.rows;
  if (w > ATLAS_W) throw new Error(`strip too wide: ${s.dex} ${s.name}`);
  if (x + w > ATLAS_W) {
    x = 0;
    y += shelfH;
    shelfH = 0;
  }
  s.at = { x, y };
  x += w;
  shelfH = Math.max(shelfH, h);
}
const ATLAS_H = y + shelfH;

const composites = [];
for (const s of strips) {
  for (let r = 0; r < s.rows; r++)
    for (let c = 0; c < s.cols; c++) {
      const tile = await sharp(s.png)
        .extract({ left: c * s.a.w + s.box.x, top: r * s.a.h + s.box.y, width: s.box.w, height: s.box.h })
        .toBuffer();
      composites.push({ input: tile, left: s.at.x + c * (s.box.w + 1), top: s.at.y + r * (s.box.h + 1) });
    }
  mons[s.dex].anims[s.name] = {
    x: s.at.x,
    y: s.at.y,
    w: s.box.w,
    h: s.box.h,
    // the frame's centre (where the Pokémon stands) inside the trimmed box
    cx: s.a.w / 2 - s.box.x,
    cy: s.a.h / 2 - s.box.y,
    rows: s.rows,
    // in 60ths of a second, like the PMD data
    d: s.a.durations,
    ...(s.a.hit != null ? { hit: s.a.hit } : {}),
  };
}
for (const m of Object.values(mons)) {
  const walk = m.anims.Walk;
  // where the shadow goes: the bottom of the walk cycle, below the frame's centre
  if (walk) m.foot = walk.h - walk.cy;
}

const out = path.join(ROOT, "public", "game");
await fs.mkdir(out, { recursive: true });
await sharp({ create: { width: ATLAS_W, height: ATLAS_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(composites)
  .png({ palette: true, colors: 256, effort: 10, compressionLevel: 9 })
  .toFile(path.join(out, "sprites.png"));

const creditList = [...credits].map(([name, set]) => ({ name, dex: [...set].sort((a, b) => a - b) })).sort((a, b) => b.dex.length - a.dex.length);
await fs.writeFile(
  path.join(ROOT, "src", "data", "game-sprites.json"),
  JSON.stringify({ w: ATLAS_W, h: ATLAS_H, mons, credits: creditList }) + "\n",
);
const kb = (await fs.stat(path.join(out, "sprites.png"))).size / 1024;
console.log(`atlas ${ATLAS_W}x${ATLAS_H}, ${strips.length} strips, ${kb.toFixed(0)} KB, ${creditList.length} authors`);

// ---- the room's attract loop: Pikachu trotting through the grass, in the four DMG greens, 8 frames side by side ----
const DMG = [
  [15, 56, 15],
  [48, 98, 48],
  [139, 172, 15],
  [155, 188, 15],
];
const SW = 56, SH = 52, FRAMES = 8;
const pika = strips.find((s) => s.dex === 25 && s.name === "Walk");
const { data: pd, info: pi } = await sharp(pika.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const loop = Buffer.alloc(SW * FRAMES * SH * 4);
const put = (fx, px, py, [r, g, b]) => {
  if (px < 0 || py < 0 || px >= SW || py >= SH) return;
  const i = (py * SW * FRAMES + fx * SW + px) * 4;
  loop[i] = r;
  loop[i + 1] = g;
  loop[i + 2] = b;
  loop[i + 3] = 255;
};
for (let f = 0; f < FRAMES; f++) {
  for (let py = 0; py < SH; py++) for (let px = 0; px < SW; px++) put(f, px, py, DMG[3]);
  // grass tufts scrolling left, two pixels a frame
  for (let t = 0; t < 9; t++) {
    const gx = (((t * 23 + 7) % 64) - f * 2 + 64) % 64 - 4;
    const gy = 8 + ((t * 17) % 40);
    put(f, gx, gy, DMG[2]);
    put(f, gx + 2, gy, DMG[2]);
    put(f, gx + 1, gy - 1, DMG[1]);
  }
  // Pikachu, facing right (row 2), its walk frames, shadow under it
  const cols = Math.round(pi.width / pika.a.w);
  const c = f % cols;
  const ox = Math.round(SW / 2 - pika.a.w / 2), oy = Math.round(SH / 2 - pika.a.h / 2) + 4;
  for (let sx = -7; sx <= 7; sx++) put(f, SW / 2 + sx, oy + pika.a.h / 2 + 6 + (Math.abs(sx) > 5 ? 0 : 1) - 1, DMG[2]);
  for (let yy = 0; yy < pika.a.h; yy++)
    for (let xx = 0; xx < pika.a.w; xx++) {
      const i = ((2 * pika.a.h + yy) * pi.width + c * pika.a.w + xx) * 4;
      if (pd[i + 3] < 128) continue;
      const lum = 0.3 * pd[i] + 0.59 * pd[i + 1] + 0.11 * pd[i + 2];
      put(f, ox + xx, oy + yy, DMG[lum < 60 ? 0 : lum < 130 ? 1 : lum < 200 ? 2 : 3]);
    }
}
await sharp(loop, { raw: { width: SW * FRAMES, height: SH, channels: 4 } }).png({ palette: true, colors: 4 }).toFile(path.join(out, "attract.png"));
console.log("attract loop written");
