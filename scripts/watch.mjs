// Weekly watch (GitHub Action "Veille cartes et prix"):
//   1. French scans: cards shown with an English scan, or as a card back (taken out by TCGdex),
//      checked against TCGdex again. Sets with news are downloaded again (npm run fetch-set -- <ids>).
//   2. Prices: the Cardmarket fields TCGdex gives, compared with the ones we know. A new field
//      (French-only prices, a new market…) is reported.
// Writes watch-report.md (empty when there's nothing new) and watch-sets.txt (sets to download again).
import { readdir, readFile, writeFile } from "node:fs/promises";

const API = "https://api.tcgdex.net/v2";
const OUT = "public/sets";

/** pricing fields already known (see https://tcgdex.dev/markets-prices) */
const KNOWN_MARKETS = new Set(["cardmarket", "tcgplayer"]);
const KNOWN_CM = new Set([
  "updated", "unit", "idProduct", "avg", "low", "trend", "avg1", "avg7", "avg30",
  "avg-holo", "low-holo", "trend-holo", "avg1-holo", "avg7-holo", "avg30-holo",
]);
/** a few well-sold cards to look at the prices on */
const SAMPLES = ["swsh12-186", "sv08.5-082", "swsh7-215", "sv03.5-199", "me01-001"];

async function get(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.json();
      if (res.status === 404) return null;
    } catch {}
    await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  return null;
}

async function exists(url) {
  try {
    return (await fetch(url, { method: "HEAD" })).ok;
  } catch {
    return false;
  }
}

async function pool(items, size, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

// 1. scans
const todo = [];
for (const f of await readdir(OUT)) {
  if (f === "index.json" || !f.endsWith(".json")) continue;
  const set = JSON.parse(await readFile(`${OUT}/${f}`, "utf8"));
  for (const c of set.cards) {
    if (c.unavailable || !c.img) todo.push({ set: set.id, card: c, kind: "back" });
    else if (c.img.includes("/en/")) todo.push({ set: set.id, card: c, kind: "en" });
  }
}

const found = new Map(); // set id -> { fr: n, back: n }
await pool(todo, 12, async ({ set, card, kind }) => {
  let ok = false;
  if (kind === "en") ok = await exists(`${card.img.replace("/en/", "/fr/")}/low.webp`);
  else {
    const d = await get(`${API}/fr/cards/${card.id}`);
    ok = !!d?.image;
  }
  if (!ok) return;
  const n = found.get(set) ?? { fr: 0, back: 0 };
  n[kind === "en" ? "fr" : "back"]++;
  found.set(set, n);
});

// 2. prices
const newFields = new Map();
for (const id of SAMPLES) {
  const d = await get(`${API}/fr/cards/${id}`);
  const pricing = d?.pricing ?? {};
  for (const market of Object.keys(pricing)) {
    if (!KNOWN_MARKETS.has(market)) newFields.set(`pricing.${market}`, id);
  }
  for (const key of Object.keys(pricing.cardmarket ?? {})) {
    if (!KNOWN_CM.has(key)) newFields.set(`pricing.cardmarket.${key}`, id);
  }
}

// report
const lines = [];
if (found.size) {
  lines.push("### 🖼️ Nouveaux visuels", "");
  lines.push(`${todo.filter((t) => t.kind === "en").length} cartes en scan anglais et ${todo.filter((t) => t.kind === "back").length} en dos de carte vérifiées.`, "");
  for (const [set, n] of found) {
    const parts = [n.fr && `${n.fr} scan(s) FR`, n.back && `${n.back} carte(s) de retour chez TCGdex`].filter(Boolean);
    lines.push(`- \`${set}\` : ${parts.join(", ")}`);
  }
  lines.push("", "Ces extensions ont été retéléchargées dans ce passage.", "");
}
if (newFields.size) {
  lines.push("### 💶 Nouveaux champs de prix chez TCGdex", "");
  for (const [field, id] of newFields) lines.push(`- \`${field}\` (vu sur \`${id}\`)`);
  lines.push("", "À regarder : peut-être des prix Cardmarket par langue (FR) ou un nouveau marché. Doc : https://tcgdex.dev/markets-prices", "");
}

await writeFile("watch-report.md", lines.join("\n"));
await writeFile("watch-sets.txt", [...found.keys()].join(" "));
console.log(`scans: ${todo.length} checked, ${found.size} set(s) with news · prices: ${newFields.size} new field(s)`);
