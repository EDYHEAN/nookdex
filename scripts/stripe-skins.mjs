// Makes the shop's items and bundles in Stripe (src/data/skins.json): one product each, eligible for Managed Payments (a
// digital good's tax code), and its price in euros, taxes included, found by the site by its lookup key skin_<id>
// (app/api/shop/checkout). Run again after a price change: a new price takes the lookup key, the old one is archived.
// Test mode with the test key, live mode with the live one:
//   node scripts/stripe-skins.mjs            (STRIPE_SECRET_KEY from the env, else .env.local)
import fs from "node:fs";

const env = fs.existsSync(".env.local") ? Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])) : {};
const KEY = process.env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY;
if (!KEY) throw new Error("STRIPE_SECRET_KEY missing (env or .env.local)");
// sk_live_… or a restricted rk_live_…
const MODE = /^[sr]k_live_/.test(KEY) ? "LIVE" : "test";
/** "General - Electronically Supplied Services": eligible for Managed Payments (docs.stripe.com/payments/managed-payments/eligibility) */
const TAX_CODE = "txcd_10000000";

async function stripe(path, params, method = params ? "POST" : "GET") {
  const body = params ? new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])) : undefined;
  const r = await fetch(`https://api.stripe.com/v1${path}${method === "GET" && body ? `?${body}` : ""}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Stripe-Version": "2025-03-31.basil", ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: method === "POST" ? body : undefined,
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`${path}: ${json.error?.message ?? r.status}`);
  return json;
}

const { items, bundles } = JSON.parse(fs.readFileSync("src/data/skins.json", "utf8"));
// one product per item sold on its own, one per bundle
for (const s of [...items, ...bundles]) {
  const lookup = `skin_${s.id}`;
  const cents = Math.round(s.price * 100);
  const name = `NookDex · ${s.name.fr}`;
  const products = await stripe("/products/search", { query: `metadata['skin']:'${s.id}'` }, "GET");
  let product = products.data[0];
  const fields = { name, description: s.blurb.fr, tax_code: TAX_CODE, "metadata[skin]": s.id };
  product = product ? await stripe(`/products/${product.id}`, fields) : await stripe("/products", fields);
  const prices = await stripe("/prices", { "lookup_keys[]": lookup, active: true }, "GET");
  const current = prices.data[0];
  if (current && current.unit_amount === cents && current.currency === "eur" && current.product === product.id) {
    console.log(`${MODE} ${s.id}: ${product.id}, ${current.id} (${s.price} €, unchanged)`);
    continue;
  }
  const price = await stripe("/prices", {
    product: product.id,
    currency: "eur",
    unit_amount: cents,
    // the price shown is the price paid: taxes included (Managed Payments takes them out of it)
    tax_behavior: "inclusive",
    lookup_key: lookup,
    transfer_lookup_key: true,
  });
  if (current) await stripe(`/prices/${current.id}`, { active: false });
  console.log(`${MODE} ${s.id}: ${product.id}, ${price.id} (${s.price} €)`);
}
