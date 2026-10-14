import { SKIN } from "@/lib/skins";
import { recordPurchase, verifyStripe } from "@/lib/shopServer";

interface Session {
  id: string;
  payment_status: string;
  client_reference_id: string | null;
  metadata: Record<string, string> | null;
  amount_total: number | null;
  currency: string | null;
}

/**
 * Stripe tells us a skin was paid (endpoint set in Stripe's Dashboard → Webhooks, events checkout.session.completed and
 * checkout.session.async_payment_succeeded; its secret is STRIPE_WEBHOOK_SECRET): the purchase is written in Supabase,
 * once per session. Anything else is acknowledged and left alone.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("not set up", { status: 503 });
  const body = await req.text();
  if (!verifyStripe(body, req.headers.get("stripe-signature"), secret)) return new Response("bad signature", { status: 400 });
  const event = JSON.parse(body) as { type: string; data: { object: Session } };
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return new Response("ok");
  const s = event.data.object;
  // a slow payment method: the purchase waits for async_payment_succeeded
  if (s.payment_status !== "paid") return new Response("ok");
  const skin = s.metadata?.skin;
  const user = s.client_reference_id ?? s.metadata?.user_id;
  if (!skin || !SKIN.has(skin) || !user) {
    console.error("[shop] webhook: a session without its skin or player", s.id);
    return new Response("ok");
  }
  try {
    await recordPurchase({ user_id: user, skin, session_id: s.id, amount: s.amount_total, currency: s.currency });
  } catch (e) {
    console.error("[shop] webhook", e);
    // Stripe tries again later
    return new Response("retry", { status: 500 });
  }
  return new Response("ok");
}
