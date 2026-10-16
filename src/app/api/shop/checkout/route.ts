import { BUNDLE, ITEM } from "@/lib/skins";
import { shopOpenFor, stripe, userOf } from "@/lib/shopServer";
import { MANAGED_PAYMENTS } from "@/lib/site";

/**
 * Buying a skin (lib/shop buySkin): a Stripe Checkout page for the signed-in player, with Managed Payments or not (lib/site
 * MANAGED_PAYMENTS). Its price is found by lookup key (skin_<id>, made by scripts/stripe-skins.mjs); the webhook writes
 * the purchase once paid.
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
  // Johan sells (no Managed Payments): the buyer asked for the item at once and waived withdrawal, ticked in the shop
  if (!MANAGED_PAYMENTS && body?.waiver !== true) return Response.json({ error: "waiver" }, { status: 400 });

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
      ...(MANAGED_PAYMENTS
        ? { "managed_payments[enabled]": true }
        : {
            // said outright: the account turns Managed Payments on by default for every Checkout session
            "managed_payments[enabled]": false,
            // when the waiver was given, kept with the payment, and said again next to the pay button
            "metadata[waiver]": new Date().toISOString(),
            "custom_text[submit][message]": en
              ? "Digital item delivered right after payment: you asked for it at once and waived your 14-day right of withdrawal."
              : "Objet numérique livré dès le paiement : tu as demandé sa livraison immédiate et renoncé à ton droit de rétractation de 14 jours.",
          }),
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
