import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The release alert (Johan, 2026-11-10: the visitors of /invitations-amazon read, then leave until the next set): an e-mail
 * on the day a new set comes out, to who asked for it on the Amazon pages or the calendar. No account. Server only.
 *
 * Double opt-in of our own, nothing to set up in Brevo: the form sends a confirmation mail (Brevo transactional) with a
 * signed link; the link adds the address to its language's Brevo list, created by name the first time. The send itself is
 * scripts/release-alert.mjs (a Brevo campaign: its unsubscribe link, Brevo's). Amazon's rules forbid its affiliate links in
 * e-mails: the mail links to our pages, which carry them.
 */
export type AlertLang = "fr" | "en";
export const ALERT_LISTS: Record<AlertLang, string> = { fr: "NookDex · Alerte sorties FR", en: "NookDex · Release alert EN" };
const FOLDER = "NookDex";
const API = "https://api.brevo.com/v3";

/** the signature of a confirmation link: the address and language, keyed by the Brevo key (no secret of its own to keep) */
function sign(email: string, lang: AlertLang) {
  const key = process.env.BREVO_API_KEY ?? "";
  return createHmac("sha256", `release-alert:${key}`).update(`${email.toLowerCase()}|${lang}`).digest("base64url").slice(0, 32);
}
export const confirmLink = (origin: string, email: string, lang: AlertLang) =>
  `${origin}/api/alert/confirm?${new URLSearchParams({ e: email, l: lang, s: sign(email, lang) })}`;
export function signed(email: string, lang: AlertLang, s: string) {
  const want = Buffer.from(sign(email, lang));
  const got = Buffer.from(s);
  return want.length === got.length && timingSafeEqual(want, got);
}

export async function brevo<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("BREVO_API_KEY missing");
  const r = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Brevo ${init?.method ?? "GET"} ${path}: ${r.status} ${await r.text().catch(() => "")}`);
  return (r.status === 204 ? null : await r.json().catch(() => null)) as T;
}

const lists = new Map<AlertLang, number>();
/** the language's list id: found by its name, else made (in the NookDex folder) */
export async function alertList(lang: AlertLang) {
  const known = lists.get(lang);
  if (known) return known;
  const name = ALERT_LISTS[lang];
  const all = await brevo<{ lists?: { id: number; name: string }[] }>("/contacts/lists?limit=50&sort=desc");
  let id = all.lists?.find((l) => l.name === name)?.id;
  if (!id) {
    const folders = await brevo<{ folders?: { id: number; name: string }[] }>("/contacts/folders?limit=50");
    const folderId = folders.folders?.find((f) => f.name === FOLDER)?.id ?? (await brevo<{ id: number }>("/contacts/folders", { method: "POST", body: { name: FOLDER } })).id;
    id = (await brevo<{ id: number }>("/contacts/lists", { method: "POST", body: { name, folderId } })).id;
  }
  lists.set(lang, id);
  return id;
}
