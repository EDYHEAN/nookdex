import { SITE_NAME } from "@/lib/site";

// Same setup as MyFrenchTool: Brevo's transactional API, key in the Vercel env (BREVO_API_KEY).
// The sender must be a sender verified in Brevo; the address that receives the messages never reaches the browser.
const TO = process.env.CONTACT_TO || "johan.trigeard@gmail.com";
const FROM = process.env.CONTACT_FROM || "johan@myfrenchtool.com";

const TOPICS = ["Question", "Bug", "Idée", "Supprimer mon compte / mes données"];

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "<br>");

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Requête illisible" }, { status: 400 });
  if (body.honeypot) return Response.json({ ok: true }); // robots fill the hidden field

  const email = String(body.email ?? "").trim();
  const topic = TOPICS.includes(String(body.topic)) ? String(body.topic) : TOPICS[0];
  const message = String(body.message ?? "").trim();
  if (!email || !message) return Response.json({ error: "Champs manquants" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return Response.json({ error: "E-mail invalide" }, { status: 400 });
  if (message.length > 4000) return Response.json({ error: "Message trop long" }, { status: 400 });

  const key = process.env.BREVO_API_KEY;
  if (!key) {
    console.error("[contact] BREVO_API_KEY missing");
    return Response.json({ error: "Envoi pas encore configuré" }, { status: 500 });
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { name: SITE_NAME, email: FROM },
      to: [{ email: TO }],
      replyTo: { email },
      subject: `[${SITE_NAME}] ${topic}`,
      htmlContent: `<p><strong>De :</strong> ${escapeHtml(email)}</p><p><strong>Sujet :</strong> ${escapeHtml(topic)}</p><p>${escapeHtml(message)}</p>`,
      textContent: `De : ${email}\nSujet : ${topic}\n\n${message}`,
    }),
  });

  if (!res.ok) {
    console.error("[contact] Brevo", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "Erreur d'envoi" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
