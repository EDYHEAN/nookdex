// No imports here: the store's migrations need these while the store itself is being created.

export type Lang = "fr" | "en";

/** One of the browser's languages is French. */
export const browserIsFrench = () =>
  (navigator.languages?.length ? navigator.languages : [navigator.language]).some((l) => /^fr\b/i.test(l));

/** The language picked in NookDex OS, else the browser's: French if it speaks French, English otherwise. */
export function resolveLang(chosen: Lang | null, frenchOk = false): Lang {
  if (chosen) return chosen;
  if (frenchOk) return "fr"; // chose "go on in French" before the English version existed
  return typeof navigator !== "undefined" && !browserIsFrench() ? "en" : "fr";
}
