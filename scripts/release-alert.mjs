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
    .replace(/^(Méga-Évolution|Mega Evolution)\s+/, "");
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
  const name = short(fr ? release.fr : release.en);
  const group = shops[lang].find((g) => g.setId === release.setId);
  const products = group ? [...group.products].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)).slice(0, 4) : [];
  const shopUrl = `${SITE}${fr ? "/invitations-amazon" : "/en/amazon-invites"}?${UTM}${group ? `#${group.id}` : ""}`;
  const set = catalogs[lang].find((s) => s.id === release.setId);
  const logo = set?.logo?.startsWith("/") ? `${SITE}${set.logo}-sm.webp` : null;
  const day = new Date(`${release.date}T12:00:00Z`).toLocaleDateString(fr ? "fr-FR" : "en-US", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const subject =
    kind === "out"
      ? t(`${name} sort aujourd'hui : demande ton invitation`, `${name} is out today: get your invite`)
      : t(`${name} : les précommandes sont ouvertes`, `${name}: pre-orders are open`);
  const lead =
    kind === "out"
      ? t(
          `${name} sort aujourd'hui. Sur Amazon, les coffrets partent sur invitation : demande-la tôt, c'est gratuit et sans engagement.`,
          `${name} is out today. Amazon sells the sought-after boxes by invitation: ask early, it's free.`,
        )
      : t(
          `${name} sort le ${day}. Les premières fiches Amazon sont en ligne : précommande, ou demande ton invitation dès maintenant.`,
          `${name} comes out on ${day}. The first Amazon listings are up: pre-order, or request your invite now.`,
        );
  const cell = (p) => {
    const pic = p.pic && pics[p.pic];
    const img = pic
      ? `<img src="${SITE}${pic.src}" width="120" alt="" style="display:block;margin:0 auto 8px;max-width:120px;height:auto">`
      : logo
        ? `<img src="${logo}" width="120" alt="" style="display:block;margin:0 auto 8px;max-width:120px;height:auto">`
        : "";
    return `<td width="50%" valign="top" style="padding:8px"><a href="${esc(shopUrl)}" style="display:block;padding:12px;background:#231a33;border-radius:12px;color:#fffaf0;text-decoration:none;text-align:center">${img}<span style="font-size:12px;color:#ffd35a">${esc(KIND[lang][p.kind])}</span><br><b style="font-size:14px">${esc(p.name)}</b></a></td>`;
  };
  const rows = [];
  for (let i = 0; i < products.length; i += 2) rows.push(`<tr>${cell(products[i])}${products[i + 1] ? cell(products[i + 1]) : '<td width="50%"></td>'}</tr>`);
  const setPage = release.setId ? `${SITE}${fr ? "/" : "/en"}?classeur=${encodeURIComponent(fr ? release.setId : `en:${release.setId}`)}&${UTM}` : null;
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#f3ead8;font-family:Arial,Helvetica,sans-serif;color:#2b2230">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffaf0;border:3px solid #2b2230;border-radius:14px">
<tr><td style="padding:24px 24px 0"><img src="${SITE}/email/warwick.png" width="48" height="48" alt="NookDex" style="border-radius:50%"></td></tr>
${logo ? `<tr><td align="center" style="padding:8px 24px 0"><img src="${logo}" width="240" alt="${esc(name)}" style="max-width:240px;height:auto"></td></tr>` : ""}
<tr><td style="padding:14px 24px 0;font-size:24px;font-weight:bold;line-height:1.25">${esc(subject)}</td></tr>
<tr><td style="padding:10px 24px 0;font-size:16px;line-height:1.5">${esc(lead)}</td></tr>
${rows.length ? `<tr><td style="padding:14px 16px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table></td></tr>` : ""}
<tr><td align="center" style="padding:20px 24px"><a href="${esc(shopUrl)}" style="display:inline-block;background:#ffd35a;color:#2b2230;border:3px solid #2b2230;border-radius:10px;padding:13px 24px;font-weight:bold;font-size:16px;text-decoration:none">${t(
    kind === "out" ? "Voir les produits et les invitations" : "Voir les précommandes",
    kind === "out" ? "See the products" : "See the pre-orders",
  )}</a></td></tr>
${setPage && kind === "out" ? `<tr><td style="padding:0 24px 20px;font-size:15px;line-height:1.5">${t("Tes boosters ouverts ?", "Opened your packs?")} <a href="${esc(setPage)}" style="color:#7a4b16">${t(`Coche tes cartes de ${esc(name)} et suis leur cote →`, `Tick your ${esc(name)} cards and follow their value →`)}</a></td></tr>` : ""}
<tr><td style="padding:0 24px 24px;font-size:12px;color:#6b5f6e;line-height:1.5">${t(
    "Tu reçois ce mail parce que tu as demandé l'alerte sorties sur nookdex.com.",
    "You get this e-mail because you asked for the release alert on nookdex.com.",
  )} <a href="{{ unsubscribe }}" style="color:#6b5f6e">${t("Se désinscrire", "Unsubscribe")}</a></td></tr>
</table></td></tr></table></body></html>`;
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
