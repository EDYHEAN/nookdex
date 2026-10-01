// Fetches the card catalog from TCGdex: every set a binder can be made of.
//
//   npm run fetch-set              every set that isn't downloaded yet
//   npm run fetch-set -- --force   every binder set (refreshes the prices), plus the extra sets not downloaded yet
//   npm run fetch-set -- --all     every set, extra sets included (slow: thousands of cards)
//   npm run fetch-set -- swsh12    one set (+ its sub-sets, like the Trainer Gallery)
//
// Binder sets: the main sets of the recent series, offered as binders.
// Extra sets: everything else in French (older series, promos, energies…), only for the free binders' search.
//
// Output:
//   public/sets/<id>.json    one set, loaded when its binder is opened
//   public/sets/index.json   every card in a few fields, for the free binders' search
//   src/data/catalog.json    the sets offered in the "new binder" menu
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const API = "https://api.tcgdex.net/v2";
const LANG = "fr";
const OUT = "public/sets";
const ASSETS = "https://assets.tcgdex.net/";

/** Series offered as binders, newest first. */
const SERIES = ["me", "sv", "swsh"];
/** TCGdex "series" that aren't cards you collect. */
const SKIP_SERIES = new Set(["tcgp"]);
/** Promos and energies: not a set you open boosters of. */
const SKIP = new Set(["swshp", "svp", "sve", "mep", "mee"]);
/** Sub-sets printed inside another set's boosters: merged into that set's binder. */
const PARENT = {
  "swsh4.5sv": "swsh4.5",
  swsh9tg: "swsh9",
  swsh10tg: "swsh10",
  swsh11tg: "swsh11",
  swsh12tg: "swsh12",
  "swsh12.5gg": "swsh12.5",
  cel25cc: "cel25",
  "30th-c": "30th",
};
/** French codes that don't follow the "EB12" / "EV04" / "ME02" pattern. */
const CODES = {
  "swsh3.5": "EB3.5",
  "swsh4.5": "EB4.5",
  "swsh10.5": "PGO",
  "swsh12.5": "EB12.5",
  cel25: "CEL25",
  "sv03.5": "MEW",
  "sv04.5": "EV4.5",
  "sv06.5": "EV6.5",
  "sv08.5": "EV8.5",
  "sv10.5b": "BLK",
  "sv10.5w": "WHT",
  "me02.5": "ME2.5",
  "30th": "30TH",
};
const PREFIX = { swsh: "EB", sv: "EV", me: "ME" };

async function get(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.json();
      if (res.status === 404) return null;
    } catch {
      // network hiccup: retry
    }
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
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

/** Some logos are on the asset server but not listed by the API (ex: 30th): look for them, French first. */
async function logoOf(set, serie) {
  if (set.logo) return set.logo;
  for (const lang of [LANG, "en"]) {
    const url = `${ASSETS}${lang}/${serie}/${set.id}/logo`;
    if (await exists(`${url}.png`)) return url;
  }
  return null;
}

function codeOf(set, serie) {
  if (CODES[set.id]) return CODES[set.id];
  const m = set.id.match(/^[a-z]+0*(\d+)$/);
  if (m && PREFIX[serie]) return `${PREFIX[serie]}${m[1].padStart(2, "0")}`;
  return set.abbreviation?.official ?? set.id.toUpperCase();
}

async function fetchCards(setId, main) {
  const set = await get(`${API}/${LANG}/sets/${setId}`);
  if (!set) throw new Error(`set not found: ${setId}`);
  const cards = await pool(set.cards ?? [], 8, async (c) => {
    const d = await get(`${API}/${LANG}/cards/${c.id}`);
    let image = d?.image ?? c.image;
    if (!image && main?.base) {
      // Sub-sets have their scans stored under their own folder, or under the main set (Trainer Gallery: TG05…).
      // Never the main set's when it has a card of that number: 30th-c "029" is Lugia, 30th "029" is a Pikachu.
      const guesses = [`${main.base.replace(/[^/]+$/, setId)}/${c.localId}`];
      if (!main.nums.has(c.localId)) guesses.push(`${main.base}/${c.localId}`);
      for (const guess of guesses) {
        if (await exists(`${guess}/low.webp`)) {
          image = guess;
          break;
        }
      }
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
        avg7: round(cm.avg7),
        avg30: round(cm.avg30),
        avg7Holo: round(cm["avg7-holo"]),
        avg30Holo: round(cm["avg30-holo"]),
      },
    };
  });
  return { set, cards: cards.filter((c) => c.img) };
}

/**
 * A card TCGdex stops listing is never dropped: players may own it. It stays with its last known prices,
 * flagged "unavailable" (shown as a card back with "Bientôt de retour"), until TCGdex lists it again.
 * A scan borrowed from the main set's card of the same number (the old sub-set guess) was wrong: it goes.
 */
async function keepVanished(mainId, cards, mainNums) {
  const file = `${OUT}/${mainId}.json`;
  if (!existsSync(file)) return 0;
  const before = JSON.parse(await readFile(file, "utf8")).cards ?? [];
  const now = new Set(cards.map((c) => c.id));
  let n = 0;
  for (const old of before) {
    if (now.has(old.id)) continue;
    const setId = old.id.slice(0, old.id.lastIndexOf("-"));
    const folder = old.img?.split("/").at(-2);
    const borrowed = setId !== mainId && folder === mainId && mainNums.has(old.num);
    cards.push({ ...old, img: borrowed ? "" : (old.img ?? ""), unavailable: true });
    n++;
  }
  return n;
}

async function fetchSet(mainId, subIds) {
  const main = await fetchCards(mainId, null);
  const base = main.cards.find((c) => c.img)?.img.replace(/\/[^/]+$/, "") ?? null;
  const nums = new Set(main.cards.map((c) => c.num));
  const subs = [];
  for (const id of subIds) subs.push(await fetchCards(id, { base, nums }));
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
  const gone = await keepVanished(mainId, out.cards, nums);
  await writeFile(`${OUT}/${mainId}.json`, JSON.stringify(out));
  console.log(`${mainId}: ${out.cards.length} cards${gone ? ` (${gone} no longer on TCGdex, kept)` : ""}`);
  return out;
}

/* ------------------------------------------------------------------ */

await mkdir(OUT, { recursive: true });
const args = process.argv.slice(2);
const force = args.includes("--force");
const all = args.includes("--all");
const only = args.filter((a) => !a.startsWith("--"));

// Catalog: main sets of each series, newest first, sub-sets attached to their parent.
const catalog = [];
for (const serie of SERIES) {
  const s = await get(`${API}/${LANG}/series/${serie}`);
  const sets = s.sets.filter((x) => !SKIP.has(x.id) && !PARENT[x.id]);
  const detailed = await pool(sets, 6, (x) => get(`${API}/${LANG}/sets/${x.id}`));
  for (const set of detailed) {
    catalog.push({
      id: set.id,
      serie,
      serieName: s.name,
      name: set.name,
      code: codeOf(set, serie),
      logo: await logoOf(set, serie),
      releaseDate: set.releaseDate ?? null,
      total: set.cardCount?.total ?? 0,
      subs: Object.entries(PARENT)
        .filter(([, parent]) => parent === set.id)
        .map(([id]) => id),
    });
  }
}
catalog.sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""));

// Binder logos are served by the site itself: the shelf and the "new binder" menu show them all at once.
await mkdir("public/logos", { recursive: true });
await pool(catalog, 6, async (c) => {
  if (!c.logo?.startsWith("http")) return;
  const file = `public/logos/${c.id}.png`;
  if (!existsSync(file)) {
    try {
      const res = await fetch(`${c.logo}.png`);
      if (!res.ok) return;
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
    } catch {
      return; // keep the TCGdex address
    }
  }
  c.logo = `/logos/${c.id}`;
});

// Extra sets: every other French set (older series, promos, energies), searchable in the free binders.
const binderIds = new Set(catalog.flatMap((c) => [c.id, ...c.subs]));
const extras = [];
for (const serie of (await get(`${API}/${LANG}/series`)) ?? []) {
  if (SKIP_SERIES.has(serie.id)) continue;
  const s = await get(`${API}/${LANG}/series/${serie.id}`);
  for (const x of s?.sets ?? []) {
    if (binderIds.has(x.id)) continue;
    const set = await get(`${API}/${LANG}/sets/${x.id}`);
    if (!set?.cardCount?.total) continue;
    extras.push({
      id: set.id,
      serie: serie.id,
      serieName: s.name,
      name: set.name,
      code: codeOf(set, serie.id),
      logo: set.logo ?? null,
      releaseDate: set.releaseDate ?? null,
      total: set.cardCount.total,
      subs: [],
      extra: true,
    });
  }
}
extras.sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""));
catalog.push(...extras);

const missing = (c) => !existsSync(`${OUT}/${c.id}.json`);
const todo = catalog.filter((c) =>
  only.length ? only.includes(c.id) : all || missing(c) || (force && !c.extra),
);
for (const c of todo) {
  try {
    const data = await fetchSet(c.id, c.subs);
    c.total = data.cards.length;
  } catch (e) {
    // one broken set never stops the others (nor the daily prices)
    console.warn(`${c.id}: skipped (${e.message})`);
  }
}

// Card counts come from the downloaded files (sub-sets included, cards without scans dropped).
const index = [];
for (const c of catalog) {
  const file = `${OUT}/${c.id}.json`;
  if (!existsSync(file)) continue;
  const data = JSON.parse(await readFile(file, "utf8"));
  c.total = data.cards.length;
  if (!data.cards.length) continue;
  for (const card of data.cards) {
    // [id, name, num, set, image path, trend]
    index.push([card.id, card.name, card.num, c.id, (card.img ?? "").replace(ASSETS, ""), card.price.trend]);
  }
}

// Extra sets with no French scan at all stay out.
const kept = catalog.filter((c) => !c.extra || (existsSync(`${OUT}/${c.id}.json`) && c.total > 0));
await writeFile("src/data/catalog.json", JSON.stringify(kept, null, 1));
await writeFile(`${OUT}/index.json`, JSON.stringify({ assets: ASSETS, cards: index }));
console.log(`catalog: ${catalog.length} sets, ${index.length} cards`);
