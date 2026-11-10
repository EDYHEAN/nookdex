// The release alert's mails (lib/releaseAlert: who asked for them, on the Amazon pages and the calendar). Run daily by the
// Action « Alerte sorties » (.github/workflows/release-alert.yml); each mail goes once per set, kind and language, as a
// Brevo campaign named alerte-<set>-<kind>-<lang> (a campaign of that name already there: skipped, so a re-run sends
// nothing twice).
//   - « preorder »: a coming set (src/data/releases.json, worldwide) whose Amazon products have an ASIN (the release watch
//     adds them as the pages open), its first day of pre-orders;
//   - « out »: the set's release day.
// Amazon's rules forbid its affiliate links in e-mails: the mail links to our pages (/invitations-amazon, the set's page),
// which carry them. The unsubscribe link is Brevo's ({{ unsubscribe }}).
//
//   node scripts/release-alert.mjs                       today's mails (the Action)
//   node scripts/release-alert.mjs --set me07 --kind out --dry    write .cache/release-alert/<name>.html, nothing sent
//   node scripts/release-alert.mjs --set me07 --kind out --test you@x.com     that mail to that address only (transactional)
//
// Env: BREVO_API_KEY. A language whose list doesn't exist yet (nobody signed up): nothing sent.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SITE = "https://nookdex.com";
const API = "https://api.brevo.com/v3";
const FROM = { name: "NookDex", email: "contact@nookdex.com" };
const LISTS = { fr: "NookDex · Alerte sorties FR", en: "NookDex · Release alert EN" };
const UTM = "utm_source=alerte&utm_medium=email";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? true) : null;
};
const onlySet = opt("--set");
const onlyKind = opt("--kind");
const testTo = opt("--test");
const dry = args.includes("--dry");

const json = (file) => JSON.parse(readFileSync(file, "utf8"));
const releases = json("src/data/releases.json").items;
const shops = { fr: json("src/data/amazon-products.json").groups, en: json("src/data/amazon-products-us.json").groups };
const pics = json("src/data/amazon-pics.json");
const catalogs = { fr: json("src/data/catalog.json"), en: json("src/data/catalog-en.json") };
const today = new Date().toISOString().slice(0, 10);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const short = (name) =>
  name
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/^[^:]*:\s/, "")
    .replace(/^(Méga-Évolution|Mega Evolution)(\s*[—–-]\s*|\s+)/, "");
const ORDER = ["etb", "display", "bundle", "box", "collection", "pokebox", "tripack", "tin", "blister"];
const KIND = {
  fr: { etb: "Coffret Dresseur d'élite", display: "Display", bundle: "Bundle", tripack: "Tripack", box: "Coffret", collection: "Collection", blister: "Blister", pokebox: "Pokébox", tin: "Mini Tin" },
  en: { etb: "Elite Trainer Box", display: "Booster Box", bundle: "Booster Bundle", tripack: "3-Pack Blister", box: "Box", collection: "Collection", blister: "Blister", pokebox: "Tin", tin: "Mini Tin" },
};

async function brevo(path, init = {}) {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("BREVO_API_KEY missing");
  const r = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!r.ok) throw new Error(`Brevo ${init.method ?? "GET"} ${path}: ${r.status} ${await r.text().catch(() => "")}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}

/** the mails due today: [{ release, kind }] */
function due() {
  const sets = releases.filter((r) => r.region === "intl" && r.kind === "set" && r.setId && (!onlySet || r.setId === onlySet));
  if (onlySet) return sets.map((release) => ({ release, kind: onlyKind === "preorder" ? "preorder" : "out" }));
  const out = [];
  for (const release of sets) {
    if (release.date === today) out.push({ release, kind: "out" });
    // pre-orders: a coming set with a listed product (the campaign's name keeps it to once)
    const listed = shops.fr.concat(shops.en).some((g) => g.setId === release.setId && g.products.some((p) => p.asin));
    if (release.date > today && listed) out.push({ release, kind: "preorder" });
  }
  return out;
}

/** the mail of a set, a kind, a language: { subject, html } */
function mailOf(release, kind, lang) {
  const fr = lang === "fr";
  const t = (f, e) => (fr ? f : e);
  const out = kind === "out";
  const name = short(fr ? release.fr : release.en);
  const group = shops[lang].find((g) => g.setId === release.setId);
  const products = group ? [...group.products].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)).slice(0, 4) : [];
  const utm = `${UTM}&utm_campaign=${encodeURIComponent(`${release.setId}-${kind}`)}`;
  const shopUrl = `${SITE}${fr ? "/invitations-amazon" : "/en/amazon-invites"}?${utm}${group ? `#${group.id}` : ""}`;
  const set = catalogs[lang].find((s) => s.id === release.setId);
  // the PNG original, not the -sm.webp: classic Outlook on Windows shows no WebP, and the logo is the mail's title
  const logo = set?.logo?.startsWith("/") ? `${SITE}${set.logo}.png` : null;
  const day = new Date(`${release.date}T12:00:00Z`).toLocaleDateString(fr ? "fr-FR" : "en-US", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const kinds = products.slice(0, 3).map((p) => KIND[lang][p.kind]).filter((k, i, all) => all.indexOf(k) === i).join(", ");
  const subject = out
    ? t(`${name} sort aujourd'hui : demande ton invitation`, `${name} is out today: where to get the boxes`)
    : t(`${name} : les précommandes sont ouvertes`, `${name}: pre-orders are open`);
  // the inbox's second line (Gmail, Apple Mail): what the subject doesn't say
  const preheader = out
    ? t(
        `${kinds || "Les coffrets"} : sur Amazon, ils partent sur invitation. Demande-la tôt.`,
        `${kinds || "Every box"}: the Amazon listings for today's release, in one place.`,
      )
    : t(`Sortie le ${day}. ${kinds ? `${kinds} : les` : "Les"} fiches Amazon sont en ligne.`, `Out ${day}. ${kinds ? `${kinds}: the` : "The"} first Amazon listings are up.`);
  const kicker = out ? t("Sortie aujourd'hui", "Out today") : t(`Sortie le ${day}`, `Out ${day}`);
  const title = out ? t("Demande ton invitation", "The boxes to grab today") : t("Les précommandes sont ouvertes", "Pre-orders are open");
  const lead = out
    ? t(
        `Sur Amazon, les coffrets de ${name} partent sur invitation. C'est gratuit et sans engagement : le plus tôt est le mieux.`,
        `Every Amazon listing for ${name}, in one place. Some sell by invitation (it's free): ask early.`,
      )
    : t(
        `Les premières fiches Amazon de ${name} sont en ligne : précommande, ou demande ton invitation dès maintenant.`,
        `The first Amazon listings for ${name} are up: pre-order before release day.`,
      );
  const go = out ? t("Voir les invitations", "See the boxes") : t("Voir les précommandes", "See the pre-orders");
  const arrow = "&#9654;&#65038;"; // ▶ kept as text: iOS draws a bare ▶ as an emoji
  const font = "font-family:Arial,Helvetica,sans-serif";
  /** a button Outlook draws too: colour and border on the cell, padding for Word in mso-padding-alt */
  const button = (href, label, bg, size) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto"><tr><td align="center" bgcolor="${bg}" style="background:${bg};border:3px solid #2b2230;border-radius:10px;mso-padding-alt:12px 22px"><a href="${esc(href)}" style="display:inline-block;padding:12px 22px;${font};font-size:${size}px;font-weight:bold;color:#2b2230;text-decoration:none">${label}&nbsp;${arrow}</a></td></tr></table>`;

  // a French box without its picture: the English set's same box (lib/amazonShop twinPic)
  const twin = (p) => shops.en.find((g) => g.setId === release.setId)?.products.find((x) => x.kind === p.kind && x.pic && pics[x.pic])?.pic;
  /** a product: its picture fitted in one box (a tall booster and a wide box stand on the same shelf line), its name */
  const cell = (p) => {
    const pic = (p.pic && pics[p.pic]) || (lang === "fr" && pics[twin(p)]);
    const scale = pic ? Math.min(120 / pic.w, 110 / pic.h) : 0;
    const img = pic
      ? `<img src="${SITE}${pic.src}" width="${Math.round(pic.w * scale)}" height="${Math.round(pic.h * scale)}" alt="${esc(p.name)}" style="display:block;margin:0 auto;border:0;${font};font-size:12px;color:#fffaf0">`
      : logo
        ? `<img src="${logo}" width="120" alt="${esc(p.name)}" style="display:block;margin:0 auto;border:0;width:120px;max-width:100%;height:auto;${font};font-size:12px;color:#fffaf0">`
        : "";
    // « Display » over « Display 36 boosters » says nothing: the kind only when the name doesn't
    const k = KIND[lang][p.kind];
    const tag = k && !p.name.toLowerCase().includes(k.toLowerCase()) ? `<span style="font-size:12px;font-weight:normal;color:#ffd35a">${esc(k)}</span><br>` : "";
    // the colour on the cell itself: the two cells of a row share one height, so the tiles line up whatever the names
    return `<td width="48%" valign="top" bgcolor="#231a33" style="background:#231a33;border-radius:12px;padding:14px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td height="110" align="center" valign="bottom" style="height:110px"><a href="${esc(shopUrl)}" style="text-decoration:none">${img}</a></td></tr>
<tr><td align="center" style="padding-top:10px;${font};font-size:14px;line-height:1.3;font-weight:bold"><a href="${esc(shopUrl)}" style="color:#fffaf0;text-decoration:none">${tag}${esc(p.name)}</a></td></tr>
</table></td>`;
  };
  const gap = (attrs) => `<td ${attrs} style="font-size:0;line-height:0">&nbsp;</td>`;
  const rows = [];
  for (let i = 0; i < products.length; i += 2) {
    if (i) rows.push(`<tr>${gap('colspan="3" height="12"')}</tr>`);
    rows.push(`<tr>${cell(products[i])}${gap('width="4%"')}${products[i + 1] ? cell(products[i + 1]) : '<td width="48%"></td>'}</tr>`);
  }
  const home = esc(`${SITE}${fr ? "/" : "/en"}?${utm}`);
  const binder = release.setId ? `${SITE}${fr ? "/" : "/en"}?classeur=${encodeURIComponent(fr ? release.setId : `en:${release.setId}`)}&${utm}` : null;

  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
<style>:root{color-scheme:light;supported-color-schemes:light}@media (max-width:480px){.px{padding-left:16px!important;padding-right:16px!important}.h1{font-size:22px!important}}</style>
</head>
<body style="margin:0;padding:0;background:#f3ead8">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f3ead8;opacity:0">${esc(preheader)}${"&#847;&zwnj;&nbsp;".repeat(80)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3ead8" style="background:#f3ead8"><tr><td align="center" style="padding:24px 10px">
<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fffaf0" style="max-width:560px;background:#fffaf0;border:3px solid #2b2230;border-radius:14px;${font};color:#2b2230">
<tr><td class="px" style="padding:18px 24px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle"><a href="${home}"><img src="${SITE}/email/warwick.png" width="40" height="40" alt="" style="display:block;border:0;border-radius:50%"></a></td>
<td valign="middle" style="padding-left:10px"><a href="${home}" style="text-decoration:none"><img src="${SITE}/email/logo.jpg" width="112" height="35" alt="NookDex" style="display:block;border:0;${font};font-size:18px;font-weight:bold;color:#2b2230"></a></td>
</tr></table></td></tr>
<tr><td class="px" style="padding:16px 24px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#231a33" style="background:#231a33;border-radius:12px"><tr><td align="center" style="padding:20px 16px 18px;${font}">
${
  logo
    ? `<img src="${logo}" width="220" alt="${esc(name)}" style="display:block;margin:0 auto;border:0;width:220px;max-width:100%;height:auto;font-size:26px;font-weight:bold;color:#ffd35a">`
    : `<div style="font-size:28px;line-height:1.2;font-weight:bold;color:#ffd35a">${esc(name)}</div>`
}
<div style="padding-top:14px"><span style="display:inline-block;background:#ffd35a;color:#2b2230;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">${esc(kicker)}</span></div>
</td></tr></table></td></tr>
<tr><td class="px h1" style="padding:20px 24px 0;font-size:24px;line-height:1.25;font-weight:bold">${esc(title)}</td></tr>
<tr><td class="px" style="padding:8px 24px 0;font-size:16px;line-height:1.5">${esc(lead)}</td></tr>
<tr><td class="px" align="center" style="padding:20px 24px 6px">${button(shopUrl, esc(go), "#ffd35a", 17)}</td></tr>
${rows.length ? `<tr><td class="px" style="padding:14px 24px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join("")}</table></td></tr>` : ""}
${
  binder && out
    ? `<tr><td class="px" style="padding:16px 24px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px dashed #c9b994;border-radius:12px"><tr><td align="center" style="padding:16px;font-size:15px;line-height:1.45">
<b>${t("Tes boosters ouverts ?", "Opened your packs?")}</b><br>${t(`Coche tes cartes de ${esc(name)} et suis leur cote.`, `Tick your ${esc(name)} cards and follow their value.`)}
<div style="padding-top:12px">${button(binder, t("Ouvrir mon classeur", "Open my binder"), "#fffaf0", 15)}</div></td></tr></table></td></tr>`
    : ""
}
<tr><td style="padding:0 0 24px;font-size:1px;line-height:1px">&nbsp;</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px"><tr><td align="center" style="padding:16px 16px 0;${font};font-size:12px;line-height:1.6;color:#6b5f6e">
${t(
  "Tu reçois ce mail car tu as demandé l'alerte sorties sur nookdex.com : un mail quand les précommandes ouvrent, un le jour de la sortie.",
  "You get this e-mail because you asked for the release alert on nookdex.com: one when pre-orders open, one on release day.",
)}<br>
<a href="{{ unsubscribe }}" style="color:#6b5f6e;text-decoration:underline">${t("Se désinscrire", "Unsubscribe")}</a> &middot; <a href="${home}" style="color:#6b5f6e;text-decoration:underline">nookdex.com</a>
</td></tr></table>
</td></tr></table></body></html>`;
  return { subject, html };
}

/** the language's list, if anyone is on it */
async function listOf(lang) {
  const all = await brevo("/contacts/lists?limit=50&sort=desc");
  return all?.lists?.find((l) => l.name === LISTS[lang]) ?? null;
}

/** the campaign of that name, if made already ({ id, status }) */
async function campaignNamed(name) {
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await brevo(`/emailCampaigns?limit=100&offset=${offset}&excludeHtmlContent=true`);
    const list = page?.campaigns ?? [];
    const found = list.find((c) => c.name === name);
    if (found) return found;
    if (list.length < 100) return null;
  }
  return null;
}

const jobs = due();
if (!jobs.length) console.log("nothing due today");
for (const { release, kind } of jobs) {
  for (const lang of ["fr", "en"]) {
    const name = `alerte-${release.setId}-${kind}-${lang}`;
    const { subject, html } = mailOf(release, kind, lang);
    if (dry) {
      mkdirSync(".cache/release-alert", { recursive: true });
      writeFileSync(`.cache/release-alert/${name}.html`, html);
      console.log("written", name, "·", subject);
      continue;
    }
    if (testTo) {
      await brevo("/smtp/email", { method: "POST", body: { sender: FROM, to: [{ email: testTo }], subject: `[test] ${subject}`, htmlContent: html.replace("{{ unsubscribe }}", SITE) } });
      console.log("test sent", name, "->", testTo);
      continue;
    }
    try {
      const made = await campaignNamed(name);
      if (made && made.status !== "draft") {
        console.log("already sent", name, made.status);
        continue;
      }
      const list = await listOf(lang);
      if (!list || !list.uniqueSubscribers) {
        console.log("nobody on", LISTS[lang], "·", name, "not sent");
        continue;
      }
      // a draft left by a send that failed half-way: sent now, not made twice
      const id =
        made?.id ??
        (await brevo("/emailCampaigns", { method: "POST", body: { name, subject, sender: FROM, htmlContent: html, recipients: { listIds: [list.id] }, tag: "release-alert" } })).id;
      await brevo(`/emailCampaigns/${id}/sendNow`, { method: "POST" });
      console.log("sent", name, "campaign", id, "to", list.uniqueSubscribers);
    } catch (e) {
      // one mail failing doesn't stop the others; the Action goes red at the end
      console.error("failed", name, e.message);
      process.exitCode = 1;
    }
  }
}
