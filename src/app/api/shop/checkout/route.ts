import { BUNDLE, ITEM } from "@/lib/skins";
import { shopOpenFor, stripe, userOf } from "@/lib/shopServer";

/**
 * Buying a skin (lib/shop buySkin): a Stripe Checkout page for the signed-in player, Johan the seller (docs/skins.md). Its
 * price is found by lookup key (skin_<id>, made by scripts/stripe-skins.mjs); the webhook writes the purchase once paid.
 * 503 while Stripe isn't set up, 403 while the shop isn't open to this account.
 */
export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) return Response.json({ error: "soon" }, { status: 503 });
  const user = await userOf(req);
  if (!user) return Response.json({ error: "sign in" }, { status: 401 });
  if (!shopOpenFor(user.email)) return Response.json({ error: "closed" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { skin?: string; lang?: string; waiver?: boolean } | null;
  // an item or a bundle
  const skin = body?.skin ? (ITEM.get(body.skin) ?? BUNDLE.get(body.skin)) : undefined;
  if (!skin) return Response.json({ error: "unknown skin" }, { status: 400 });
  const en = body?.lang === "en";
  // Johan sells: the buyer asked for the item at once and waived withdrawal by clicking Buy
  if (body?.waiver !== true) return Response.json({ error: "waiver" }, { status: 400 });

  try {
    const prices = await stripe<{ data: { id: string }[] }>("/prices", { "lookup_keys[]": `skin_${skin.id}`, active: true }, "GET");
    const price = prices.data[0]?.id;
    if (!price) return Response.json({ error: "soon" }, { status: 503 });
    const origin = new URL(req.url).origin;
    const back = `${origin}${en ? "/en" : "/"}`;
    const session = await stripe<{ url: string }>("/checkout/sessions", {
      mode: "payment",
      "line_items[0][price]": price,
      "line_items[0][quantity]": 1,
      // said outright: Managed Payments (Link the seller) stays off whatever the account's default (dropped 2026-10-20)
      "managed_payments[enabled]": false,
      // printed on Stripe's receipt: what was bought, and the VAT-exempt mention Johan's sales carry
      "payment_intent_data[description]": `NookDex · ${en ? skin.name.en : skin.name.fr} · ${en ? "VAT not applicable, art. 293 B CGI" : "TVA non applicable, art. 293 B du CGI"}`,
      // when the waiver was given, kept with the payment, and said again next to the pay button
      "metadata[waiver]": new Date().toISOString(),
      "custom_text[submit][message]": en
        ? "Digital item delivered right after payment: you asked for it at once and waived your 14-day right of withdrawal."
        : "Objet numérique livré dès le paiement : tu as demandé sa livraison immédiate et renoncé à ton droit de rétractation de 14 jours.",
      client_reference_id: user.id,
      ...(user.email ? { customer_email: user.email } : {}),
      "metadata[skin]": skin.id,
      "metadata[user_id]": user.id,
      locale: en ? "en" : "fr",
      success_url: `${back}?shop=paid&bought=${skin.id}`,
      cancel_url: `${back}?shop=back`,
    });
    return Response.json({ url: session.url });
  } catch (e) {
    console.error("[shop] checkout", e);
    return Response.json({ error: "stripe" }, { status: 502 });
  }
}
