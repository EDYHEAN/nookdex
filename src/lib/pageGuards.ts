import { notFound, permanentRedirect } from "next/navigation";
import { postBySlug } from "./blog";
import { cardSlug } from "./cardPages";
import { setFile } from "./setFiles";
import { type PageLang, SET_PAGES_ROOT, setBySlug, slugify } from "./setPath";

/**
 * The checks the layouts of the set, card and post pages run before anything is sent (2026-11-28). Under a loading.tsx a
 * page has started streaming as a 200 before its own notFound(): an unknown address answered "200 + noindex", a soft 404
 * for Google, and a renamed card could only be sent on with a meta refresh. A layout sits above its segment's loading
 * boundary (the index pages' loading.tsx are in route groups for that), so here notFound() is a real 404 and
 * permanentRedirect() a real 308. The set file read here is the one the page reads next (lib/setFiles keeps it).
 */

export function guardSet(lang: PageLang, slug: string) {
  if (!setBySlug(lang, slug)) notFound();
}

export async function guardCard(lang: PageLang, setSlug: string, slug: string) {
  const entry = setBySlug(lang, setSlug);
  if (!entry) notFound();
  const data = await setFile(lang, entry.set.id);
  if (!data) notFound();
  if (data.cards.some((c) => cardSlug(c) === slug)) return;
  // the card's name changed since the address was made (TCGdex renamed it, an early set's English names became French):
  // the same number in the same set is the same card
  const same = data.cards.filter((c) => {
    const num = slugify(c.num);
    return !!num && (slug === num || slug.endsWith(`-${num}`));
  });
  if (same.length === 1) permanentRedirect(`${SET_PAGES_ROOT[lang]}/${setSlug}/${cardSlug(same[0])}`);
  notFound();
}

export function guardPost(slug: string) {
  if (!postBySlug(slug)) notFound();
}
