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
    /**
     * things cut out of a picture by hand (its px): left, top, width, height, and boxes painted white first where a
     * neighbour reaches in (the sleeping cat's back by the sitting one)
     */
    crops: {
      "img/halloween/cat-sheet.jpg": {
        "cat-sleep": { box: [55, 647, 1101, 729] },
        "cat-awake": { box: [1100, 255, 1026, 1114], erase: [[1100, 798, 56, 571], [1100, 255, 90, 70]] },
        spider: { box: [2147, 725, 509, 321] },
      },
    },
    /** the views through the window, made like the room's (scripts/build-scene) */
    skies: { sky: "img/halloween/sky.jpg", "sky-day": "img/halloween/sky-day.jpg" },
  },
  {
    // the Soutien pack (2026-11-16): prompts P1 bis-P4 in docs/skins.md; its decorations are SPOTS (painted in the room)
    skin: "soutien",
    // neighbours's scraps dropped (Halloween's cut-outs stay as they were sold)
    clean: true,
    src: "img/soutien/cat-sheet.jpg",
    cols: 1,
    rows: 1,
    names: [],
    light: [],
    // Gemini's edit of the Halloween cats keeps their places: the same boxes first, measured again on the sheet
    crops: {
      "img/soutien/cat-sheet.jpg": {
        // the scarf's fringe hangs lower than the hat did
        "cat-sleep": { box: [40, 640, 1100, 880] },
        "cat-awake": { box: [1100, 255, 1026, 1114], erase: [[1100, 798, 56, 571], [1100, 255, 90, 70]] },
      },
    },
    skies: { sky: "img/soutien/sky.jpg", "sky-day": "img/soutien/sky-day.jpg" },
  },
  // the winter pack (docs/skins.md lot 2): Warwick's sweater, the snowy skies; its decorations are SPOTS
  {
    skin: "hiver",
    clean: true,
    src: "img/hiver/cat-pull.jpg",
    cols: 1,
    rows: 1,
    names: [],
    light: [],
    crops: {
      "img/hiver/cat-pull.jpg": {
        "cat-sleep": { box: [40, 600, 1100, 920] },
        "cat-awake": { box: [1100, 200, 1026, 1169], erase: [[1100, 798, 56, 571]] },
      },
    },
    skies: { sky: "img/hiver/sky.jpg", "sky-day": "img/hiver/sky-day.jpg" },
  },
  // the Advent calendar's Warwicks (docs/skins.md A3): Gemini's edits of the Halloween cats, the same boxes
  ...["renne", "lutin", "bonnet"].map((id) => ({
    skin: `avent-${id}`,
    clean: true,
    src: `img/hiver/cat-${id}.jpg`,
    cols: 1,
    rows: 1,
    names: [],
    light: [],
    crops: {
      [`img/hiver/cat-${id}.jpg`]: {
        "cat-sleep": { box: [40, 600, 1100, 920] },
        "cat-awake": { box: [1100, 200, 1026, 1169], erase: [[1100, 798, 56, 571]] },
      },
    },
  })),
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
    // Warwick in his witch hat, standing where he stands (scene.json catSleep / catAwake: same bottom, same middle)
    cat: {
      sleep: { name: "cat-sleep", cx: 2148, bottom: 1243, w: 400 },
      awake: { name: "cat-awake", cx: 2163, bottom: 1250, w: 412 },
    },
    // the spider of the corner's cobweb: its thread hangs from (x, top), it drops down to `drop` now and then
    spider: { name: "spider", x: 1150, top: 30, drop: 560, w: 84 },
  },
  hiver: { decor: [], cat: { sleep: { name: "cat-sleep", cx: 2148, bottom: 1243, w: 400 }, awake: { name: "cat-awake", cx: 2163, bottom: 1250, w: 412 } } },
  ...Object.fromEntries(
    ["renne", "lutin", "bonnet"].map((id) => [
      `avent-${id}`,
      { decor: [], cat: { sleep: { name: "cat-sleep", cx: 2148, bottom: 1243, w: 400 }, awake: { name: "cat-awake", cx: 2163, bottom: 1250, w: 412 } } },
    ]),
  ),
  soutien: {
    decor: [],
    // the same cats as Halloween's, at the same scale: the sleeping one's scarf hangs lower than its body
    cat: {
      sleep: { name: "cat-sleep", cx: 2145, bottom: 1254, w: 394 },
      awake: { name: "cat-awake", cx: 2163, bottom: 1250, w: 412 },
    },
  },
};

/**
 * Things painted by Gemini into a crop of the room (Johan, 2026-11-16: the white-sheet cut-outs had neither the room's
 * perspective nor its light). img/<skin>/spots/<name>.png is the crop of public/scene/day.webp at `box` (scene px: left,
 * top, width, height), <name>-edit.png Gemini's edit of it (any size, same shape). What changed is kept, its edge
 * feathered, and lit for the night by how the night plate differs from the day one around it. `plaque`: the Mécène
 * plaque (shown to patrons only), its brass face found inside its board for the engraving.
 */
const SPOTS = {
  soutien: {
    // keep: where the new things are, in the crop's px (left, top, right, bottom): Gemini also retouches what was there
    // (the jar, the boombox's edges), nothing outside it is taken
    // `window`: over the window's panes, where the live sky shows through: the gaps between its leaves stay open there
    // (Johan, 2026-11-16: Gemini's sky between the fern's fronds hid the night's); the keep ends before the honey jar
    // `move`: Gemini slid the honey jar right and set the kalanchoe where the jar was: the thing right of `from` (crop px) is
    // moved `dx` px, back in front of the sill's free space (Johan, 2026-11-16: it ran over the jar)
    sill: { box: [240, 300, 760, 560], keep: [130, 200, 480, 475], window: true, move: { from: 379, dx: -16 } },
    desk: { box: [380, 820, 760, 540], keep: [180, 285, 398, 490] },
    monitor: { box: [900, 380, 620, 560], keep: [78, 236, 252, 512] },
    // `sharp`: a crisp outline (a wooden board's edge, not leaves): no halo kept, barely feathered
    wall: { box: [1340, 420, 520, 420], keep: [104, 90, 400, 290], plaque: true, sharp: true },
  },
};
/**
 * The Advent tree (docs/skins.md « Calendrier de l'Avent »): Gemini's bare fir in place of the monstera (`cover`: the
 * monstera's own leaves and pot, found by colour on the plate, taken whatever the difference, so none of it shows
 * through), then each decoration as Gemini added it to that bare tree (`against`): a layer each, the baubles one by one
 * (`split`), the lights and the star lit at night (`glow`), loops of garland not filled (`noFill`).
 */
const TREE_BOX = [0, 380, 800, 1156];
// only around the tree (Gemini retouches the rest a little on every edit), and a firmer difference than for the room
const layer = (name, extra = {}) => ({ box: TREE_BOX, keep: [0, 140, 570, 1156], diff: 40, edit: `tree-${name}.png`, against: "tree-0.jpg", tree: name, noFill: true, ...extra });
SPOTS.hiver = {
  // covers: the monstera it replaces, and the sill's cactus it stands in front of (Johan, 2026-11-16: the tree's green
  // over the cactus's green made no difference, the room's cactus came back over the tree)
  tree: {
    box: TREE_BOX, keep: [0, 0, 800, 1156], edit: "tree-0.jpg", tree: "base", window: true,
    cover: [{ rect: [0, 470, 500, 1156], pot: [60, 960, 400, 1156] }, { rect: [235, 140, 370, 300], pot: [245, 270, 370, 385], grow: 2, dark: true }],
  },
  "tree-baubles": layer("baubles", { split: true }),
  // the winter pack's decorations: nothing on the window's panes (Johan, 2026-11-16: too fiddly, never seen), a fir
  // garland along the curtain rod, garlands across the top of the wall, the hot chocolate (its marshmallows are small:
  // `speck`) and its candle; their lights stay lit at night (`glowIf`: the bright warm pixels)
  "window-top": { box: [0, 0, 1020, 300], keep: [0, 0, 1020, 300], window: true, glowIf: (r, g, b) => r > 235 && g > 200 && b < 170 },
  "wall-garlands": { box: [1000, 0, 900, 300], keep: [0, 0, 900, 300], edit: "wall-garlands-edit.png" },
  mug: { box: [1480, 880, 400, 320], keep: [60, 60, 260, 300], speck: 20, glowIf: (r, g, b) => r > 235 && g > 170 && b < 150 },
  // the Advent calendar's sleigh (its 17th box), hanging high on the wall
  sleigh: { box: [1000, 0, 900, 300], keep: [0, 0, 900, 300], edit: "sleigh-edit.png", into: "sleigh" },
  // the holly round the clock: not its face (the code draws the hands on the room's own)
  clock: { box: [1400, 230, 300, 300], keep: [0, 0, 300, 300], into: "clock", hole: { cx: 147, cy: 143, rx: 80, ry: 102 } },
};
/** how far (0-255, the largest channel) an edited pixel must be from the room's to count as painted in */
const SPOT_DIFF = 26;

const BG = 22; // how far from paper white the background may be (JPEG noise)
const SOFT = 70;

async function cutCell(file, left, top, width, height, light, erase = [], clean = false) {
  const { data } = await sharp(file).extract({ left, top, width, height }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = width, H = height, N = W * H;
  for (const [ex, ey, ew, eh] of erase)
    for (let y = Math.max(0, ey - top); y < Math.min(H, ey - top + eh); y++)
      for (let x = Math.max(0, ex - left); x < Math.min(W, ex - left + ew); x++) data.fill(255, (y * W + x) * 3, (y * W + x) * 3 + 3);
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
  // bits of a neighbour reaching into the cell (a fern's frond in the macramé's): the painted patches that touch the cell's
  // edge are dropped, the biggest one kept whatever it touches
  if (clean && !light) {
    const label = new Int32Array(N).fill(-1);
    const parts = [];
    for (let i = 0; i < N; i++) {
      if (label[i] >= 0 || out[i * 4 + 3] <= 10) continue;
      const id = parts.length;
      const part = { size: 0, edge: false, px: [] };
      const stack = [i];
      label[i] = id;
      while (stack.length) {
        const j = stack.pop();
        part.size++;
        part.px.push(j);
        const x = j % W, y = (j - x) / W;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) part.edge = true;
        for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, j - W, j + W])
          if (k >= 0 && k < N && label[k] < 0 && out[k * 4 + 3] > 10) {
            label[k] = id;
            stack.push(k);
          }
      }
      parts.push(part);
    }
    const biggest = parts.reduce((a, b) => (b.size > a.size ? b : a), parts[0]);
    for (const part of parts) if (part.edge && part !== biggest) for (const j of part.px) out[j * 4 + 3] = 0;
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

// the sheets not painted yet keep what they had
const art = fs.existsSync("src/data/skin-art.json") ? JSON.parse(fs.readFileSync("src/data/skin-art.json", "utf8")) : {};
for (const sheet of SHEETS) {
  if (!fs.existsSync(sheet.src)) {
    console.log(sheet.skin, "skipped: no", sheet.src);
    continue;
  }
  const { width, height } = await sharp(sheet.src).metadata();
  const cw = Math.floor(width / sheet.cols), ch = Math.floor(height / sheet.rows);
  const dir = `public/skins/${sheet.skin}`;
  fs.mkdirSync(dir, { recursive: true });
  const sizes = {};
  const cells = [
    ...sheet.names.map((name, k) => ({ name, file: sheet.src, left: (k % sheet.cols) * cw, top: Math.floor(k / sheet.cols) * ch, width: cw, height: ch })),
    ...(await Promise.all(Object.entries(sheet.singles ?? {}).map(async ([name, file]) => ({ name, file, left: 0, top: 0, ...(await sharp(file).metadata()) })))),
    ...Object.entries(sheet.crops ?? {}).filter(([file]) => fs.existsSync(file)).flatMap(([file, things]) =>
      Object.entries(things).map(([name, { box: [left, top, width, height], erase }]) => ({ name, file, left, top, width, height, erase })),
    ),
  ];
  for (const { name, file, left, top, width: w, height: h, erase } of cells) {
    const img = await cutCell(file, left, top, w, h, sheet.light.includes(name), erase, sheet.clean);
    // drawn at most ~2x its size in the room: no need for Gemini's full size
    const max = name === "garland" || name.startsWith("cat") ? 900 : 300;
    const { data, info } = await img.resize({ width: max, height: max, fit: "inside", withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 90 }).toBuffer({ resolveWithObject: true });
    fs.writeFileSync(`${dir}/${name}.webp`, data);
    sizes[name] = { w: info.width, h: info.height };
  }
  for (const [name, file] of Object.entries(sheet.skies ?? {})) if (fs.existsSync(file)) await sharp(file).resize(1600).webp({ quality: 80 }).toFile(`${dir}/${name}.webp`);
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
    ...(pl.cat && sizes[pl.cat.sleep.name] ? { cat: { sleep: place(pl.cat.sleep), awake: place(pl.cat.awake) } } : {}),
    ...(pl.spider ? { spider: (({ src, w, h }) => ({ src, w, h, x: pl.spider.x, top: pl.spider.top, drop: pl.spider.drop }))(place({ ...pl.spider, cx: 0, bottom: 0 })) } : {}),
    ...(pl.plaque
      ? {
          plaque: (() => {
            const b = place(pl.plaque);
            const [tx, ty, tw, th] = pl.plaque.text;
            return { ...b, text: { x: Math.round(b.x + tx * b.w), y: Math.round(b.y + ty * b.h), w: Math.round(tw * b.w), h: Math.round(th * b.h) } };
          })(),
        }
      : {}),
  };
  console.log(sheet.skin, Object.entries(sizes).map(([n, s]) => `${n} ${s.w}x${s.h}`).join(", "));
}
/** A mask or a channel grown (max) or shrunk (min) by r px, a square at a time: rows then columns (the edge left out) */
function morph(m, W, H, r, grow) {
  const pass = (src, horizontal) => {
    const out = new Uint8Array(src.length);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let v = grow ? 0 : 255;
        for (let k = -r; k <= r; k++) {
          const xx = horizontal ? x + k : x, yy = horizontal ? y : y + k;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const s = src[yy * W + xx];
          v = grow ? Math.max(v, s) : Math.min(v, s);
        }
        out[y * W + x] = v;
      }
    return out;
  };
  return pass(pass(m, true), false);
}
/** The mask's patches (4-connected), each with its pixels */
function patches(m, W, H, value = 1) {
  const label = new Int32Array(m.length).fill(-1);
  const all = [];
  for (let i = 0; i < m.length; i++) {
    if (label[i] >= 0 || m[i] !== value) continue;
    const px = [];
    const stack = [i];
    label[i] = all.length;
    while (stack.length) {
      const j = stack.pop();
      px.push(j);
      const x = j % W;
      for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, j - W, j + W])
        if (k >= 0 && k < m.length && label[k] < 0 && m[k] === value) {
          label[k] = all.length;
          stack.push(k);
        }
    }
    all.push(px);
  }
  return all;
}
/** The holes of a mask filled: the empty patches that don't reach its edge */
function fillHoles(m, W, H, open = () => false) {
  const out = Uint8Array.from(m);
  for (const px of patches(m, W, H, 0))
    if (!px.some((j) => j % W === 0 || j % W === W - 1 || j < W || j >= W * (H - 1)) && !open(px)) for (const j of px) out[j] = 1;
  return out;
}

for (const [skin, spots] of Object.entries(SPOTS)) {
  art[skin] ??= {};
  const dir = `public/skins/${skin}`;
  fs.mkdirSync(dir, { recursive: true });
  const decor = [];
  for (const [name, spot] of Object.entries(spots)) {
    const edited = `img/${skin}/spots/${spot.edit ?? `${name}-edit.png`}`;
    if (!fs.existsSync(edited)) {
      console.log(skin, name, "skipped: no", edited);
      continue;
    }
    const [L, T, W, H] = spot.box;
    const N = W * H;
    const crop = (f, blur) => {
      const img = sharp(f).extract({ left: L, top: T, width: W, height: H }).removeAlpha();
      return (blur ? img.blur(blur) : img).raw().toBuffer();
    };
    const fromEdit = (blur) => {
      const img = sharp(edited).resize(W, H, { fit: "fill", kernel: "lanczos3" }).removeAlpha();
      return (blur ? img.blur(blur) : img).raw().toBuffer();
    };
    const [edit, dayB, editB, dayWide, nightWide] = await Promise.all([
      fromEdit(0),
      // compared a little blurred: Gemini's own grain isn't a change
      // a decoration is what Gemini added to its own bare tree, not to the room
      // `diffBlur`: less for fine lines (the frost's), the usual blur would wash them out
      spot.against ? sharp(`img/${skin}/spots/${spot.against}`).resize(W, H, { fit: "fill", kernel: "lanczos3" }).removeAlpha().blur(spot.diffBlur ?? 1.5).raw().toBuffer() : crop("public/scene/day.webp", spot.diffBlur ?? 1.5),
      fromEdit(spot.diffBlur ?? 1.5),
      // the light around, day and night
      crop("public/scene/day.webp", 24),
      crop("public/scene/plate.webp", 24),
    ]);
    const pane = new Uint8Array(N);
    if (spot.window) {
      const win = JSON.parse(fs.readFileSync("src/data/scene.json", "utf8")).window;
      const { data: wm } = await sharp("public/scene/window-mask.png").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < N; i++) {
        const wx = L + (i % W) - win.x, wy = T + Math.floor(i / W) - win.y;
        if (wx >= 0 && wy >= 0 && wx < win.w && wy < win.h) pane[i] = wm[(wy * win.w + wx) * 4 + 3] > 128 ? 1 : 0;
      }
    }
    const [kx0, ky0, kx1, ky1] = spot.keep;
    let mask = new Uint8Array(N);
    // a shape traced by hand: inside it, all of it
    const inPoly = (x, y, poly) => {
      let inside = false;
      for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
        const [xa, ya] = poly[a], [xb, yb] = poly[b];
        if (ya > y !== yb > y && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) inside = !inside;
      }
      return inside;
    };
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i - x) / W;
      if (x < kx0 || x > kx1 || y < ky0 || y > ky1) continue;
      if (spot.hole && ((x - spot.hole.cx) / spot.hole.rx) ** 2 + ((y - spot.hole.cy) / spot.hole.ry) ** 2 < 1) continue;
      if (spot.polygon) {
        mask[i] = inPoly(x, y, spot.polygon) ? 1 : 0;
        continue;
      }
      let d = 0;
      for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(dayB[i * 3 + c] - editB[i * 3 + c]));
      // `only`: the thing's own colour too (the star's gold), when the difference alone takes the background with it
      mask[i] = d > (spot.diff ?? SPOT_DIFF) && (!spot.only || spot.only(editB[i * 3], editB[i * 3 + 1], editB[i * 3 + 2])) ? 1 : 0;
    }
    // specks (Gemini's grain, a dust mote moved) dropped, then the patches closed: grown, holes filled, shrunk back
    if (!spot.polygon) for (const px of patches(mask, W, H)) if (px.length < (spot.speck ?? (spot.against ? 25 : N * 0.003))) for (const j of px) mask[j] = 0;
    if (spot.cover) {
      // the plant it replaces, all of it: its leaves (green) and its pot (terracotta), on the room's own plate, grown a little
      const plate = await crop("public/scene/day.webp", 0);
      for (const cover of [spot.cover].flat()) {
        const [cx0, cy0, cx1, cy1] = cover.rect, [px0, py0, px1, py1] = cover.pot;
        let plant = new Uint8Array(N);
        for (let i = 0; i < N; i++) {
          const x = i % W, y = (i - x) / W, [rr, gg, bb] = [plate[i * 3], plate[i * 3 + 1], plate[i * 3 + 2]];
          // `dark`: an olive cactus in the warm light isn't green: anything darker than the bright panes behind it
          const leaf = x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1 && (cover.dark ? 0.3 * rr + 0.59 * gg + 0.11 * bb < 175 : gg > rr + 6 && gg > bb);
          const pot = x >= px0 && x <= px1 && y >= py0 && y <= py1 && rr > 110 && rr > gg + 20 && gg > bb;
          plant[i] = leaf || pot ? 1 : 0;
        }
        // grown so none of its edge is left (the cactus by less: the window's panes are round it)
        const g = cover.grow ?? 8;
        plant = morph(fillHoles(morph(plant, W, H, g, true), W, H), W, H, Math.min(2, g - 1), false);
        for (let i = 0; i < N; i++) if (plant[i]) mask[i] = 1;
      }
    }
    // a hole mostly over a pane, bigger than a speck, is sky between leaves: left open
    const open = spot.window ? (px) => px.length > 120 && px.filter((j) => pane[j]).length > px.length / 2 : undefined;
    mask = spot.polygon ? mask : spot.noFill ? morph(morph(mask, W, H, 1, true), W, H, 1, false) : morph(fillHoles(morph(mask, W, H, 3, true), W, H, open), W, H, spot.sharp ? 3 : 2, false);
    // over the panes, a pixel more taken off the edge: the fringe there is Gemini's day sky, a light halo against the night's
    if (spot.window) {
      const tight = morph(mask, W, H, 1, false);
      for (let i = 0; i < N; i++) if (pane[i]) mask[i] = tight[i];
    }
    const alpha = await sharp(Buffer.from(mask.map((v) => v * 255)), { raw: { width: W, height: H, channels: 1 } }).blur(spot.sharp || spot.polygon ? 0.6 : 2).extractChannel(0).raw().toBuffer();
    if (spot.outline) {
      // inside the rect, the painting's own outlines decide: a fill from what Gemini left as the room was (the sky in the
      // panes, the cactus the tree doesn't hide) and from the rect's top and sides, through all but the dark lines; what
      // it can't reach is the tree, its outline with it where it borders it
      const [ox0, oy0, ox1, oy1] = spot.outline.rect;
      const lum = (i) => 0.3 * edit[i * 3] + 0.59 * edit[i * 3 + 1] + 0.11 * edit[i * 3 + 2];
      const inRect = (x, y) => x >= ox0 && x <= ox1 && y >= oy0 && y <= oy1;
      const dark = new Uint8Array(N), reached = new Uint8Array(N), stack = [];
      for (let i = 0; i < N; i++) {
        const x = i % W, y = (i - x) / W;
        if (!inRect(x, y)) continue;
        // a wall for the fill: the black outlines, and the fir's own green (its painted outline isn't closed everywhere)
        const [rr, gg, bb] = [edit[i * 3], edit[i * 3 + 1], edit[i * 3 + 2]];
        dark[i] = lum(i) < 95 || (gg > rr + 4 && gg >= bb) ? 1 : 0;
        let d = 0;
        for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(dayB[i * 3 + c] - editB[i * 3 + c]));
        // the rect's top only: its sides cross the tree's lower branches
        const edge = y === oy0;
        if (!dark[i] && (d < 10 || edge)) (reached[i] = 1), stack.push(i);
      }
      while (stack.length) {
        const j = stack.pop();
        const x = j % W;
        for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, j - W, j + W]) {
          if (k < 0 || k >= N || reached[k] || dark[k] || !inRect(k % W, Math.floor(k / W))) continue;
          reached[k] = 1;
          stack.push(k);
        }
      }
      // what the fill can't reach is the tree, its outline and green included; lone bits (a line of the frame) dropped
      const inside = new Uint8Array(N);
      for (let i = 0; i < N; i++) if (inRect(i % W, Math.floor(i / W)) && !reached[i]) inside[i] = 1;
      for (const px of patches(inside, W, H)) if (px.length < 400) for (const j of px) inside[j] = 0;
      const crisp = await sharp(Buffer.from(inside.map((v) => v * 255)), { raw: { width: W, height: H, channels: 1 } }).blur(0.5).extractChannel(0).raw().toBuffer();
      for (let i = 0; i < N; i++) if (inRect(i % W, Math.floor(i / W))) alpha[i] = crisp[i];
    }
    // day: Gemini's pixels; night: the same, darkened and tinted as the night plate is from the day one there
    const day = Buffer.alloc(N * 4), night = Buffer.alloc(N * 4);
    for (let i = 0; i < N; i++)
      for (let c = 0; c < 3; c++) {
        const ratio = Math.min(1.6, Math.max(0.08, (nightWide[i * 3 + c] + 1) / (dayWide[i * 3 + c] + 1)));
        day[i * 4 + c] = edit[i * 3 + c];
        // a light (the tree's fairy lights, its star) shines the same by night
        night[i * 4 + c] = spot.glow || spot.glowIf?.(edit[i * 3], edit[i * 3 + 1], edit[i * 3 + 2]) ? edit[i * 3 + c] : Math.min(255, Math.round(edit[i * 3 + c] * ratio));
        day[i * 4 + 3] = night[i * 4 + 3] = alpha[i];
        // `tint`: its shape only, in one colour (the frost's icy white: on the day's window it had taken its warmth)
        if (spot.tint) (day[i * 4 + c] = spot.tint[c]), (night[i * 4 + c] = spot.tint[c]);
      }
    if (spot.move) {
      // the biggest patch right of the cut (its shadow on the sill with it), its pixels moved: where it was, the room again
      const cut = new Uint8Array(N);
      for (let i = 0; i < N; i++) cut[i] = alpha[i] > 8 && Math.abs((i % W) - spot.move.from) > 2 ? 1 : 0;
      const right = patches(cut, W, H)
        .filter((px) => px.reduce((n, j) => n + (j % W), 0) / px.length > spot.move.from)
        .sort((a, b) => b.length - a.length)[0] ?? [];
      const moved = right.map((j) => [j + spot.move.dx, [...day.subarray(j * 4, j * 4 + 4)], [...night.subarray(j * 4, j * 4 + 4)]]);
      for (const j of right) {
        alpha[j] = 0;
        day[j * 4 + 3] = night[j * 4 + 3] = 0;
      }
      for (const [k, d, n] of moved) {
        if (k % W > W - 1 || k < 0) continue;
        // over what's there (a fern frond's tip), as it stands in front of it
        alpha[k] = Math.max(alpha[k], d[3]);
        day.set(d, k * 4);
        night.set(n, k * 4);
      }
    }
    if (spot.split) {
      // one picture per bauble: the tree gets one a day, in an order spread over the whole tree
      const blobs = patches(Uint8Array.from(alpha, (a) => (a > 8 ? 1 : 0)), W, H).filter((px) => px.length > 40);
      const parts = [];
      for (const [k, px] of blobs.entries()) {
        const xs = px.map((j) => j % W), ys = px.map((j) => Math.floor(j / W));
        const bx = Math.min(...xs), by = Math.min(...ys), bw = Math.max(...xs) - bx + 1, bh = Math.max(...ys) - by + 1;
        const one = Buffer.alloc(N * 4), oneN = Buffer.alloc(N * 4);
        for (const j of px) (day.copy(one, j * 4, j * 4, j * 4 + 4), night.copy(oneN, j * 4, j * 4, j * 4 + 4));
        const b = { left: bx, top: by, width: bw, height: bh };
        await sharp(one, { raw: { width: W, height: H, channels: 4 } }).extract(b).webp({ quality: 90, alphaQuality: 90 }).toFile(`${dir}/${name}-${k}.webp`);
        await sharp(oneN, { raw: { width: W, height: H, channels: 4 } }).extract(b).webp({ quality: 90, alphaQuality: 90 }).toFile(`${dir}/${name}-${k}-night.webp`);
        parts.push({ src: `/skins/${skin}/${name}-${k}.webp`, srcNight: `/skins/${skin}/${name}-${k}-night.webp`, x: L + bx, y: T + by, w: bw, h: bh, still: true });
      }
      // top to bottom, then dealt like cards (every 5th): day after day the baubles land all over the tree
      parts.sort((a, b) => a.y - b.y);
      const dealt = [0, 1, 2, 3, 4].flatMap((k) => parts.filter((_, i) => i % 5 === k));
      art[skin].tree ??= { layers: {} };
      art[skin].tree.baubles = dealt;
      console.log(skin, "spot", name, `${dealt.length} baubles`);
      continue;
    }
    // trimmed to what's painted in
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let i = 0; i < N; i++)
      if (alpha[i] > 8) {
        const x = i % W, y = (i - x) / W;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    if (x1 < 0) throw new Error(`${edited}: nothing painted in`);
    const box = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
    const out = async (buf, file) => sharp(buf, { raw: { width: W, height: H, channels: 4 } }).extract(box).webp({ quality: 88, alphaQuality: 90 }).toFile(`${dir}/${file}`);
    await out(day, `spot-${name}.webp`);
    await out(night, `spot-${name}-night.webp`);
    const placed = { src: `/skins/${skin}/spot-${name}.webp`, srcNight: `/skins/${skin}/spot-${name}-night.webp`, x: L + x0, y: T + y0, w: box.width, h: box.height, still: true };
    if (spot.plaque) {
      // its brass face, measured across the board's middle lines (Johan, 2026-11-16: a patch of light pixels took in the
      // frame's lit rim and the name sat left): along a line, the brass is the light run between the dark frame's two sides
      const lum = (x, y) => 0.3 * edit[(y * W + x) * 3] + 0.59 * edit[(y * W + x) * 3 + 1] + 0.11 * edit[(y * W + x) * 3 + 2];
      // the light runs along the line; the brass is the longest one that touches neither end (the wall around the board)
      const brass = (at, from, to) => {
        const runs = [];
        for (let i = from, start = -1; i <= to + 1; i++) {
          const lit = i <= to && at(i) >= 125;
          if (lit && start < 0) start = i;
          if (!lit && start >= 0) (runs.push([start, i - 1]), (start = -1));
        }
        const inner = runs.filter(([a, b]) => a > from && b < to);
        return inner.sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0] ?? [from, to];
      };
      const median = (v) => v.sort((a, b) => a - b)[v.length >> 1];
      const mid = (a, b) => Math.round((a + b) / 2);
      const [cx, cy] = [mid(x0, x1), mid(y0, y1)];
      const rows = [-12, -6, 0, 6, 12].map((d) => brass((x) => lum(x, cy + d), x0, x1));
      const cols = [-30, -15, 0, 15, 30].map((d) => brass((y) => lum(cx + d, y), y0, y1));
      const fx = median(rows.map((r) => r[0])), fw = median(rows.map((r) => r[1])) - fx + 1;
      const fy = median(cols.map((c) => c[0])), fh = median(cols.map((c) => c[1])) - fy + 1;
      const text = { x: L + fx + Math.round(fw * 0.08), y: T + fy + Math.round(fh * 0.1), w: Math.round(fw * 0.84), h: Math.round(fh * 0.8) };
      art[skin].plaque = { ...placed, text };
    } else if (spot.into) {
      art[skin][spot.into] = placed;
    } else if (spot.tree) {
      art[skin].tree ??= { layers: {} };
      if (spot.tree === "base") art[skin].tree.base = placed;
      else art[skin].tree.layers[spot.tree] = { ...placed, ...(spot.glow ? { glow: true } : {}) };
    } else decor.push(placed);
    console.log(skin, "spot", name, `${box.width}x${box.height} at ${placed.x},${placed.y}`);
  }
  if (decor.length || art[skin].decor) art[skin].decor = decor;
}

// the greeting card's background (the Advent calendar's 23rd box, app/share/voeux): the room by night with the whole
// tree, star lit, cut in portrait round it
if (art.hiver?.tree) {
  const t = art.hiver.tree;
  const parts = [t.base, ...["gifts", "snow", "candy", "garland", "socks", "lights"].map((k) => t.layers[k]), ...t.baubles, t.layers.star].filter(Boolean);
  const room = await sharp("public/scene/plate.webp").composite(parts.map((q) => ({ input: `public${q.srcNight ?? q.src}`, left: q.x, top: q.y }))).png().toBuffer();
  await sharp(room).extract({ left: 0, top: 186, width: 1080, height: 1350 }).jpeg({ quality: 84 }).toFile("src/assets/voeux-desk.jpg");
  console.log("hiver: voeux-desk.jpg");
}
fs.writeFileSync("src/data/skin-art.json", JSON.stringify(art, null, 2) + "\n");
