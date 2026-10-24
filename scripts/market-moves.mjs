// The market's moves (sprint 2, 2026-10-24): from the daily price history, the cards that rose and fell the most over 7
// and 30 days, per card language. Read by the market pages (/marche, /en/market) and the social and blog routines.
//
//   node scripts/market-moves.mjs        run by the prices Action, after price-history.mjs
//
// Output: public/market/<fr|en|ja>.json =
//   { updated, days, currency, floor, up7: [Move…], down7: […], up30: […], down30: […] }
//   Move = { id, name, num, set, setName, img, price, m7, d7, m30?, d30? }   (m: % move, d: the move in the currency)
// Only cards worth the floor or more today (1 € or $1: a card going from 0,03 € to 0,06 € isn't news), with a price on
// enough of the days. 30-day moves only once the history is that long. No per-card map: the room's « courrier »
// compares the player's own cards with what they were worth at their last visit (lib/courrier), it needs nothing here.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const TOP = 40;
/** the price a card must have today to be listed (in its market's currency) */
const FLOOR = 1;
/** and back then: a card new on the market (a few cents on day one) would rise thousands of percent */
const FLOOR_BEFORE = 0.5;
/** prices it must have had among the days of the window, its first and last included */
const MIN_DAYS = { 7: 5, 30: 20 };

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const DAY = 86_400_000;

/** The column of the day `back` days before the last one (the nearest day on or before it), or -1 */
function columnBack(days, back) {
  const last = Date.parse(`${days[days.length - 1]}T12:00:00Z`);
  const want = last - back * DAY;
  for (let i = days.length - 1; i >= 0; i--) if (Date.parse(`${days[i]}T12:00:00Z`) <= want) return i;
  return -1;
}

/** A card's move over the window that starts at column `from`: null when it hasn't enough prices */
function moveOf(row, from, last, need) {
  if (from < 0) return null;
  const now = row[last];
  const then = row[from];
  if (now == null || then == null || now < FLOOR || then < FLOOR_BEFORE) return null;
  let known = 0;
  for (let i = from; i <= last; i++) if (row[i] != null) known++;
  if (known < need) return null;
  return { m: round(((now - then) / then) * 100, 1), d: round(now - then) };
}

for (const lang of ["fr", "en", "ja"]) {
  const catalogFile = lang === "fr" ? "src/data/catalog.json" : `src/data/catalog-${lang}.json`;
  const setsDir = lang === "fr" ? "public/sets" : `public/sets/${lang}`;
  const catalog = JSON.parse(await readFile(catalogFile, "utf8")).filter((s) => !s.extra);
  const moves = [];
  let updated = "";
  let span = 0;
  for (const set of catalog) {
    const hFile = `public/history/${lang}/${set.id}.json`;
    const sFile = `${setsDir}/${set.id}.json`;
    if (!existsSync(hFile) || !existsSync(sFile)) continue;
    const h = JSON.parse(await readFile(hFile, "utf8"));
    if (!h.days.length) continue;
    const last = h.days.length - 1;
    if (h.days[last] > updated) updated = h.days[last];
    span = Math.max(span, h.days.length);
    const from7 = columnBack(h.days, 7);
    const from30 = columnBack(h.days, 30);
    const cards = new Map(JSON.parse(await readFile(sFile, "utf8")).cards.map((c) => [c.id, c]));
    for (const [id, row] of Object.entries(h.cards)) {
      const card = cards.get(id);
      if (!card || card.unavailable) continue;
      const w7 = moveOf(row, from7, last, MIN_DAYS[7]);
      if (!w7) continue;
      const w30 = moveOf(row, from30, last, MIN_DAYS[30]);
      moves.push({
        id,
        name: card.name,
        num: card.num,
        set: set.id,
        setName: set.name,
        img: card.img || null,
        price: row[last],
        m7: w7.m,
        d7: w7.d,
        ...(w30 && { m30: w30.m, d30: w30.d }),
      });
    }
  }
  const top = (key, dir) =>
    moves
      .filter((m) => m[key] != null && (dir > 0 ? m[key] > 0 : m[key] < 0))
      .sort((a, b) => dir * (b[key] - a[key]))
      .slice(0, TOP);
  const out = {
    updated,
    days: span,
    currency: lang === "en" ? "USD" : "EUR",
    floor: FLOOR,
    up7: top("m7", 1),
    down7: top("m7", -1),
    up30: top("m30", 1),
    down30: top("m30", -1),
  };
  await mkdir("public/market", { recursive: true });
  await writeFile(`public/market/${lang}.json`, JSON.stringify(out));
  console.log(`market moves ${lang}: ${moves.length} cards over the floor, ${out.up7.length}/${out.down7.length} on 7 days, ${out.up30.length}/${out.down30.length} on 30 days`);
}
