// Every day, after the prices: today's price of every binder card goes into its set's history (the card sheet's curve).
//
//   node scripts/price-history.mjs        run by the prices Action, after fetch-set (French, English, Japanese)
//
// Output: public/history/<fr|en|ja>/<set id>.json = { days: ["2026-10-04", …], cards: { "<card id>": [12.5, null, …] } }
// One column a day; a second run on the same day replaces it. The price is the card's trend on its market (Cardmarket
// euros, TCGplayer dollars for English cards); null = no price that day (and for a card TCGdex took out: its frozen
// last price would draw a flat line that never happened). No source keeps old prices for us (TCGCSV's archive is closed):
// the history starts with the first run.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const today = new Date().toISOString().slice(0, 10);
const round = (n) => (typeof n === "number" ? Math.round(n * 100) / 100 : null);
const priceOf = (c) => (c.unavailable ? null : round(c.price?.trend || c.price?.trendHolo || null));

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
      row[col] = priceOf(card);
    }
    // cards gone from the file keep their past, with a hole today
    for (const row of Object.values(h.cards)) while (row.length < h.days.length) row.push(null);
    await writeFile(out, JSON.stringify(h));
    files++;
  }
}
console.log(`price history: ${today} written in ${files} sets`);
