// Fetches the card catalog from TCGdex: every set a binder can be made of.
//
//   npm run fetch-set              every set that isn't downloaded yet
//   npm run fetch-set -- --force   every binder set (refreshes the prices), plus the extra sets not downloaded yet
//   npm run fetch-set -- --all     every set, extra sets included (slow: thousands of cards)
//   npm run fetch-set -- swsh12    one set (+ its sub-sets, like the Trainer Gallery)
//   add --lang=en                  the same in English, priced on TCGplayer in dollars
//   add --lang=ja                  the same in Japanese (Cardmarket prices, which are per language for Japanese cards)
//
// Binder sets: the main sets of the recent series and of the Wizards era (1999-2003), offered as binders.
// Extra sets: everything else in French (older series, promos, energies…), only for the free binders' search.
//
// Output:
//   public/sets/<id>.json    one set, loaded when its binder is opened
//   public/sets/index.json   every card in a few fields, for the free binders' search
//   src/data/catalog.json    the sets offered in the "new binder" menu
//   public/scans/<card id>/  scans of cards TCGdex has none of (TCGplayer's picture, see scansFromTcgcsv)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const API = "https://api.tcgdex.net/v2";
// French (default), English (same card ids) or Japanese (its own sets and ids): files side by side.
const LANG = process.argv.find((a) => a.startsWith("--lang="))?.slice(7) ?? "fr";
const FR = LANG === "fr";
const JA = LANG === "ja";
const OUT = FR ? "public/sets" : `public/sets/${LANG}`;
const LOGOS = FR ? "public/logos" : `public/logos/${LANG}`;
const CATALOG_FILE = FR ? "src/data/catalog.json" : `src/data/catalog-${LANG}.json`;
const ASSETS = "https://assets.tcgdex.net/";
// English cards are priced on TCGplayer (US, English cards only), in dollars. A card TCGplayer doesn't sell gets
// its Cardmarket price converted at the ECB rate, kept here for the site (it converts the player's money too).
const RATE_FILE = "src/data/eur-usd.json";

/** The Wizards of the Coast era (1999-2003): one tab of the "new binder" menu (BinderPicker), a few series at TCGdex. */
const WIZARDS = ["ecard", "lc", "neo", "gym", "base"];
/** Series offered as binders, newest first (Japanese ids: MEGA, Scarlet & Violet, Sword & Shield). */
const SERIES = JA ? ["M", "SV", "S"] : ["me", "sv", "swsh", ...WIZARDS];
/** TCGdex "series" that aren't cards you collect. */
const SKIP_SERIES = new Set(["tcgp"]);
/** Promos and energies: not a set you open boosters of. */
const SKIP = new Set(["swshp", "svp", "sve", "mep", "mee", "basep"]);
/** Japanese: promos, starter decks, collections, and the Chinese "CS" sets TCGdex files under Japanese. */
const SKIP_JA = /-P$|^CS|^SVL|^SVK$|^MC$|^MF$/;
const skipped = (id) => SKIP.has(id) || (JA && SKIP_JA.test(id));
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

/** Today's euro -> dollar rate (ECB), else the last one saved. */
async function eurUsd() {
  const saved = existsSync(RATE_FILE) ? JSON.parse(await readFile(RATE_FILE, "utf8")) : null;
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD");
    const rate = res.ok ? (await res.json()).rates?.USD : null;
    if (rate) return { rate, date: new Date().toISOString().slice(0, 10) };
  } catch {
    // offline: the last rate
  }
  if (!saved) throw new Error("no euro -> dollar rate");
  return saved;
}
// only English cards are in dollars
const EN = LANG === "en";
const RATE = EN ? await eurUsd() : null;

/**
 * Japanese cards have Japanese names only: the French and English names of their Pokémon (PokéAPI, by National Dex
 * number) let a French or English player find them ("pikachu", "dracaufeu"). The Japanese names find the Pokémon of a
 * card TCGdex gives no dex number for (one in seven, ex: S12 Lugia V).
 */
async function pokemonNames() {
  const query = `{ pokemon_v2_pokemonspeciesname(where: {pokemon_v2_language: {name: {_in: ["fr", "en", "ja-Hrkt"]}}}) { name pokemon_species_id pokemon_v2_language { name } } }`;
  const res = await fetch("https://beta.pokeapi.co/graphql/v1beta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const names = new Map();
  for (const r of (await res.json()).data.pokemon_v2_pokemonspeciesname) {
    const n = names.get(r.pokemon_species_id) ?? {};
    n[r.pokemon_v2_language.name] = r.name;
    names.set(r.pokemon_species_id, n);
  }
  return names;
}
const NAMES = JA ? await pokemonNames() : null;
/** Japanese species names, longest first: "ミュウツー" (Mewtwo) must win over "ミュウ" (Mew) */
const JA_NAMES = JA
  ? [...NAMES].flatMap(([id, n]) => (n["ja-Hrkt"]?.length > 1 ? [[n["ja-Hrkt"], id]] : [])).sort((a, b) => b[0].length - a[0].length)
  : [];

/** Dex numbers of a card: TCGdex's, else the Pokémon whose Japanese name is in the card's ("ルギアV" -> Lugia). */
function dexOf(d) {
  if (d?.dexId?.length) return d.dexId;
  if (d?.category !== "Pokemon" || !d.name) return [];
  const hit = JA_NAMES.find(([name]) => d.name.includes(name));
  return hit ? [hit[1]] : [];
}

/** "Dracaufeu · Charizard", "Pikachu" (same in both), "Pikachu · Zekrom" for a tag team; null for a trainer. */
function akaOf(d) {
  const out = new Set();
  for (const id of dexOf(d)) {
    const n = NAMES.get(id);
    if (n?.fr) out.add(n.fr);
    if (n?.en) out.add(n.en);
  }
  return out.size ? [...out].join(" · ") : null;
}

function cardmarketPrice(cm) {
  return {
    low: round(cm.low),
    trend: round(cm.trend),
    lowHolo: round(cm["low-holo"]),
    trendHolo: round(cm["trend-holo"]),
    avg7: round(cm.avg7),
    avg30: round(cm.avg30),
    avg7Holo: round(cm["avg7-holo"]),
    avg30Holo: round(cm["avg30-holo"]),
    // Cardmarket product id: "voir sur Cardmarket" opens the card's own page (…/Products?idProduct=)
    ...(cm.idProduct ? { cmId: cm.idProduct } : {}),
  };
}

/** A Cardmarket price (euros) in dollars, flagged "cm" so the card says where it comes from. */
function cardmarketInDollars(p) {
  const usd = (n) => (n == null ? null : round(n * RATE.rate));
  const out = { ...p, low: usd(p.low), trend: usd(p.trend), lowHolo: usd(p.lowHolo), trendHolo: usd(p.trendHolo) };
  return p.low != null || p.trend != null || p.lowHolo != null || p.trendHolo != null ? { ...out, cm: true } : out;
}

/**
 * TCGplayer price of an English card: market price as the trend, lowest listing as the low. The "holo" fields hold the
 * reverse (or the holo of a card that also comes plain), like Cardmarket's. TCGplayer gives no averages: the ↗ ↘ arrow
 * keeps Cardmarket's (only their ratio is used). Null when TCGplayer doesn't sell the card.
 */
function tcgplayerPrice(tp, cm) {
  const kinds = Object.keys(tp ?? {}).filter((k) => tp[k] && typeof tp[k] === "object" && tp[k].productId);
  if (!kinds.length) return null;
  const base = tp.normal ?? tp.holofoil ?? tp[kinds.find((k) => k !== "reverse-holofoil")] ?? null;
  const holo = tp["reverse-holofoil"] ?? (tp.normal ? tp.holofoil : null) ?? null;
  const p = cardmarketPrice(cm);
  return {
    low: round(base?.lowPrice),
    trend: round(base?.marketPrice ?? base?.midPrice),
    lowHolo: round(holo?.lowPrice),
    trendHolo: round(holo?.marketPrice ?? holo?.midPrice),
    avg7: p.avg7,
    avg30: p.avg30,
    avg7Holo: p.avg7Holo,
    avg30Holo: p.avg30Holo,
    tp: (base ?? holo).productId,
    ...(p.cmId ? { cmId: p.cmId } : {}),
  };
}

function priceOf(d) {
  const cm = d?.pricing?.cardmarket ?? {};
  if (FR || JA) return cardmarketPrice(cm);
  return tcgplayerPrice(d?.pricing?.tcgplayer, cm) ?? cardmarketInDollars(cardmarketPrice(cm));
}

/*
 * TCGCSV (tcgcsv.com): TCGplayer's own catalog and prices, refreshed every day around 20:00 UTC. TCGdex doesn't link
 * some English cards to TCGplayer (Trainer Galleries, Shiny Vault, the 30th Celebration…): they got Cardmarket's price
 * in dollars, or none. Their TCGplayer price is found here by set name, card number and name.
 */
const TCGCSV = "https://tcgcsv.com/tcgplayer/3"; // 3 = Pokémon (85 would be Pokémon Japan)
let tcgGroups = null;
/** Their rules (tcgcsv.com/docs): a named User-Agent, ~100 ms between requests, one sync a day (the daily Action). */
async function tcgcsv(path) {
  await new Promise((r) => setTimeout(r, 120));
  const res = await fetch(`${TCGCSV}${path}`, { headers: { "User-Agent": "NookDex/1.0 (+https://nookdex.com)" } });
  if (!res.ok) throw new Error(`TCGCSV ${res.status} ${path}`);
  return res.json();
}
const plain = (s) =>
  String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
/** "TG05/TG30" -> "TG5", "007" -> "7": the printed number, compared without its leading zeros */
const numKey = (n) => String(n ?? "").split("/")[0].trim().toUpperCase().replace(/(^|[A-Z])0+(\d)/g, "$1$2");

/** The card's TCGplayer price from TCGCSV's rows (one per print: Normal, Holofoil, Reverse Holofoil). */
function tcgcsvPrice(rows, old) {
  const by = new Map(rows.map((r) => [r.subTypeName, r]));
  const base = by.get("Normal") ?? by.get("Holofoil") ?? rows.find((r) => r.subTypeName !== "Reverse Holofoil") ?? null;
  const holo = by.get("Reverse Holofoil") ?? (by.get("Normal") ? by.get("Holofoil") : null) ?? null;
  const trend = round(base?.marketPrice ?? base?.midPrice);
  const trendHolo = round(holo?.marketPrice ?? holo?.midPrice);
  if (trend == null && trendHolo == null) return null;
  // the ↗ ↘ arrow keeps Cardmarket's averages (only their ratio is used)
  const { cm: _, ...rest } = old;
  return { ...rest, low: round(base?.lowPrice), trend, lowHolo: round(holo?.lowPrice), trendHolo, tp: (base ?? holo).productId };
}

/** Fills the set's English cards that have no TCGplayer price; returns how many were found. */
async function fillFromTcgcsv(setName, cards) {
  const gaps = cards.filter((c) => c.price.cm || (c.price.trend == null && c.price.trendHolo == null));
  if (!gaps.length) return 0;
  tcgGroups ??= (await tcgcsv("/groups")).results ?? [];
  // "SWSH12: Silver Tempest", "SWSH12: Silver Tempest Trainer Gallery", "ME: 30th Celebration Classic Collection"…
  const name = plain(setName);
  const groups = tcgGroups.filter((g) => plain(g.name.replace(/^[^:]*:\s*/, "")).startsWith(name) || plain(g.name).startsWith(name));
  const products = [];
  for (const g of groups) {
    const list = await tcgcsv(`/${g.groupId}/products`);
    const prices = await tcgcsv(`/${g.groupId}/prices`);
    const rows = new Map();
    for (const r of prices?.results ?? []) rows.set(r.productId, [...(rows.get(r.productId) ?? []), r]);
    for (const p of list?.results ?? []) {
      const number = p.extendedData?.find((e) => e.name === "Number")?.value;
      // sealed products have no number
      if (number && rows.has(p.productId)) products.push({ key: numKey(number), name: plain(p.name), rows: rows.get(p.productId) });
    }
  }
  let found = 0;
  for (const card of gaps) {
    let hits = products.filter((p) => p.key === numKey(card.num));
    // the same number in two groups (main set and its gallery): the name decides
    if (hits.length > 1) hits = hits.filter((p) => p.name.startsWith(plain(card.name).split(" ")[0]));
    if (hits.length !== 1) continue;
    const price = tcgcsvPrice(hits[0].rows, card.price);
    if (!price) continue;
    card.price = price;
    found++;
  }
  return found;
}

async function exists(url) {
  const res = await fetch(url, { method: "HEAD" });
  return res.ok;
}

/*
 * Cards TCGdex lists without a scan in any language (the 30th Celebration's Classic Collection, for months): TCGplayer
 * has their picture. Found on TCGCSV in the group of the card's set (its English name), by name (the Classic
 * Collection keeps the original cards' numbers: "4/102", not "001"), and made into the scans the site reads
 * (<img>/low.webp, high.webp, low.png, high.png) under public/scans/<card id>/, served by the site itself. The same
 * English picture for every card language; English cards take TCGplayer's price with it. The day TCGdex has a scan,
 * fetchCards takes it and this one is no longer used.
 */
const SITE = "https://nookdex.com";
const SCANS = "public/scans";
const words = (s) => new Set(plain(String(s ?? "").replace(/\(.*?\)|\s-\s.*$/g, "")).split(" ").filter(Boolean));
/** how alike two card names are, 0 to 1 ("Metagross (Delta Species)" ~ "Metagross", "M Gardevoir EX" ~ "M Gardevoir-EX") */
function alike(a, b) {
  const x = words(a);
  const y = words(b);
  const both = [...x].filter((w) => y.has(w)).length;
  return both / (new Set([...x, ...y]).size || 1);
}
let sharp;
async function makeScans(id, imageUrl) {
  const dir = `${SCANS}/${id}`;
  if (existsSync(`${dir}/high.webp`)) return true;
  sharp ??= (await import("sharp")).default;
  // the biggest picture TCGplayer has, else the one TCGCSV gives
  let buf = null;
  for (const url of [imageUrl.replace(/_\d+w\.jpg$/, "_in_1000x1000.jpg"), imageUrl.replace(/_\d+w\.jpg$/, "_400w.jpg")]) {
    const res = await fetch(url).catch(() => null);
    if (res?.ok) {
      buf = Buffer.from(await res.arrayBuffer());
      break;
    }
  }
  if (!buf) return false;
  await mkdir(dir, { recursive: true });
  // TCGdex's sizes: 245 and 600 px wide
  for (const [name, width] of [["low", 245], ["high", 600]]) {
    const img = sharp(buf).resize({ width, height: Math.round(width * 1.395), fit: "cover" });
    await img.clone().webp({ quality: 82 }).toFile(`${dir}/${name}.webp`);
    // the share pictures (next/og) read png: a palette keeps them small
    await img.clone().png({ palette: true, quality: 85 }).toFile(`${dir}/${name}.png`);
  }
  return true;
}
async function scansFromTcgcsv(mainId, cards) {
  tcgGroups ??= (await tcgcsv("/groups")).results ?? [];
  const groupName = (g) => plain(g.name.replace(/^[^:]*:\s*/, ""));
  const products = new Map(); // set id -> TCGCSV cards of its group, numbered order
  const used = new Set();
  let found = 0;
  for (const card of cards.filter((c) => !c.img).sort((a, b) => a.id.localeCompare(b.id))) {
    const setId = card.id.slice(0, card.id.lastIndexOf("-"));
    if (!products.has(setId)) {
      const setName = plain((await get(`${API}/en/sets/${setId}`))?.name);
      // its own group ("ME: 30th Celebration Classic Collection"), else every group of the main set's name
      let groups = tcgGroups.filter((g) => groupName(g) === setName);
      if (!groups.length) {
        const main = plain((await get(`${API}/en/sets/${mainId}`))?.name);
        groups = tcgGroups.filter((g) => main && groupName(g).startsWith(main));
      }
      const list = [];
      for (const g of groups) {
        const items = (await tcgcsv(`/${g.groupId}/products`))?.results ?? [];
        const prices = (await tcgcsv(`/${g.groupId}/prices`))?.results ?? [];
        for (const p of items) {
          const number = p.extendedData?.find((e) => e.name === "Number")?.value;
          if (number && p.imageUrl) list.push({ ...p, number, rows: prices.filter((r) => r.productId === p.productId) });
        }
      }
      list.sort((a, b) => parseInt(a.number, 10) - parseInt(b.number, 10));
      products.set(setId, list);
    }
    // the same number and name, else the closest name (two alike: the lower number first, like TCGdex's order)
    const list = products.get(setId).filter((p) => !used.has(p.productId));
    let hit = list.find((p) => numKey(p.number) === numKey(card.num) && alike(p.name, card.enName) >= 0.5);
    if (!hit) {
      const best = Math.max(0, ...list.map((p) => alike(p.name, card.enName)));
      hit = best >= 0.5 ? list.find((p) => alike(p.name, card.enName) === best) : null;
    }
    if (!hit) {
      // one name inside the other ("Palkia" and "Palkia LV.X"), when only one card is so
      const within = list.filter((p) => [...words(card.enName)].every((w) => words(p.name).has(w)));
      if (within.length === 1) hit = within[0];
    }
    if (!hit || !(await makeScans(card.id, hit.imageUrl))) continue;
    used.add(hit.productId);
    card.img = `${SITE}/scans/${card.id}`;
    if (EN) card.price = tcgcsvPrice(hit.rows, card.price) ?? card.price;
    console.log(`  ${card.id} ${card.enName}: TCGplayer scan (${hit.name}, ${hit.number})`);
    found++;
  }
  return found;
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
  // Japanese: the set's own code (SV8, SV2a…)
  if (JA) return set.id;
  // English: the official abbreviation (SIT, PAL…)
  if (!FR) return set.abbreviation?.official ?? set.tcgOnline ?? set.id.toUpperCase();
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
    let enName = EN ? c.name : null;
    if (!image && !JA) {
      // Still nothing -> the English card. Its French scan is sometimes on the asset server all the same (the API
      // just doesn't list it): same path, "fr" instead of "en". Else the English scan.
      const en = await get(`${API}/en/cards/${c.id}`);
      enName = en?.name ?? enName;
      image = en?.image ?? null;
      const fr = image?.replace("/en/", `/${LANG}/`);
      if (fr && fr !== image && (await exists(`${fr}/low.webp`))) image = fr;
    }
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
      price: priceOf(d),
      ...(JA && akaOf(d) ? { aka: akaOf(d) } : {}),
      // no scan at all: its English name, to find it on TCGCSV (scansFromTcgcsv); dropped from the file
      ...(!image && enName ? { enName } : {}),
    };
  });
  // Japanese cards without a scan wait for TCGdex; the others get a chance on TCGCSV first
  return { set, cards: cards.filter((c) => c.img || (!JA && c.enName)) };
}

/**
 * A card TCGdex stops listing is never dropped: players may own it. It stays with its last known prices,
 * flagged "unavailable" (shown as a card back with "Bientôt de retour"), until TCGdex lists it again.
 * A scan borrowed from the main set's card of the same number (the old sub-set guess) was wrong: it goes.
 */
async function keepVanished(mainId, cards, mainNums) {
  const file = `${OUT}/${mainId}.json`;
  if (!existsSync(file)) return 0;
  const prev = JSON.parse(await readFile(file, "utf8"));
  const before = prev.cards ?? [];
  // English files from before the dollars hold Cardmarket euros
  const euros = EN && prev.currency !== "USD";
  const now = new Set(cards.map((c) => c.id));
  let n = 0;
  for (const old of before) {
    if (now.has(old.id)) continue;
    const setId = old.id.slice(0, old.id.lastIndexOf("-"));
    const folder = old.img?.split("/").at(-2);
    const borrowed = setId !== mainId && folder === mainId && mainNums.has(old.num);
    const price = euros ? cardmarketInDollars(old.price) : old.price;
    cards.push({ ...old, price, img: borrowed ? "" : (old.img ?? ""), unavailable: true });
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
    ...(EN ? { currency: "USD" } : {}),
    cards: [...main.cards, ...subs.flatMap((s) => s.cards)],
  };
  try {
    if (out.cards.some((c) => !c.img)) await scansFromTcgcsv(mainId, out.cards);
  } catch (e) {
    console.warn(`${mainId}: TCGCSV scans skipped (${e.message})`);
  }
  out.cards = out.cards.filter((c) => c.img).map(({ enName: _, ...c }) => c);
  const gone = await keepVanished(mainId, out.cards, nums);
  let filled = 0;
  try {
    if (EN) filled = await fillFromTcgcsv(out.name, out.cards);
  } catch (e) {
    // TCGCSV down: the Cardmarket prices in dollars stay
    console.warn(`${mainId}: TCGCSV skipped (${e.message})`);
  }
  await writeFile(`${OUT}/${mainId}.json`, JSON.stringify(out));
  console.log(`${mainId}: ${out.cards.length} cards${gone ? ` (${gone} no longer on TCGdex, kept)` : ""}${filled ? ` (${filled} priced by TCGCSV)` : ""}`);
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
  // a series that wasn't printed in this language (Gym, Legendary Collection in French)
  if (!s) continue;
  const sets = s.sets.filter((x) => !skipped(x.id) && !PARENT[x.id]);
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
await mkdir(LOGOS, { recursive: true });
await pool(catalog, 6, async (c) => {
  if (!c.logo?.startsWith("http")) return;
  const file = `${LOGOS}/${c.id}.png`;
  if (!existsSync(file)) {
    try {
      const res = await fetch(`${c.logo}.png`);
      if (!res.ok) return;
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
    } catch {
      return; // keep the TCGdex address
    }
  }
  c.logo = `/${LOGOS.replace(/^public\//, "")}/${c.id}`;
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
  // English extra sets fetched before the dollars: their Cardmarket euros, converted
  const toUsd = EN && data.currency !== "USD" ? RATE.rate : 1;
  for (const card of data.cards) {
    // [id, name, num, set, image path, trend, (Japanese cards) French and English names]
    const trend = card.price.trend == null ? null : round(card.price.trend * toUsd);
    const row = [card.id, card.name, card.num, c.id, (card.img ?? "").replace(ASSETS, ""), trend];
    index.push(card.aka ? [...row, card.aka] : row);
  }
}
if (RATE) await writeFile(RATE_FILE, JSON.stringify(RATE) + "\n");

// Sets with no scan at all in this language stay out (extra ones, and Japanese binder sets TCGdex has no pictures of yet).
const kept = catalog.filter((c) => (existsSync(`${OUT}/${c.id}.json`) ? c.total > 0 : !c.extra));
await writeFile(CATALOG_FILE, JSON.stringify(kept, null, 1));
await writeFile(`${OUT}/index.json`, JSON.stringify({ assets: ASSETS, cards: index }));
console.log(`catalog: ${catalog.length} sets, ${index.length} cards`);
