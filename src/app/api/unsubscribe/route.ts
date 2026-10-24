import { SITE_NAME, SUPABASE_KEY, SUPABASE_URL } from "@/lib/site";

// The Monday mail's unsubscribe link (scripts/monday-mail.mjs): /api/unsubscribe?t=<token>, no sign-in. GET from the link
// in the mail shows a page; POST is the one-click of the List-Unsubscribe header (Gmail, Apple Mail). Either way the
// row goes (Supabase mail_unsubscribe, its token alone).

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function unsubscribe(token: string | null) {
  if (!token || !TOKEN.test(token)) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mail_unsubscribe`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token }),
    cache: "no-store",
  });
  return r.ok;
}

export async function POST(req: Request) {
  const ok = await unsubscribe(new URL(req.url).searchParams.get("t"));
  return new Response(null, { status: ok ? 200 : 400 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ok = await unsubscribe(url.searchParams.get("t"));
  // the mail's language isn't in the link: both, French first
  const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${SITE_NAME}</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#2b2230;font-family:Arial,sans-serif">
<main style="max-width:420px;margin:16px;padding:26px;background:#f4ecdc;border:4px solid #1a141e;border-radius:12px;text-align:center;color:#2b2230">
<p style="font:bold 20px Courier New,monospace;color:#b8433d">${ok ? "C'est fait ✓" : "Lien invalide"}</p>
<p>${ok ? "Tu ne recevras plus le courrier du lundi. Tu peux le réactiver dans NookDex OS → Sauvegarde." : "Ce lien ne marche pas (ou a déjà servi). Tu peux couper le courrier du lundi dans NookDex OS → Sauvegarde."}</p>
<p style="color:#6f6068;font-size:14px">${ok ? "You won't get the Monday mail any more. Turn it back on in NookDex OS → Save." : "This link doesn't work (or was already used). Turn the Monday mail off in NookDex OS → Save."}</p>
<p><a href="/" style="display:inline-block;margin-top:8px;background:#ffd35a;color:#2b2230;border:3px solid #2b2230;border-radius:8px;padding:10px 18px;font:bold 14px Courier New,monospace;text-decoration:none">Ouvrir mon bureau ▶</a></p>
</main></body></html>`;
  return new Response(page, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
