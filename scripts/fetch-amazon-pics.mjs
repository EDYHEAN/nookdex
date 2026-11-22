// The pictures of the sealed products on amazon.fr (src/data/amazon-products.json, lib/amazonShop): each product's official picture, from
// its Poképédia page (its main image) or file ("Fichier:…"), shrunk into public/amazon/<slug>.webp; src/data/amazon-pics.json
// says which picture each title gave. A picture already there is kept (--force fetches them all again).
// amazon.com's products (src/data/amazon-products-us.json): TCGplayer's picture ("tp:<product id>"), the English packaging.
//   node scripts/fetch-amazon-pics.mjs [--force]
// Poképédia's API, politely: a named User-Agent, one request at a time.

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const DATA = path.join(ROOT, "src/data/amazon-products.json");
const PICS = path.join(ROOT, "src/data/amazon-pics.json");
const OUT = path.join(ROOT, "public/amazon");
const API = "https://www.pokepedia.fr/api.php";
const UA = "NookDex product pictures (nookdex.com; contact@nookdex.com)";
const force = process.argv.includes("--force");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** a file name from a title: "Fichier:Coffret Dresseur d'élite X.png" -> "coffret-dresseur-d-elite-x" */
const slug = (t) =>
  t
    .replace(/^Fichier:/, "")
    .replace(/\.(png|jpe?g|webp)$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  await wait(250);
  return r.json();
}

/** the picture's address, a 960 px thumbnail (the originals weigh up to 30 MB): a file's own, or a page's main image */
async function sourceOf(title) {
  if (title.startsWith("tp:")) return `https://product-images.tcgplayer.com/fit-in/960x960/${title.slice(3)}.jpg`;
  if (title.startsWith("Fichier:")) {
    const j = await api({ action: "query", prop: "imageinfo", iiprop: "url", iiurlwidth: "960", titles: title });
    const i = j.query.pages[0]?.imageinfo?.[0];
    return i?.thumburl ?? i?.url ?? null;
  }
  const j = await api({ action: "query", prop: "pageimages", piprop: "thumbnail", pithumbsize: "960", redirects: "1", titles: title });
  return j.query.pages[0]?.thumbnail?.source ?? null;
}

// the boxes that are white themselves: the flood bites into them, their outline (convex, they're boxes) gives them back
const WHITE_BOXES = new Set(["tp:704143", "tp:704153", "tp:704169", "tp:704190", "tp:704168", "tp:704155", "tp:593355"]);

/** everything inside the convex outline of what the flood left goes opaque again */
function fillOutline(px, w, h) {
  const pts = [];
  for (let y = 0; y < h; y++) {
    let a = -1;
    let b = -1;
    for (let x = 0; x < w; x++) {
      if (!px[(y * w + x) * 4 + 3]) continue;
      if (a < 0) a = x;
      b = x;
    }
    if (a >= 0) pts.push([a, y], [b, y]);
  }
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const side = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const half = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && side(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  const hull = [...half(pts), ...half([...pts].reverse())];
  for (let y = 0; y < h; y++) {
    let a = Infinity;
    let b = -Infinity;
    hull.forEach((p, n) => {
      const q = hull[(n + 1) % hull.length];
      if ((p[1] <= y && q[1] >= y) || (q[1] <= y && p[1] >= y)) {
        const x = p[1] === q[1] ? [p[0], q[0]] : [p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0])];
        a = Math.min(a, ...x);
        b = Math.max(b, ...x);
      }
    });
    for (let x = Math.ceil(a); x <= Math.floor(b); x++) px[(y * w + x) * 4 + 3] = 255;
  }
}

/**
 * TCGplayer's pictures are JPEGs on white: the white reaching the picture's edges goes transparent (a flood from the
 * border), for the dark shelf they stand on
 */
async function cutOut(buf, title) {
  const { data: px, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const seen = new Uint8Array(w * h);
  const white = (i) => px[i * 4] >= 246 && px[i * 4 + 1] >= 246 && px[i * 4 + 2] >= 246;
  const stack = [];
  const push = (i) => {
    if (!seen[i] && white(i)) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop();
    px[i * 4 + 3] = 0;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  if (WHITE_BOXES.has(title)) fillOutline(px, w, h);
  // the JPEG's pale fringe around the product, two pixels of it
  for (let pass = 0; pass < 2; pass++) {
    const fringe = [];
    for (let i = 0; i < w * h; i++) {
      if (!px[i * 4 + 3] || Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) < 200) continue;
      const x = i % w;
      if ((x > 0 && !px[(i - 1) * 4 + 3]) || (x < w - 1 && !px[(i + 1) * 4 + 3]) || (i >= w && !px[(i - w) * 4 + 3]) || (i < w * (h - 1) && !px[(i + w) * 4 + 3])) fringe.push(i);
    }
    for (const i of fringe) px[i * 4 + 3] = 0;
  }
  return sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

const data = JSON.parse(await fs.readFile(DATA, "utf8"));
const us = JSON.parse(await fs.readFile(DATA.replace(/\.json$/, "-us.json"), "utf8"));
const pics = JSON.parse(await fs.readFile(PICS, "utf8").catch(() => "{}"));
await fs.mkdir(OUT, { recursive: true });

/**
 * Every set's boxes, pictured (Johan, 2026-11-22: « un ETB vecteur ça marche pas, faut récupérer à chaque fois du
 * visuel »): src/data/set-boxes.json, set id -> kind -> "tp:<TCGplayer product>", the English packaging, from TCGCSV's
 * sealed products. TCGplayer lists a set's boxes with their pictures weeks before the release (Flowing Fists, 76 days
 * out), long before anyone has an ASIN for them; lib/amazonShop shows them when no product of ours has its own picture
 * (a French one wins the day Poképédia has it). The sets: those announced in the calendar, from 60 days back, and the
 * English catalog's of the last two years; a set with all its kinds is never looked up again.
 */
const BOXES = path.join(ROOT, "src/data/set-boxes.json");
const TCGCSV_UA = "NookDex (nookdex.com; contact@nookdex.com)";
const KIND_OF = [
  // "Mega Evolution Elite Trainer Box [Mega Gardevoir]": a set's two ETBs, the first one listed
  ["etb", (n) => /Elite Trainer Box( \[[^\]]*\])?$/.test(n) && !/Pokemon Center|Case|Code Card/.test(n)],
  ["display", (n) => /Booster (Box|Display)( \(\d+ packs\))?$/.test(n) && !/Half|Case|Mini|Enhanced|Code Card/.test(n)],
  ["bundle", (n) => /Booster Bundle$/.test(n) && !/Code Card/.test(n)],
  ["tripack", (n) => /3[- ]Pack Blister/.test(n) && !/Case|Code Card/.test(n)],
  ["booster", (n) => /Booster Pack$/.test(n) && !/Sleeved|Code Card/.test(n)],
];
/** "ME06: Delta Reign", "Mega Evolution: Delta Reign (ME06)" -> "delta reign" */
const plainName = (n) =>
  n
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/^.*?:\s*/, "")
    .replace(/^Mega Evolution\s*[—–-]\s*/, "")
    .toLowerCase()
    .trim();
async function seedSetBoxes() {
  const boxes = JSON.parse(await fs.readFile(BOXES, "utf8").catch(() => "{}"));
  const today = new Date().toISOString().slice(0, 10);
  const back = (days) => new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const releases = JSON.parse(await fs.readFile(path.join(ROOT, "src/data/releases.json"), "utf8")).items;
  const catalogEn = JSON.parse(await fs.readFile(path.join(ROOT, "src/data/catalog-en.json"), "utf8"));
  const wanted = new Map();
  for (const r of releases) if (r.kind === "set" && r.region === "intl" && r.setId && r.date >= back(60)) wanted.set(r.setId, r.en);
  for (const s of catalogEn) {
    const date = s.releaseDate ?? s.date;
    if (!s.extra && date && date >= back(730) && date <= today && !wanted.has(s.id)) wanted.set(s.id, s.name);
  }
  const todo = [...wanted].filter(([id]) => KIND_OF.some(([k]) => !boxes[id]?.[k]));
  if (!todo.length) return;
  const groups = await fetch("https://tcgcsv.com/tcgplayer/3/groups", { headers: { "User-Agent": TCGCSV_UA } }).then((r) => r.json()).then((j) => j.results);
  let changed = false;
  for (const [id, name] of todo) {
    const g = groups.find((x) => plainName(x.name) === plainName(name));
    if (!g) continue;
    await wait(150);
    const products = await fetch(`https://tcgcsv.com/tcgplayer/3/${g.groupId}/products`, { headers: { "User-Agent": TCGCSV_UA } })
      .then((r) => r.json())
      .then((j) => j.results)
      .catch(() => []);
    // sealed only (no card number), with a picture, its plain name without the set's ("Flowing Fists Elite Trainer Box")
    const sealed = products.filter((p) => p.imageCount > 0 && !(p.extendedData ?? []).some((e) => e.name === "Number"));
    for (const [kind, test] of KIND_OF) {
      if (boxes[id]?.[kind]) continue;
      const p = sealed.find((x) => test(x.name));
      if (!p) continue;
      (boxes[id] ??= {})[kind] = `tp:${p.productId}`;
      changed = true;
      console.log("box", id, kind, p.name);
    }
  }
  if (changed) await fs.writeFile(BOXES, JSON.stringify(Object.fromEntries(Object.entries(boxes).sort(([a], [b]) => a.localeCompare(b))), null, 2) + "\n");
}
await seedSetBoxes().catch((e) => console.warn("set boxes:", String(e)));
const setBoxes = JSON.parse(await fs.readFile(BOXES, "utf8").catch(() => "{}"));

// the gift guide's boxes (src/data/amazon-gifts.json) too
const gifts = JSON.parse(await fs.readFile(path.join(ROOT, "src/data/amazon-gifts.json"), "utf8"));
const titles = new Set(
  [...data.groups, ...us.groups]
    .flatMap((g) => [g.pic, ...g.products.map((p) => p.pic)])
    .concat(Object.values(setBoxes).flatMap((b) => Object.values(b)))
    .concat(gifts.budgets.flatMap((b) => b.products.map((p) => p.pic)))
    .filter(Boolean),
);
const missing = [];
for (const title of titles) {
  const file = `${slug(title)}.webp`;
  if (!force && pics[title] && (await fs.stat(path.join(OUT, file)).catch(() => null))) continue;
  const src = await sourceOf(title).catch((e) => (console.warn(String(e)), null));
  if (!src) {
    missing.push(title);
    delete pics[title];
    continue;
  }
  // some originals weigh 30 MB: the server drops one now and then, a second try usually gets it
  let buf = null;
  for (let attempt = 0; attempt < 3 && !buf; attempt++) {
    try {
      const r = await fetch(src, { headers: { "User-Agent": UA } });
      if (r.ok) buf = Buffer.from(await r.arrayBuffer());
    } catch (e) {
      console.warn(`retry ${title}: ${e.message}`);
      await wait(2000);
    }
  }
  if (!buf) {
    missing.push(title);
    continue;
  }
  // a product shot on its own (transparent around it), 480 px at most: sharp on a card at twice its size
  const img = sharp(title.startsWith("tp:") ? await cutOut(buf, title) : buf).trim({ threshold: 4 }).resize(480, 480, { fit: "inside", withoutEnlargement: true });
  const info = await img.webp({ quality: 82 }).toFile(path.join(OUT, file));
  pics[title] = { src: `/amazon/${file}`, w: info.width, h: info.height };
  console.log("ok", title, `${info.width}x${info.height}`);
  await wait(250);
}
await fs.writeFile(PICS, JSON.stringify(Object.fromEntries(Object.entries(pics).sort(([a], [b]) => a.localeCompare(b))), null, 2) + "\n");
if (missing.length) console.log(`no picture on Poképédia (the group's is shown): \n- ${missing.join("\n- ")}`);
