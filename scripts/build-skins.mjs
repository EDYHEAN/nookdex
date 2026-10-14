// Cuts a skin's painted things out of Gemini's sheets (on white, in a grid, docs/skins.md) into
// public/skins/<skin>/<name>.webp, then places them in the room: src/data/skin-art.json (lib/shop SkinArt).
// Where each thing goes is set here (PLACES, scene px of the 2752x1536 room): run it again after moving one.
// Run: node scripts/build-skins.mjs
import fs from "node:fs";
import sharp from "sharp";

/** the sheets: cells left to right, top to bottom; "light" ones (cobwebs) are pale threads keyed on their darkness */
const SHEETS = [
  {
    skin: "halloween",
    src: "img/halloween/decor-sheet.jpg",
    cols: 4,
    rows: 2,
    names: ["lantern", "pumpkin", "candles", "hat", "web-tl", "web-tr", "bat", "candy"],
    light: ["web-tl", "web-tr"],
    /** pictures with one thing each (the whole picture is its cell) */
    singles: { garland: "img/halloween/garland.jpg" },
    /** the views through the window, made like the room's (scripts/build-scene) */
    skies: { sky: "img/halloween/sky.jpg", "sky-day": "img/halloween/sky-day.jpg" },
  },
];

/**
 * Where each thing stands: its width, and either its bottom centre (cx, bottom: it stands on something) or its top left
 * corner (x, y). `rot` in degrees, `glow` for a lit one, `shadow` for one standing on something, `flames` drawn by the code. The hat is worn by Warwick: `hat` (asleep) and `hat-awake`.
 */
const PLACES = {
  halloween: {
    decor: [
      { name: "lantern", cx: 523, bottom: 746, w: 118, glow: true, shadow: true }, // on the window sill, between the cactus and the jar
      // on the desk, in front of the boombox; its four flames (bottom centre and height, as parts of the picture)
      { name: "candles", cx: 752, bottom: 1256, w: 102, glow: true, shadow: true, flames: [[0.511, 0.19, 0.183], [0.298, 0.373, 0.173], [0.702, 0.433, 0.15], [0.514, 0.617, 0.11]] },
      { name: "candy", cx: 1741, bottom: 1212, w: 86, shadow: true }, // on the desk, by the mouse pad
      { name: "garland", x: 1140, y: 6, w: 600 }, // across the wall, from the corner's cobweb to the top shelf
      { name: "bat", cx: 1036, y: 300, w: 78, rot: 16 }, // on the wall, between the curtain and the poster
      { name: "web-tl", x: 1035, y: 0, w: 230 }, // the room's corner, by the poster
      { name: "web-tr", x: 2752 - 210, y: 0, w: 210 }, // the top right corner, above the box
    ],
    hat: {
      sleep: { name: "hat", cx: 2022, bottom: 1104, w: 136, rot: -24 },
      awake: { name: "hat", cx: 2068, bottom: 934, w: 150, rot: -6 },
    },
  },
};

const BG = 22; // how far from paper white the background may be (JPEG noise)
const SOFT = 70;

async function cutCell(file, left, top, width, height, light) {
  const { data } = await sharp(file).extract({ left, top, width, height }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = width, H = height, N = W * H;
  const ink = new Float32Array(N);
  for (let i = 0; i < N; i++) ink[i] = 255 - Math.min(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
  const out = Buffer.alloc(N * 4);
  if (light) {
    // pale threads on white: their darkness is how much of them there is, painted in a cool pale white
    for (let i = 0; i < N; i++) {
      const a = Math.max(0, Math.min(1, (ink[i] - 8) / 60)) * 0.92;
      out.set([238, 233, 246, Math.round(a * 255)], i * 4);
    }
  } else {
    // the background: near-white reached from the cell's edges; white inside an object (a highlight) stays
    const bg = new Uint8Array(N);
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
      if (i < N - W) stack.push(i + W);
    }
    for (let i = 0; i < N; i++) {
      let a = 1;
      if (bg[i]) a = 0;
      else {
        const x = i % W;
        const nearBg = [i - 1, i + 1, i - W, i + W].some((j) => j >= 0 && j < N && Math.abs((j % W) - x) <= 1 && bg[j]);
        if (nearBg) a = Math.min(1, ink[i] / SOFT);
      }
      // the white taken out of the colour on the fringe
      const un = (c) => (a > 0 ? Math.max(0, Math.min(255, Math.round((c - (1 - a) * 255) / a))) : 0);
      out.set([un(data[i * 3]), un(data[i * 3 + 1]), un(data[i * 3 + 2]), Math.round(a * 255)], i * 4);
    }
  }
  // trimmed to what's painted
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (out[(y * W + x) * 4 + 3] > 10) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
  if (maxX < 0) throw new Error(`${file}: an empty cell at ${left},${top}`);
  const box = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).extract(box);
}

const art = {};
for (const sheet of SHEETS) {
  const { width, height } = await sharp(sheet.src).metadata();
  const cw = Math.floor(width / sheet.cols), ch = Math.floor(height / sheet.rows);
  const dir = `public/skins/${sheet.skin}`;
  fs.mkdirSync(dir, { recursive: true });
  const sizes = {};
  const cells = [
    ...sheet.names.map((name, k) => ({ name, file: sheet.src, left: (k % sheet.cols) * cw, top: Math.floor(k / sheet.cols) * ch, width: cw, height: ch })),
    ...(await Promise.all(Object.entries(sheet.singles ?? {}).map(async ([name, file]) => ({ name, file, left: 0, top: 0, ...(await sharp(file).metadata()) })))),
  ];
  for (const { name, file, left, top, width: w, height: h } of cells) {
    const img = await cutCell(file, left, top, w, h, sheet.light.includes(name));
    // drawn at most ~2x its size in the room: no need for Gemini's full size
    const max = name === "garland" ? 1000 : 300;
    const { data, info } = await img.resize({ width: max, height: max, fit: "inside", withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 90 }).toBuffer({ resolveWithObject: true });
    fs.writeFileSync(`${dir}/${name}.webp`, data);
    sizes[name] = { w: info.width, h: info.height };
  }
  for (const [name, file] of Object.entries(sheet.skies ?? {})) await sharp(file).resize(1600).webp({ quality: 80 }).toFile(`${dir}/${name}.webp`);
  const place = (p) => {
    const s = sizes[p.name];
    const w = p.w, h = Math.round((p.w * s.h) / s.w);
    const x = p.x ?? Math.round(p.cx - w / 2);
    const y = p.y ?? Math.round(p.bottom - h);
    const flames = p.flames?.map(([fx, fy, fh]) => ({ x: Math.round(x + fx * w), y: Math.round(y + fy * h), h: Math.round(fh * h) }));
    return { src: `/skins/${sheet.skin}/${p.name}.webp`, x, y, w, h, ...(p.rot ? { rot: p.rot } : {}), ...(p.glow ? { glow: true } : {}), ...(p.shadow ? { shadow: true } : {}), ...(flames ? { flames } : {}) };
  };
  const pl = PLACES[sheet.skin];
  art[sheet.skin] = {
    ...(fs.existsSync(`public/skins/${sheet.skin}/sky.webp`) ? { sky: `/skins/${sheet.skin}/sky.webp` } : {}),
    ...(fs.existsSync(`public/skins/${sheet.skin}/sky-day.webp`) ? { skyDay: `/skins/${sheet.skin}/sky-day.webp` } : {}),
    decor: pl.decor.map(place),
    hat: { sleep: place(pl.hat.sleep), awake: place(pl.hat.awake) },
  };
  console.log(sheet.skin, Object.entries(sizes).map(([n, s]) => `${n} ${s.w}x${s.h}`).join(", "));
}
fs.writeFileSync("src/data/skin-art.json", JSON.stringify(art, null, 2) + "\n");
