// No imports here: the store's migrations need these while the store itself is being created.

export type Lang = "fr" | "en";

/** One of the browser's languages is French. */
export const browserIsFrench = () =>
  (navigator.languages?.length ? navigator.languages : [navigator.language]).some((l) => /^fr\b/i.test(l));

/** The visit started on an English address (/en, /en/sets…): read once, the room keeps its language while pages change. */
let landedEn: boolean | undefined;
const landedOnEnglish = () => (landedEn ??= typeof location !== "undefined" && /^\/en(\/|$)/.test(location.pathname));

/** The language picked in NookDex OS, else the address's (/en), else the browser's: French if it speaks French, English otherwise. */
export function resolveLang(chosen: Lang | null, frenchOk = false): Lang {
  if (chosen) return chosen;
  if (frenchOk) return "fr"; // chose "go on in French" before the English version existed
  if (landedOnEnglish()) return "en";
  return typeof navigator !== "undefined" && !browserIsFrench() ? "en" : "fr";
}
