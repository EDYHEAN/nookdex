import type { CardLang } from "./cardLang";
import { binderSets } from "./catalog";

/**
 * The binders' series, as the new binder sheet (shelf/BinderPicker) and the public list's picker (share/WantPicker) show
 * them: the Wizards era in one group, the Japanese series with their international twins, named in the site's language.
 */

/** Japanese series ids and their international twins: same tab, and its name in the site's language. */
export const TWIN: Record<string, string> = { M: "me", SV: "sv", S: "swsh" };
export const twinOf = (serie: string, to: CardLang) =>
  to === "ja" ? (Object.keys(TWIN).find((k) => TWIN[k] === serie) ?? serie) : (TWIN[serie] ?? serie);

/** The Wizards era's series (Base, Gym, Neo, Legendary Collection, e-Card): one tab, they're a few sets each. */
export const WIZARDS = new Set(["base", "gym", "neo", "lc", "ecard"]);
export const tabOf = (serie: string) => (WIZARDS.has(serie) ? "wizards" : serie);

/** A series' name in the site's language (by its international id), else its own */
export function seriesName(tab: string, site: "fr" | "en", fallback = tab) {
  return new Map(binderSets(site).map((s) => [tabOf(s.serie), WIZARDS.has(s.serie) ? "Wizards" : s.serieName])).get(twinOf(tab, site)) ?? fallback;
}

/** The series of a card language's binder sets, newest first, named in the site's language */
export function seriesOf(lang: CardLang, site: "fr" | "en") {
  const names = new Map(binderSets(site).map((s) => [tabOf(s.serie), WIZARDS.has(s.serie) ? "Wizards" : s.serieName]));
  return [...new Map(binderSets(lang).map((s) => [tabOf(s.serie), names.get(twinOf(tabOf(s.serie), site)) ?? s.serieName])).entries()].map(([id, name]) => ({
    id,
    name,
  }));
}
