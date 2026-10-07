// One-off probe (2026-10-07): what Cardmarket's help pages and Data downloads say and hold, and what they'd add to
// our prices. Run by .github/workflows/cm-probe.yml (Cardmarket can't be reached from Claude's container).
import { readdirSync, readFileSync } from "node:fs";

const UA = { "User-Agent": "NookDex/1.0 (+https://nookdex.com)" };
const PAGES = [
  "https://help.cardmarket.com/en/cardmarket-api",
  "https://help.cardmarket.com/en/api-partnerships",
  "https://www.cardmarket.com/en/Pokemon/Data",
  "https://www.cardmarket.com/en/Magic/Data",
];
const FILES = new Set([
  "https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json",
  "https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json",
  "https://downloads.s3.cardmarket.com/productCatalog/productList/products_nonsingles_6.json",
]);

const text = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

console.log("=== PAGES ===");
for (const url of PAGES) {
  try {
    const res = await fetch(url, { headers: UA });
    const html = await res.text();
    console.log(`\n--- ${url} → ${res.status} (${html.length} bytes)`);
    const t = text(html);
    const i = Math.max(0, t.search(/API|Price Guide|Download|partner/i) - 200);
    console.log(t.slice(i, i + 6000));
    for (const m of html.matchAll(/href="([^"]+)"/g)) {
      const h = m[1].replace(/&amp;/g, "&");
      if (/s3|download|\.json|\.csv|price.?guide|productList|partner|powertools/i.test(h)) {
        console.log("  link:", h);
        if (/\.json/.test(h)) FILES.add(new URL(h, url).href);
      }
    }
  } catch (e) {
    console.log(`\n--- ${url} → error ${e.message}`);
  }
}

console.log("\n=== FILES ===");
const data = {};
for (const url of FILES) {
  try {
    const res = await fetch(url, { headers: UA });
    const body = await res.text();
    console.log(`\n--- ${url} → ${res.status} (${(body.length / 1e6).toFixed(1)} MB) last-modified: ${res.headers.get("last-modified")}`);
    if (!res.ok) {
      console.log(body.slice(0, 300));
      continue;
    }
    const json = JSON.parse(body);
    const top = Array.isArray(json) ? { array: json } : json;
    for (const [k, v] of Object.entries(top)) {
      if (Array.isArray(v)) {
        const keys = new Set(v.flatMap((x) => Object.keys(x ?? {})));
        console.log(`  ${k}: ${v.length} rows, fields: ${[...keys].join(", ")}`);
        console.log("  sample:", JSON.stringify(v.slice(0, 2)));
        data[url] = v;
      } else console.log(`  ${k}:`, JSON.stringify(v).slice(0, 200));
    }
  } catch (e) {
    console.log(`\n--- ${url} → error ${e.message}`);
  }
}

// What the price guide would add to ours: cards we show as "—" that it prices, and how far its trend is from ours.
const guide = Object.entries(data).find(([u]) => u.includes("priceGuide"))?.[1];
if (guide) {
  const byId = new Map(guide.map((g) => [g.idProduct, g]));
  console.log("\n=== COMPARED WITH OUR SET FILES ===");
  for (const dir of ["public/sets", "public/sets/ja"]) {
    let cards = 0, withId = 0, inGuide = 0, oursNone = 0, gained = 0, same = 0, diff = [];
    let noIdNoPrice = 0;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".json") && x !== "index.json")) {
      const set = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
      for (const c of set.cards ?? []) {
        cards++;
        const p = c.price ?? {};
        const ours = p.trend ?? p.trendHolo;
        if (!p.cmId) {
          if (ours == null) noIdNoPrice++;
          continue;
        }
        withId++;
        const g = byId.get(p.cmId);
        if (!g) continue;
        inGuide++;
        const theirs = g.trend ?? g["trend-holo"] ?? g.trendFoil;
        if (ours == null) {
          oursNone++;
          if (theirs != null) gained++;
        } else if (theirs != null) {
          if (Math.abs(theirs - ours) < 0.005) same++;
          else diff.push(Math.abs(theirs - ours) / Math.max(ours, 0.01));
        }
      }
    }
    diff.sort((a, b) => a - b);
    console.log(
      `${dir}: ${cards} cards, ${withId} with a Cardmarket id, ${inGuide} found in the guide; ` +
        `${oursNone} we show as "—" (${gained} the guide prices); trend identical ${same}, different ${diff.length} ` +
        `(median gap ${((diff[diff.length >> 1] ?? 0) * 100).toFixed(1)} %); no id and no price: ${noIdNoPrice}`,
    );
  }
}
