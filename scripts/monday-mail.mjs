// The Monday mail (sprint 2, 2026-10-24): « ta collec cette semaine », to the players who said yes (Supabase mail_optin).
// For each one, from their online save and the price history (public/history): what their cards were worth 7 days ago and
// today, the cards that moved most, the wanted ones (★, wishlists) that got cheaper, the next release. Sent through Brevo
// from contact@nookdex.com, a one-click unsubscribe link in it (and in the List-Unsubscribe header). Nothing moved: no mail.
//
//   node scripts/monday-mail.mjs --test you@x.com     that account's mail only, to that address, whether it said yes or not
//   node scripts/monday-mail.mjs --live               everyone who said yes (the Action, Mondays, once MONDAY_MAIL_LIVE is on)
//   node scripts/monday-mail.mjs --save save.json --lang fr --out mail.html     preview from an exported save, nothing sent
//   node --env-file=.env.local scripts/monday-mail.mjs --test you@x.com          on a computer: without BREVO_API_KEY, written
//                                                                                to .cache/monday-mail/test.html, not sent
//
// Env: SUPABASE_SERVICE_ROLE_KEY (reads the recipients: mail_recipients(), service role only), BREVO_API_KEY.
// The values come from the history, which has the binder sets' cards (the extra sets aren't in it) and one price per card
// (its trend): « ≈ », the room's own value can differ by the variants' prices.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SUPABASE_URL = "https://xwqhucccldraieyiycvt.supabase.co";
const SITE = "https://nookdex.com";
const FROM = { name: "NookDex", email: "contact@nookdex.com" };
/** a week's change under this (player's money) and nothing else to say: no mail */
const MIN_DELTA = 0.5;
/** a card's price 7 days ago under this: its % means nothing */
const MIN_THEN = 0.5;
const DAY = 86_400_000;

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? true) : null;
};
const testTo = opt("--test");
const live = args.includes("--live");
const preview = opt("--save");
if (!testTo && !live && !preview) throw new Error("--test <e-mail>, --live or --save <file>");

// ---- the data the mails are made of: catalogs, history, set files, rate, releases

const LANGS = ["fr", "en", "ja"];
const PREFIX = /^(en|ja):/;
const langOfKey = (key) => PREFIX.exec(key)?.[1] ?? "fr";
const bareId = (key) => key.replace(PREFIX, "");
const json = (file) => JSON.parse(readFileSync(file, "utf8"));
const catalogs = Object.fromEntries(LANGS.map((l) => [l, json(l === "fr" ? "src/data/catalog.json" : `src/data/catalog-${l}.json`)]));
/** lang -> set or sub-set id -> the set whose files hold it (lib/catalog setIdOfCard) */
const owner = Object.fromEntries(LANGS.map((l) => [l, new Map(catalogs[l].flatMap((s) => [s.id, ...(s.subs ?? [])].map((id) => [id, s])))]));
const rate = json("src/data/eur-usd.json").rate;
const releases = json("src/data/releases.json").items;

const files = new Map();
const cached = (file) => {
  if (!files.has(file)) files.set(file, existsSync(file) ? json(file) : null);
  return files.get(file);
};
/** a card key -> { name, num, img, set, now, then } from its set's history (null: not there, e.g. an extra set) */
function cardOf(key) {
  const lang = langOfKey(key);
  const id = bareId(key);
  const set = owner[lang].get(id.slice(0, id.lastIndexOf("-")));
  if (!set) return null;
  const h = cached(`public/history/${lang}/${set.id}.json`);
  const s = cached(lang === "fr" ? `public/sets/${set.id}.json` : `public/sets/${lang}/${set.id}.json`);
  const row = h?.cards[id];
  if (!row) return null;
  const card = s?.cards.find((c) => c.id === id);
  const last = h.days.length - 1;
  // the column 7 days before the last one (the nearest day on or before it)
  const want = Date.parse(`${h.days[last]}T12:00:00Z`) - 7 * DAY;
  let from = -1;
  for (let i = last; i >= 0; i--) if (Date.parse(`${h.days[i]}T12:00:00Z`) <= want) {
    from = i;
    break;
  }
  return {
    key,
    lang,
    name: card?.name ?? id,
    num: card?.num ?? "",
    img: card?.img || null,
    setName: set.name,
    currency: lang === "en" ? "USD" : "EUR",
    now: row[last] ?? null,
    then: from >= 0 ? (row[from] ?? null) : null,
  };
}
const convert = (n, from, to) => (from === to ? n : from === "EUR" ? n * rate : n / rate);

/** The next set out within 14 days (the room's courrier says the same) */
function nextRelease(lang) {
  const today = new Date().toISOString().slice(0, 10);
  const next = releases.filter((r) => r.kind === "set" && r.region === "intl" && r.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!next) return null;
  const days = Math.round((Date.parse(`${next.date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY);
  return days <= 14 ? { name: lang === "en" ? next.en : next.fr, days } : null;
}

/** A player's week from their save, in their money: null when nothing worth a mail moved */
function weekOf(save, lang, force) {
  const cur = save.currency === "USD" || save.currency === "EUR" ? save.currency : lang === "en" ? "USD" : "EUR";
  let now = 0;
  let delta = 0;
  let then = 0;
  const movers = [];
  for (const [key, copies] of Object.entries(save.collection ?? {})) {
    const qty = (copies ?? []).reduce((n, c) => n + (c.qty ?? 1), 0);
    const c = qty && cardOf(key);
    if (!c || c.now == null) continue;
    now += convert(c.now * qty, c.currency, cur);
    if (c.then == null) continue;
    const d = convert((c.now - c.then) * qty, c.currency, cur);
    delta += d;
    then += convert(c.then * qty, c.currency, cur);
    if (c.then >= MIN_THEN) movers.push({ ...c, pct: ((c.now - c.then) / c.then) * 100, delta: convert(c.now - c.then, c.currency, cur) });
  }
  // the 3 that moved most, in money (a 40 € card +10 % says more than a 0,60 € one +80 %)
  const top = movers.filter((m) => Math.abs(m.pct) >= 5 && Math.abs(m.delta) >= 0.2).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
  // wanted: ★ and the wishlists' cards, not owned
  const wanted = new Set(Object.keys(save.stars ?? {}));
  for (const b of save.binders ?? []) if (b.kind === "free" && b.wish) for (const k of Object.values(b.wants ?? {})) wanted.add(k);
  const cheaper = [...wanted]
    .filter((k) => !(save.collection ?? {})[k]?.length)
    .map(cardOf)
    .filter((c) => c && c.now != null && c.then != null && c.then >= MIN_THEN && (c.now - c.then) / c.then <= -0.05)
    .map((c) => ({ ...c, pct: ((c.now - c.then) / c.then) * 100 }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3);
  if (!force && Math.abs(delta) < MIN_DELTA && !top.length && !cheaper.length) return null;
  return { cur, now, delta, pct: then ? (delta / then) * 100 : 0, top, cheaper, release: nextRelease(lang) };
}

// ---- the mail

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n, cur, lang) =>
  cur === "USD"
    ? `$${Math.abs(n).toFixed(2)}`
    : `${Math.abs(n).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${lang === "fr" ? " " : " "}€`;
const signed = (n) => (n > 0.004 ? "+" : n < -0.004 ? "−" : "");
const pctText = (p, lang) => `${signed(p)}${Math.abs(p).toLocaleString(lang === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: Math.abs(p) < 10 ? 1 : 0 })}${lang === "fr" ? " " : ""}%`;
// e-mail clients and webp: Outlook shows none; TCGdex has a png of each scan, ours (/scans) too
const scan = (img) => (img ? `${img}/low.png` : null);

function cardCell(c, lang, sub) {
  const up = c.pct >= 0;
  const pic = scan(c.img);
  return `<td width="33%" valign="top" style="padding:6px;text-align:center">
    ${pic ? `<img src="${esc(pic)}" width="120" alt="${esc(c.name)}" style="display:block;margin:0 auto 6px;width:120px;max-width:100%;border-radius:6px">` : ""}
    <div style="font:bold 16px Courier New,monospace;color:${up ? "#3d8b2f" : "#b8433d"}">${up ? "↗" : "↘"} ${pctText(c.pct, lang)}</div>
    <div style="font:14px Arial,sans-serif;color:#2b2230">${esc(c.name)}</div>
    <div style="font:12px Arial,sans-serif;color:#6f6068">${esc(sub)}</div>
  </td>`;
}

function mailOf(week, { lang, name, token }) {
  const fr = lang === "fr";
  const t = (f, e) => (fr ? f : e);
  const desk = `${SITE}${fr ? "/" : "/en"}?utm_source=monday-mail`;
  const unsub = token ? `${SITE}/api/unsubscribe?t=${token}` : null;
  const up = week.delta >= 0;
  const subject = Math.abs(week.delta) >= MIN_DELTA
    ? t(`Ta collec cette semaine : ${signed(week.delta)}${money(week.delta, week.cur, lang)}`, `Your collection this week: ${signed(week.delta)}${money(week.delta, week.cur, lang)}`)
    : t("Ta collec cette semaine", "Your collection this week");
  const row = (cards, sub) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cards.map((c) => cardCell(c, lang, sub(c))).join("")}</tr></table>`;
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#2b2230">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#2b2230"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#f4ecdc;border-radius:12px;border:4px solid #1a141e">
<tr><td style="padding:22px 22px 6px">
  <div style="font:bold 13px Courier New,monospace;letter-spacing:1px;color:#a8701a">✉ ${t("LE COURRIER DU LUNDI", "THE MONDAY MAIL")}</div>
  <h1 style="margin:8px 0 4px;font:bold 22px Courier New,monospace;color:#b8433d">${t(`Ta collec cette semaine${name ? `, ${esc(name)}` : ""}`, `Your collection this week${name ? `, ${esc(name)}` : ""}`)}</h1>
</td></tr>
<tr><td style="padding:10px 22px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${up ? "#e2f4d6" : "#fbe1dc"};border-radius:8px"><tr><td style="padding:16px;text-align:center">
    <div style="font:bold 30px Courier New,monospace;color:${up ? "#3d8b2f" : "#b8433d"}">${signed(week.delta)}${money(week.delta, week.cur, lang)}</div>
    <div style="font:14px Arial,sans-serif;color:#2b2230">${t("en 7 jours", "in 7 days")} · ${pctText(week.pct, lang)} · ${t("ta collec vaut", "it's worth")} ≈ ${money(week.now, week.cur, lang)}</div>
  </td></tr></table>
</td></tr>
${week.top.length ? `<tr><td style="padding:14px 16px 0"><div style="padding:0 6px;font:bold 15px Courier New,monospace;color:#2b2230">${t("Tes cartes qui ont bougé", "Your cards that moved")}</div>${row(week.top, (c) => `${signed(c.delta)}${money(c.delta, week.cur, lang)} · ${c.setName}`)}</td></tr>` : ""}
${week.cheaper.length ? `<tr><td style="padding:14px 16px 0"><div style="padding:0 6px;font:bold 15px Courier New,monospace;color:#2b2230">${t("Ce que tu cherches a baissé", "What you're after got cheaper")}</div>${row(week.cheaper, (c) => `${money(c.now, c.currency, lang)} · ${c.setName}`)}</td></tr>` : ""}
${week.release ? `<tr><td style="padding:14px 22px 0"><div style="background:#fff3b0;border-radius:8px;padding:10px 14px;font:14px Arial,sans-serif;color:#2b2230"><b style="font-family:Courier New,monospace">J-${week.release.days}</b> · ${esc(week.release.name)} ${t("sort bientôt", "is coming")}</div></td></tr>` : ""}
<tr><td align="center" style="padding:22px">
  <a href="${desk}" style="display:inline-block;background:#ffd35a;color:#2b2230;border:3px solid #2b2230;border-radius:8px;padding:12px 22px;font:bold 15px Courier New,monospace;text-decoration:none">${t("Ouvrir mon bureau ▶", "Open my desk ▶")}</a>
</td></tr>
<tr><td style="padding:0 22px 20px;font:12px Arial,sans-serif;color:#6f6068;line-height:1.5">
  ${t("Valeurs ≈ d'après la tendance Cardmarket (cartes FR et JAP) et TCGplayer (EN) de tes classeurs d'extension, il y a 7 jours et aujourd'hui.", "Values ≈ from the TCGplayer (EN cards) and Cardmarket (FR, JP) trend of your set binders' cards, 7 days ago and today.")}
  ${unsub ? `<br>${t("Tu reçois ce mail parce que tu l'as demandé sur NookDex.", "You get this mail because you asked for it on NookDex.")} <a href="${unsub}" style="color:#6f6068">${t("Ne plus le recevoir", "Unsubscribe")}</a>` : `<br>${t("(Envoi de test : pas de lien de désinscription.)", "(Test send: no unsubscribe link.)")}`}
</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, unsub };
}

// ---- sending

async function recipients(email) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mail_recipients`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_email: email ?? null }),
  });
  if (!r.ok) throw new Error(`mail_recipients ${r.status}: ${await r.text()}`);
  return r.json();
}
async function markSent(user) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/mail_sent`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_user: user }),
  });
}
async function send(to, mail, test) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY ?? "", "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: FROM,
      to: [{ email: to }],
      subject: test ? `[TEST] ${mail.subject}` : mail.subject,
      htmlContent: mail.html,
      ...(mail.unsub && { headers: { "List-Unsubscribe": `<${mail.unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
      tags: ["monday-mail"],
    }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${await r.text()}`);
}

if (preview) {
  const save = json(preview);
  const lang = opt("--lang") === "en" ? "en" : "fr";
  const week = weekOf(save, lang, true);
  const mail = mailOf(week, { lang, name: save.profile?.name, token: "00000000-0000-0000-0000-000000000000" });
  const out = opt("--out") || ".cache/monday-mail/preview.html";
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, mail.html);
  console.log(`${mail.subject} -> ${out} (≈ ${week.now.toFixed(2)} ${week.cur}, ${week.top.length} movers, ${week.cheaper.length} cheaper)`);
} else {
  const rows = await recipients(testTo || null);
  if (testTo && !rows.length) throw new Error(`no account with a save for ${testTo}`);
  let sent = 0;
  let skipped = 0;
  for (const r of rows) {
    const lang = r.lang === "en" ? "en" : "fr";
    const week = weekOf(r.data ?? {}, lang, !!testTo);
    if (!week) {
      skipped++;
      continue;
    }
    const mail = mailOf(week, { lang, name: r.data?.profile?.name, token: testTo ? null : r.token });
    // a test on a computer without the Brevo key (it lives in Vercel and GitHub): the mail as a file to look at
    if (testTo && !process.env.BREVO_API_KEY) {
      const out = ".cache/monday-mail/test.html";
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, mail.html);
      console.log(`no BREVO_API_KEY: ${mail.subject} -> ${out}`);
      sent++;
      continue;
    }
    await send(testTo || r.email, mail, !!testTo);
    if (!testTo) await markSent(r.user_id);
    sent++;
    // Brevo's transactional API takes far more, but a weekly batch has no hurry
    await new Promise((res) => setTimeout(res, 150));
  }
  console.log(`monday mail (${testTo ? `test to ${testTo}` : "live"}): ${sent} sent, ${skipped} with nothing to say`);
}
