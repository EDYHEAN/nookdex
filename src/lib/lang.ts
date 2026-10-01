"use client";

import { useStore } from "./store";

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

export const useLang = (): Lang => {
  const chosen = useStore((s) => s.lang);
  const frenchOk = useStore((s) => s.frenchOk);
  return resolveLang(chosen, frenchOk);
};

export const currentLang = (): Lang => {
  const s = useStore.getState();
  return resolveLang(s.lang, s.frenchOk);
};

/** `t("Ranger", "Put away")`: the French text, or its English twin. */
export function useT() {
  const en = useLang() === "en";
  return <T,>(fr: T, english: T): T => (en ? english : fr);
}

export { LANG_COOKIE } from "./site";
