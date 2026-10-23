import fs from "node:fs/promises";
import path from "node:path";

/**
 * Dev only: the public lists (lib/share) before Supabase has share_put. Kept as files in .cache/share-dev, read by the
 * page /c/<slug> the same way (lib/shareList). Nothing in production: the lists live in Supabase there.
 */
const DIR = path.join(process.cwd(), ".cache", "share-dev");
const off = () => process.env.NODE_ENV === "production";
const SLUG = /^[a-z0-9]{8}$/;

export async function POST(req: Request) {
  if (off()) return new Response("Not found", { status: 404 });
  const body = (await req.json()) as { p_slug: string | null; p_name: string; p_lang: string; p_prices: boolean; p_data: unknown };
  const slug =
    body.p_slug && SLUG.test(body.p_slug)
      ? body.p_slug
      : Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
  await fs.mkdir(DIR, { recursive: true });
  const row = { name: body.p_name ?? "", lang: body.p_lang === "en" ? "en" : "fr", prices: body.p_prices !== false, data: body.p_data, updated_at: new Date().toISOString() };
  await fs.writeFile(path.join(DIR, `${slug}.json`), JSON.stringify(row));
  return Response.json({ slug });
}

export async function DELETE(req: Request) {
  if (off()) return new Response("Not found", { status: 404 });
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  if (SLUG.test(slug)) await fs.rm(path.join(DIR, `${slug}.json`), { force: true });
  return Response.json({ ok: true });
}
