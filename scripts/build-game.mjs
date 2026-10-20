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
const PLAYER_LITE = ["Walk", "Idle", "Shoot", "Hurt"];

// dex number -> the animations the game uses
const ROSTER = {
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 25, 26].map((n) => [n, PLAYER])),
  ...Object.fromEntries(
    [10, 13, 15, 16, 19, 20, 21, 22, 23, 24, 27, 29, 32, 41, 42, 43, 52, 54, 56, 58, 59, 65, 66, 68, 74, 75, 76, 81, 89, 92, 93, 100, 104, 109, 111, 112, 113, 123, 128, 129, 142].map(
      (n) => [n, ENEMY],
    ),
  ),
  ...Object.fromEntries([143, 95, 94, 130, 149, 150, 144, 145, 146, 151].map((n) => [n, BOSS])),
  // Mewtwo, a boss and a player's skin (a reward): the player's moves too
  150: PLAYER,
  // Mega Mewtwo Y, its evolution in the game (a form: 10000 + its dex number, see FORMS)
  10150: PLAYER,
  // Gengar, a boss and a reward too, and Mega Gengar
  94: PLAYER,
  10094: PLAYER,
  // Kecleon, the merchant
  352: ["Walk", "Idle"],
  // the daily challenge (lib/game/defi): its foes, by theme...
  ...Object.fromEntries(
    [17, 18, 28, 37, 38, 39, 40, 53, 60, 61, 62, 72, 73, 77, 79, 80, 82, 83, 84, 86, 87, 88, 90, 91, 96, 98, 101, 102, 103, 108, 110, 116, 117, 118, 119, 120, 121,
      122, 124, 125, 126, 132, 137, 138, 139, 141, 147].map((n) => [n, ENEMY]),
  ),
  // ...its wave-5 bosses (Tauros, Muk, Rhydon are there already)...
  ...Object.fromEntries([78, 85, 97, 99, 148].map((n) => [n, BOSS])),
  // ...its Pokémon of the day and their evolutions (Faint and Pose fall back on Hurt and Idle)...
  ...Object.fromEntries([133, 134, 135, 136, 58, 59, 131, 129, 66, 67, 68, 63, 64, 65].map((n) => [n, PLAYER_LITE])),
  // (Gyarados and Snorlax are bosses too: their faint stays)
  130: [...PLAYER_LITE, "Faint"],
  143: [...PLAYER_LITE, "Faint"],
  // ...and its giga bosses, wave 10: Mega forms drawn twice as big (see FORMS)
  ...Object.fromEntries([10006, 10065, 10080, 10115, 10142].map((n) => [n, BOSS])),
  // the starters to unlock and their evolutions (lib/game/data UNLOCK_STARTERS); Dragonair and Dragonite are bosses too
  ...Object.fromEntries([32, 33, 34, 74, 75, 76, 173, 35, 36, 147].map((n) => [n, PLAYER_LITE])),
  ...Object.fromEntries([148, 149].map((n) => [n, [...PLAYER_LITE, "Faint"]])),
};
/**
 * Shiny starters (Johan, 2026-10-20: now and then a run starts shiny): SpriteCollab's shiny of every starter and its
 * evolutions, as 20000 + its id (Mega Mewtwo Y is 30150); the game draws it instead when the run is shiny.
 */
const SHINY = 20000;
for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 25, 26, 150, 10150, 94, 10094, 32, 33, 34, 74, 75, 76, 173, 35, 36, 147, 148, 149])
  ROSTER[SHINY + n] = PLAYER;

// PMD rows: Down, DownRight, Right, UpRight, Up, UpLeft, Left, DownLeft. The last three are mirrors: the game flips them.
const ROWS = 5;
const ATLAS_W = 2048;

const pad = (n) => String(n).padStart(4, "0");
/** forms: their folder on SpriteCollab */
const FORMS = { 10150: "0150/0002", 10094: "0094/0001", 10006: "0006/0001", 10065: "0065/0001", 10080: "0080/0002", 10115: "0115/0001", 10142: "0142/0001" };
/** a Pokémon's folder: its form's, its shiny's (under its form, "0001") */
const folderOf = (dex) => (dex >= SHINY ? `${FORMS[dex - SHINY] ?? `${pad(dex - SHINY)}/0000`}/0001` : (FORMS[dex] ?? pad(dex)));

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
  const dir = folderOf(dex);
  const xml = await cached(`${RAW}/${dir}/AnimData.xml`, `${dir}/AnimData.xml`);
  const anims = parseAnims(xml);
  const cr = await cached(`${RAW}/${dir}/credits.txt`, `${dir}/credits.txt`).catch(() => "");
  for (const line of cr.split("\n")) {
    const id = line.split("\t")[1]?.trim();
    if (!id) continue;
    const who = creditNames.get(id) || (id.startsWith("<@") ? "anonymous" : id);
    credits.set(who, (credits.get(who) ?? new Set()).add(dex >= SHINY ? dex - SHINY : dex));
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
    strips.push({ dex, name, png, a, cols, rows, box, data, info });
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

// the frames copied straight into one raw buffer (a sharp composite of thousands of tiles stalled once the shinies came in)
const atlas = Buffer.alloc(ATLAS_W * ATLAS_H * 4);
for (const s of strips) {
  for (let r = 0; r < s.rows; r++)
    for (let c = 0; c < s.cols; c++) {
      const sx = c * s.a.w + s.box.x, sy = r * s.a.h + s.box.y;
      const dx = s.at.x + c * (s.box.w + 1), dy = s.at.y + r * (s.box.h + 1);
      for (let yy = 0; yy < s.box.h; yy++) {
        const from = ((sy + yy) * s.info.width + sx) * 4;
        s.data.copy(atlas, ((dy + yy) * ATLAS_W + dx) * 4, from, from + s.box.w * 4);
      }
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
await sharp(atlas, { raw: { width: ATLAS_W, height: ATLAS_H, channels: 4 } })
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
