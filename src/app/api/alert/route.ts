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
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;background:#f3ead8;font-family:Arial,Helvetica,sans-serif;color:#2b2230">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffaf0;border:3px solid #2b2230;border-radius:14px">
<tr><td style="padding:28px 28px 8px"><img src="${SITE_URL}/email/warwick.png" width="56" height="56" alt="" style="border-radius:50%"></td></tr>
<tr><td style="padding:0 28px;font-size:22px;font-weight:bold">${t("Une dernière étape", "One last step")}</td></tr>
<tr><td style="padding:12px 28px 0;font-size:16px;line-height:1.5">${t(
    "Clique ci-dessous pour recevoir un e-mail le jour où sort une nouvelle extension Pokémon, avec les produits à demander sur Amazon. Rien d'autre.",
    "Click below to get an e-mail on the day a new Pokémon TCG set comes out, with the products to look for on Amazon. Nothing else.",
  )}</td></tr>
<tr><td style="padding:24px 28px"><a href="${esc(link)}" style="display:inline-block;background:#ffd35a;color:#2b2230;border:3px solid #2b2230;border-radius:10px;padding:12px 22px;font-weight:bold;text-decoration:none">${t(
    "Oui, préviens-moi",
    "Yes, let me know",
  )}</a></td></tr>
<tr><td style="padding:0 28px 28px;font-size:13px;color:#6b5f6e;line-height:1.5">${t(
    "Tu n'as rien demandé ? Ignore ce message : sans clic, ton adresse n'est pas ajoutée.",
    "Didn't ask for it? Ignore this message: without a click, your address isn't added.",
  )}</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${t("Confirme ton alerte sorties NookDex :", "Confirm your NookDex release alert:")}\n${link}`;
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
