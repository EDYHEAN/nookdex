import { SITE_NAME } from "@/lib/site";

// English waiting list. With BREVO_WAITLIST_LIST_ID set (a Brevo contact list), the address joins that list, ready
// for one campaign when English is out. Without it, the address is simply mailed to us, like the contact form.
const TO = process.env.CONTACT_TO || "johan.trigeard@gmail.com";
const FROM = process.env.CONTACT_FROM || "contact@nookdex.com";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: unknown; lang?: unknown } | null;
  const email = String(body?.email ?? "").trim();
  const lang = String(body?.lang ?? "").slice(0, 20);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return Response.json({ error: "Invalid e-mail" }, { status: 400 });

  const key = process.env.BREVO_API_KEY;
  if (!key) {
    console.error("[waitlist] BREVO_API_KEY missing");
    return Response.json({ error: "Not set up yet" }, { status: 500 });
  }
  const headers = { "api-key": key, "Content-Type": "application/json", Accept: "application/json" };
  const list = Number(process.env.BREVO_WAITLIST_LIST_ID);

  const res = list
    ? await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers,
        body: JSON.stringify({ email, listIds: [list], updateEnabled: true }),
      })
    : await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers,
        body: JSON.stringify({
          sender: { name: SITE_NAME, email: FROM },
          to: [{ email: TO }],
          subject: `[${SITE_NAME}] Liste d'attente anglais : ${email}`,
          textContent: `${email} veut être prévenu quand ${SITE_NAME} sera en anglais.\nLangue du navigateur : ${lang || "?"}`,
        }),
      });

  if (!res.ok) {
    console.error("[waitlist] Brevo", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "Could not save" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
