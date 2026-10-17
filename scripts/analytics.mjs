// The week's numbers, for the Monday report (Johan, 2026-10-17): the funnel by first source (lib/funnel.ts), the
// accounts and who comes back (Supabase, counts only: funnel_stats, growth_stats, activity_stats in docs/supabase.sql),
// and Google Search Console (clicks and impressions by day, top queries and pages, this week against the one before).
// Writes docs/reports/data/<YYYY-MM-DD>.json; the weekly routine reads it and writes docs/reports/<YYYY-MM-DD>.md.
// Run by .github/workflows/analytics.yml (GSC_SERVICE_ACCOUNT: the service account's JSON key, read-only on the site).
// Run: node scripts/analytics.mjs
import crypto from "node:crypto";
import fs from "node:fs";

const SUPABASE_URL = "https://xwqhucccldraieyiycvt.supabase.co";
const SUPABASE_KEY = "sb_publishable_Fn4KmAAhKl7crl-R_ZCHWw_OkFukB2i";
const SITE = "sc-domain:nookdex.com";

const day = (d) => d.toISOString().slice(0, 10);
const ago = (n) => new Date(Date.now() - n * 864e5);
const today = day(new Date());

async function rpc(name, args = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) return { error: `${r.status} ${await r.text()}` };
  return r.json();
}

/** an access token for the service account (a signed JWT, no library) */
async function googleToken(key) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "RS256", typ: "JWT" });
  const claims = b64({ iss: key.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: key.token_uri, iat: now, exp: now + 3600 });
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${claims}`).sign(key.private_key).toString("base64url");
  const r = await fetch(key.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${sig}` }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`Google token: ${JSON.stringify(j)}`);
  return j.access_token;
}

async function gsc(token, startDate, endDate, dimensions, rowLimit = 25) {
  const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate, endDate, dimensions, rowLimit }),
  });
  const j = await r.json();
  return (j.rows ?? []).map((x) => ({ key: x.keys.join(" | "), clicks: x.clicks, impressions: x.impressions, position: Math.round(x.position * 10) / 10 }));
}

async function search() {
  const raw = process.env.GSC_SERVICE_ACCOUNT;
  if (!raw) return { error: "no GSC_SERVICE_ACCOUNT secret" };
  const token = await googleToken(JSON.parse(raw));
  // Search Console lags 2-3 days: the last full week is the 7 days ending 3 days ago
  const week = { start: day(ago(9)), end: day(ago(3)) };
  const before = { start: day(ago(16)), end: day(ago(10)) };
  return {
    week,
    before,
    byDay: await gsc(token, before.start, week.end, ["date"], 100),
    queries: await gsc(token, week.start, week.end, ["query"]),
    queriesBefore: await gsc(token, before.start, before.end, ["query"]),
    pages: await gsc(token, week.start, week.end, ["page"]),
  };
}

const report = {
  date: today,
  funnel: { week: await rpc("funnel_stats", { p_since: day(ago(7)) }), all: await rpc("funnel_stats", {}) },
  accounts: { byDay: await rpc("growth_stats", { p_days: 60 }), totals: await rpc("activity_stats") },
  search: await search().catch((e) => ({ error: String(e) })),
};

fs.mkdirSync("docs/reports/data", { recursive: true });
fs.writeFileSync(`docs/reports/data/${today}.json`, JSON.stringify(report, null, 2) + "\n");
console.log(`docs/reports/data/${today}.json`);
