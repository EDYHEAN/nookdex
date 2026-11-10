import { type AlertLang, alertList, brevo, signed } from "@/lib/releaseAlert";

// The confirmation mail's link (app/api/alert): a valid signature adds the address to its language's Brevo list, then back
// to the Amazon page with a thank-you (?alerte=ok, components/shop/ReleaseAlert).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("e") ?? "";
  const lang: AlertLang = url.searchParams.get("l") === "en" ? "en" : "fr";
  const back = new URL(lang === "fr" ? "/invitations-amazon" : "/en/amazon-invites", url.origin);
  if (!email || !signed(email, lang, url.searchParams.get("s") ?? "")) {
    back.searchParams.set("alerte", "lien");
    return Response.redirect(back, 303);
  }
  try {
    const listId = await alertList(lang);
    // an address already in Brevo (a MyFrenchTool reader, say): added to this list too, nothing else changed
    await brevo("/contacts", { method: "POST", body: { email, listIds: [listId], updateEnabled: true } });
    back.searchParams.set("alerte", "ok");
  } catch (e) {
    console.error("[alert/confirm]", e);
    back.searchParams.set("alerte", "erreur");
  }
  return Response.redirect(back, 303);
}
