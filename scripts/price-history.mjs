// Every day, after the prices: today's price of every binder card goes into its set's history (the card sheet's curve).
//
//   node scripts/price-history.mjs        run by the prices Action, after fetch-set (French, English, Japanese)
//
// Output: public/history/<fr|en|ja>/<set id>.json = { days: ["2026-10-04", …], cards: { "<card id>": [12.5, null, …] } }
// One column a day; a second run on the same day replaces it. The price is the card's trend on its market (Cardmarket
// euros, TCGplayer dollars for English cards); null = no price that day (and for a card TCGdex took out: its frozen
// last price would draw a flat line that never happened). No source keeps old prices for us (TCGCSV's archive is closed):
// the history starts with the first run.
// A rare card's trend jumps on one odd sale: the Base Set Charizard read 0,02 € two days running (2026-10-18/19) next to
// ~78 € the day before. Such a price goes in as null (a hole) instead of a fall that never happened: under 5 % of both the
// card's last known price and its median (a glitch upwards, 1 410 € one day then 25 € for weeks, mustn't blank the 25s),
// unless Cardmarket's 30-day average says it too (a real collapse then gets through). A slow slide to a few cents (a
// common card) is never caught: each day is close to the last.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const today = new Date().toISOString().slice(0, 10);
const round = (n) => (typeof n === "number" ? Math.round(n * 100) / 100 : null);
const priceOf = (c) => (c.unavailable ? null : round(c.price?.trend || c.price?.trendHolo || null));
/** below this share of the last known price and of the median, a day's price is a glitch */
const GLITCH = 0.05;
let glitches = 0;
function checked(card, row, col) {
  const p = priceOf(card);
  const known = row.slice(0, col).filter((v) => v != null);
  if (p == null || !known.length || p >= known.at(-1) * GLITCH) return p;
  const sorted = known.toSorted((a, b) => a - b);
  const usual = Math.min(known.at(-1), sorted[sorted.length >> 1]);
  if (p >= usual * GLITCH) return p;
  const avg30 = card.price?.trend ? card.price.avg30 : card.price?.avg30Holo;
  if (avg30 != null && avg30 < usual * GLITCH) return p;
  glitches++;
  return null;
}

let files = 0;
for (const lang of ["fr", "en", "ja"]) {
  const catalogFile = lang === "fr" ? "src/data/catalog.json" : `src/data/catalog-${lang}.json`;
  const setsDir = lang === "fr" ? "public/sets" : `public/sets/${lang}`;
  const outDir = `public/history/${lang}`;
  await mkdir(outDir, { recursive: true });
  const catalog = JSON.parse(await readFile(catalogFile, "utf8")).filter((s) => !s.extra);
  for (const set of catalog) {
    const file = `${setsDir}/${set.id}.json`;
    if (!existsSync(file)) continue;
    const data = JSON.parse(await readFile(file, "utf8"));
    const out = `${outDir}/${set.id}.json`;
    const h = existsSync(out) ? JSON.parse(await readFile(out, "utf8")) : { days: [], cards: {} };
    let col = h.days.indexOf(today);
    if (col < 0) {
      h.days.push(today);
      col = h.days.length - 1;
    }
    for (const card of data.cards) {
      // a card new to the set: nothing before today
      const row = (h.cards[card.id] ??= []);
      while (row.length < h.days.length) row.push(null);
      row[col] = checked(card, row, col);
    }
    // cards gone from the file keep their past, with a hole today
    for (const row of Object.values(h.cards)) while (row.length < h.days.length) row.push(null);
    await writeFile(out, JSON.stringify(h));
    files++;
  }
}
console.log(`price history: ${today} written in ${files} sets, ${glitches} glitched prices left out`);
