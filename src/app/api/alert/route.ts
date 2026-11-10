import { type AlertLang, brevo, confirmLink } from "@/lib/releaseAlert";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// The release alert's form (components/shop/ReleaseAlert): sends the confirmation mail, nothing stored yet (lib/releaseAlert).
const FROM = process.env.CONTACT_FROM || "contact@nookdex.com";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** a few asks per address of a server instance: the form can't be used to flood someone's inbox */
const recent = new Map<string, number[]>();
function tooMany(key: string) {
  const now = Date.now();
  const times = (recent.get(key) ?? []).filter((t) => now - t < 3_600_000);
  times.push(now);
  recent.set(key, times);
  return times.length > 3;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function mail(lang: AlertLang, link: string) {
  const fr = lang === "fr";
  const t = (f: string, e: string) => (fr ? f : e);
  const subject = t("Confirme ton alerte sorties NookDex", "Confirm your NookDex release alert");
  const preheader = t(
    "Un clic, et tu sauras quand ouvrent les précommandes et le jour de chaque sortie Pokémon.",
    "One click, and you'll know when pre-orders open and the day each Pokémon TCG set comes out.",
  );
  const font = "font-family:Arial,Helvetica,sans-serif";
  const home = `${SITE_URL}${fr ? "/" : "/en"}`;
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
<style>:root{color-scheme:light;supported-color-schemes:light}@media (max-width:480px){.px{padding-left:20px!important;padding-right:20px!important}}</style>
</head>
<body style="margin:0;padding:0;background:#f3ead8">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f3ead8;opacity:0">${esc(preheader)}${"&#847;&zwnj;&nbsp;".repeat(80)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3ead8" style="background:#f3ead8"><tr><td align="center" style="padding:28px 12px">
<!--[if mso]><table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fffaf0" style="max-width:520px;background:#fffaf0;border:3px solid #2b2230;border-radius:14px;${font};color:#2b2230">
<tr><td class="px" style="padding:22px 28px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle"><img src="${SITE_URL}/email/warwick.png" width="40" height="40" alt="" style="display:block;border:0;border-radius:50%"></td>
<td valign="middle" style="padding-left:10px"><img src="${SITE_URL}/email/logo.jpg" width="112" height="35" alt="NookDex" style="display:block;border:0;${font};font-size:18px;font-weight:bold;color:#2b2230"></td>
</tr></table></td></tr>
<tr><td class="px" style="padding:20px 28px 0;font-size:24px;line-height:1.25;font-weight:bold">${t("Une dernière étape", "One last step")}</td></tr>
<tr><td class="px" style="padding:8px 28px 0;font-size:16px;line-height:1.5">${t(
    "Confirme ton adresse pour recevoir un mail quand les précommandes d'une extension Pokémon ouvrent, puis le jour de sa sortie. Rien d'autre.",
    "Confirm your address to get an e-mail when pre-orders open for a new Pokémon TCG set, then on its release day. Nothing else.",
  )}</td></tr>
<tr><td class="px" align="center" style="padding:22px 28px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#ffd35a" style="background:#ffd35a;border:3px solid #2b2230;border-radius:10px;mso-padding-alt:12px 24px"><a href="${esc(link)}" style="display:inline-block;padding:12px 24px;${font};font-size:17px;font-weight:bold;color:#2b2230;text-decoration:none">${t(
    "Oui, préviens-moi",
    "Yes, let me know",
  )}&nbsp;&#9654;&#65038;</a></td></tr></table></td></tr>
<tr><td class="px" style="padding:18px 28px 0;font-size:12px;line-height:1.5;color:#6b5f6e">${t("Le bouton ne marche pas ? Ouvre ce lien :", "Button not working? Open this link:")}<br><a href="${esc(link)}" style="color:#6b5f6e;word-break:break-all">${esc(link)}</a></td></tr>
<tr><td class="px" style="padding:12px 28px 26px;font-size:12px;line-height:1.5;color:#6b5f6e">${t(
    "Tu n'as rien demandé ? Ignore ce message : sans clic, ton adresse n'est pas ajoutée.",
    "Didn't ask for it? Ignore this message: without a click, your address isn't added.",
  )}</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
<div style="padding-top:14px;${font};font-size:12px;color:#6b5f6e"><a href="${home}" style="color:#6b5f6e">nookdex.com</a></div>
</td></tr></table></body></html>`;
  const text = `${t("Une dernière étape", "One last step")}\n\n${t(
    "Confirme ton adresse pour recevoir un mail quand les précommandes d'une extension Pokémon ouvrent, puis le jour de sa sortie :",
    "Confirm your address to get an e-mail when pre-orders open for a new Pokémon TCG set, then on its release day:",
  )}\n${link}\n\n${t("Tu n'as rien demandé ? Ignore ce message.", "Didn't ask for it? Ignore this message.")}`;
  return { subject, html, text };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "bad request" }, { status: 400 });
  if (body.honeypot) return Response.json({ ok: true }); // robots fill the hidden field
  const email = String(body.email ?? "").trim();
  const lang: AlertLang = body.lang === "en" ? "en" : "fr";
  if (!EMAIL.test(email) || email.length > 254) return Response.json({ error: "email" }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  if (tooMany(`ip:${ip}`) || tooMany(`mail:${email.toLowerCase()}`)) return Response.json({ error: "slow down" }, { status: 429 });

  const origin = new URL(req.url).origin.includes("localhost") ? new URL(req.url).origin : SITE_URL;
  const { subject, html, text } = mail(lang, confirmLink(origin, email, lang));
  try {
    await brevo("/smtp/email", {
      method: "POST",
      body: { sender: { name: SITE_NAME, email: FROM }, to: [{ email }], subject, htmlContent: html, textContent: text, tags: ["release-alert-confirm"] },
    });
  } catch (e) {
    console.error("[alert]", e);
    return Response.json({ error: "send" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
