import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { STUDIO_EMAIL_HASHES, SUPABASE_KEY, SUPABASE_URL } from "./site";

/*
 * The shop's server side (app/api/shop): Stripe's API and Supabase's, spoken to with plain fetch (no SDK, like the
 * contact form with Brevo). Keys in the Vercel env and .env.local, never in the browser: STRIPE_SECRET_KEY,
 * STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY. Johan sells through plain Stripe Checkout (VAT-exempt; Managed
 * Payments dropped on 2026-10-20, docs/skins.md); the skins' products are made by scripts/stripe-skins.mjs.
 */

const STRIPE = "https://api.stripe.com/v1";
/** Managed Payments needs 2025-03-31.basil or later */
const STRIPE_VERSION = "2025-03-31.basil";

/** A Stripe call: form-encoded, nested keys written out ("line_items[0][price]") */
export async function stripe<T>(path: string, params?: Record<string, string | number | boolean>, method = params ? "POST" : "GET"): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  const body = params ? new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])) : undefined;
  const url = method === "GET" && body ? `${STRIPE}${path}?${body}` : `${STRIPE}${path}`;
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Stripe-Version": STRIPE_VERSION, ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: method === "POST" ? body : undefined,
  });
  const json = (await r.json()) as T & { error?: { message?: string } };
  if (!r.ok) throw new Error(`Stripe ${path}: ${json.error?.message ?? r.status}`);
  return json;
}

/** Who calls, from their Supabase session (the browser sends its access token) */
export async function userOf(req: Request): Promise<{ id: string; email: string | null } | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = (await r.json()) as { id?: string; email?: string };
  return u.id ? { id: u.id, email: u.email ?? null } : null;
}

/** The shop is open to this account: once launched for all, before that Johan's accounts only (lib/shop useShopOpen) */
export function shopOpenFor(email: string | null) {
  if (process.env.NEXT_PUBLIC_SHOP === "on" || process.env.NODE_ENV !== "production") return true;
  if (!email) return false;
  return STUDIO_EMAIL_HASHES.includes(createHash("sha256").update(email.trim().toLowerCase()).digest("hex"));
}

/**
 * A Stripe webhook's signature (header "Stripe-Signature": t=…,v1=…): HMAC-SHA256 of "t.body" with the endpoint's
 * secret, within 5 minutes.
 */
export function verifyStripe(body: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest();
  return header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .some((p) => {
      const got = Buffer.from(p.slice(3), "hex");
      return got.length === expected.length && timingSafeEqual(got, expected);
    });
}

/** Writes a purchase (Supabase purchases, docs/supabase.sql): once per Stripe session, whatever Stripe resends. */
export async function recordPurchase(p: { user_id: string; skin: string; session_id: string; amount: number | null; currency: string | null }) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/purchases?on_conflict=session_id`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(p),
  });
  if (!r.ok) throw new Error(`purchases: ${r.status} ${await r.text()}`);
}
