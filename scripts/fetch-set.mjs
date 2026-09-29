// Fetches a set (+ optional sub-sets like the Trainer Gallery) from TCGdex
// and writes a compact JSON used by the binders.
// Usage: node scripts/fetch-set.mjs swsh12 swsh12tg
import { writeFile, mkdir } from "node:fs/promises";

const API = "https://api.tcgdex.net/v2";
const LANG = "fr";
const [mainId, ...subIds] = process.argv.slice(2);
if (!mainId) {
  console.error("usage: node scripts/fetch-set.mjs <setId> [subSetId...]");
  process.exit(1);
}

async function get(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 404) return null;
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  throw new Error(`failed: ${url}`);
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

const round = (n) => (typeof n === "number" ? Math.round(n * 100) / 100 : null);

async function exists(url) {
  const res = await fetch(url, { method: "HEAD" });
  return res.ok;
}

// Base URL of the main set's scans, e.g. https://assets.tcgdex.net/fr/swsh/swsh12
let mainImageBase = null;

async function fetchCards(setId) {
  const set = await get(`${API}/${LANG}/sets/${setId}`);
  if (!set) throw new Error(`set not found: ${setId}`);
  const cards = await pool(set.cards, 8, async (c) => {
    const d = await get(`${API}/${LANG}/cards/${c.id}`);
    let image = d?.image ?? c.image;
    if (!image && mainImageBase) {
      // Sub-sets (ex: Trainer Gallery) have their scans stored under the main set.
      const guess = `${mainImageBase}/${c.localId}`;
      if (await exists(`${guess}/low.webp`)) image = guess;
    }
    if (!image) {
      // Still nothing -> fall back to the English scan.
      const en = await get(`${API}/en/cards/${c.id}`);
      image = en?.image ?? null;
    }
    const cm = d?.pricing?.cardmarket ?? {};
    const v = d?.variants ?? {};
    const variants = ["normal", "reverse", "holo"].filter((k) => v[k]);
    return {
      id: c.id,
      num: c.localId,
      name: c.name,
      rarity: d?.rarity ?? null,
      category: d?.category ?? null,
      img: image,
      variants: variants.length ? variants : ["normal"],
      price: {
        low: round(cm.low),
        trend: round(cm.trend),
        lowHolo: round(cm["low-holo"]),
        trendHolo: round(cm["trend-holo"]),
      },
    };
  });
  process.stdout.write(`${setId}: ${cards.length} cards\n`);
  return { set, cards };
}

const main = await fetchCards(mainId);
mainImageBase = main.cards.find((c) => c.img)?.img.replace(/\/[^/]+$/, "") ?? null;
const subs = [];
for (const id of subIds) subs.push(await fetchCards(id));

const out = {
  id: main.set.id,
  name: main.set.name,
  logo: main.set.logo ?? null,
  symbol: main.set.symbol ?? null,
  official: main.set.cardCount?.official ?? null,
  releaseDate: main.set.releaseDate ?? null,
  pricesUpdated: new Date().toISOString(),
  cards: [...main.cards, ...subs.flatMap((s) => s.cards)],
};

await mkdir("src/data/sets", { recursive: true });
await writeFile(`src/data/sets/${mainId}.json`, JSON.stringify(out));
console.log(`wrote src/data/sets/${mainId}.json (${out.cards.length} cards)`);
