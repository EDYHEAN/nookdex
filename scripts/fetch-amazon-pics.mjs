// The pictures of the sealed products on amazon.fr (src/data/amazon-products.json, lib/amazonShop): each product's official picture, from
// its Poképédia page (its main image) or file ("Fichier:…"), shrunk into public/amazon/<slug>.webp; src/data/amazon-pics.json
// says which picture each title gave. A picture already there is kept (--force fetches them all again).
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
  if (title.startsWith("Fichier:")) {
    const j = await api({ action: "query", prop: "imageinfo", iiprop: "url", iiurlwidth: "960", titles: title });
    const i = j.query.pages[0]?.imageinfo?.[0];
    return i?.thumburl ?? i?.url ?? null;
  }
  const j = await api({ action: "query", prop: "pageimages", piprop: "thumbnail", pithumbsize: "960", redirects: "1", titles: title });
  return j.query.pages[0]?.thumbnail?.source ?? null;
}

const data = JSON.parse(await fs.readFile(DATA, "utf8"));
const pics = JSON.parse(await fs.readFile(PICS, "utf8").catch(() => "{}"));
await fs.mkdir(OUT, { recursive: true });
const titles = new Set(data.groups.flatMap((g) => [g.pic, ...g.products.map((p) => p.pic)]).filter(Boolean));
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
  const img = sharp(buf).trim({ threshold: 4 }).resize(480, 480, { fit: "inside", withoutEnlargement: true });
  const info = await img.webp({ quality: 82 }).toFile(path.join(OUT, file));
  pics[title] = { src: `/amazon/${file}`, w: info.width, h: info.height };
  console.log("ok", title, `${info.width}x${info.height}`);
  await wait(250);
}
await fs.writeFile(PICS, JSON.stringify(Object.fromEntries(Object.entries(pics).sort(([a], [b]) => a.localeCompare(b))), null, 2) + "\n");
if (missing.length) console.log(`no picture on Poképédia (the group's is shown): \n- ${missing.join("\n- ")}`);
