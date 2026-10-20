// The money block of the weekly report e-mail (Johan, 2026-10-20): the shop's sales (the skins, Stripe account "NookDex")
// and the tips (Buy Me a Coffee pays them into a Stripe account of their own), this week and since the start.
// Read from Stripe when the mail is sent (scripts/report-mail.mjs) and never written in the repo: it's public.
// Keys (GitHub secrets, restricted keys, read only: "Balance" and "Checkout Sessions"): STRIPE_SHOP_KEY, STRIPE_TIPS_KEY.
// Run: node scripts/report-money.mjs (prints the block)
import fs from "node:fs";

const skins = JSON.parse(fs.readFileSync(new URL("../src/data/skins.json", import.meta.url), "utf8"));
const NAMES = new Map([...skins.items, ...skins.bundles].map((s) => [s.id, s.name.fr]));

async function stripeList(key, path, params) {
  const out = [];
  let after;
  for (;;) {
    const q = new URLSearchParams({ limit: "100", ...params, ...(after ? { starting_after: after } : {}) });
    const r = await fetch(`https://api.stripe.com/v1/${path}?${q}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`Stripe ${path} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    out.push(...j.data);
    if (!j.has_more) return out;
    after = j.data.at(-1).id;
  }
}

/** sales, refunds and what's left once Stripe took its fees, per currency */
function sum(txns) {
  const by = {};
  for (const t of txns) {
    const c = (by[t.currency] ??= { sales: 0, gross: 0, refunds: 0, net: 0 });
    if (t.type === "charge" || t.type === "payment") (c.sales++, (c.gross += t.amount));
    else if (t.type === "refund" || t.type === "payment_refund") c.refunds++;
    else continue;
    c.net += t.net;
  }
  return by;
}

const money = (cents, currency) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: currency.toUpperCase() });

/** "3 ventes · 8,97 €, 7,92 € net · 1 remboursement" (net: less Stripe's fees and the refunds), or "rien" */
function line(by, one, many) {
  const parts = Object.entries(by)
    .filter(([, c]) => c.sales || c.refunds)
    .map(([cur, c]) =>
      [
        `${c.sales} ${c.sales > 1 ? many : one}`,
        c.sales ? `${money(c.gross, cur)}, ${money(c.net, cur)} net` : `${money(c.net, cur)} net`,
        c.refunds ? `${c.refunds} remboursement${c.refunds > 1 ? "s" : ""}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    );
  return parts.length ? parts.join("<br>") : "rien";
}

async function account(key, one, many, since) {
  if (!key) return { week: "pas branché (secret GitHub à ajouter)", all: "" };
  const all = await stripeList(key, "balance_transactions", {});
  return {
    week: line(sum(all.filter((t) => t.created >= since)), one, many),
    all: line(sum(all), one, many),
  };
}

async function shopItems(key, since) {
  if (!key) return "";
  const sessions = await stripeList(key, "checkout/sessions", { status: "complete", "created[gte]": String(since) });
  const count = {};
  for (const s of sessions) if (s.payment_status === "paid" && s.metadata?.skin) count[s.metadata.skin] = (count[s.metadata.skin] ?? 0) + 1;
  return Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${NAMES.get(id) ?? id} ×${n}`)
    .join(", ");
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** the block, as a row of the template's table */
export async function moneyBlock() {
  const since = Math.floor(Date.now() / 1000) - 7 * 86400;
  const safe = (p) => p.catch((e) => ({ week: `erreur : ${esc(String(e.message ?? e))}`, all: "" }));
  const [shop, tips, items] = await Promise.all([
    safe(account(process.env.STRIPE_SHOP_KEY, "vente", "ventes", since)),
    safe(account(process.env.STRIPE_TIPS_KEY, "don", "dons", since)),
    shopItems(process.env.STRIPE_SHOP_KEY, since).catch(() => ""),
  ]);
  const row = (title, x, extra) => `
      <tr style="background:#fdeccd;"><td style="padding:8px 10px;font-size:14px;line-height:1.5;">
        <b>${title}</b><br>Cette semaine : ${x.week}${extra ? `<br><span style="color:#6b5560;">${esc(extra)}</span>` : ""}${x.all ? `<br><span style="color:#8a7a82;">Depuis le début : ${x.all}</span>` : ""}
      </td></tr>`;
  return `
  <!-- money (scripts/report-money.mjs, from Stripe when sent) -->
  <tr><td style="padding:12px 26px;">
    <div style="font-size:16px;font-weight:bold;margin:8px 0;">💶 Boutique et dons</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="4" style="border-collapse:separate;">${row("🛍️ Boutique (skins)", shop, items)}${row("☕ Dons (Buy Me a Coffee)", tips)}
    </table>
  </td></tr>
`;
}

/** the report with the block put in, before the actions (or the footer) */
export function withMoney(html, block) {
  for (const mark of ["<!-- actions -->", "<!-- footer -->"]) {
    const i = html.indexOf(mark);
    if (i >= 0) return html.slice(0, i) + block.trimStart() + "\n  " + html.slice(i);
  }
  return html;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(await moneyBlock());
