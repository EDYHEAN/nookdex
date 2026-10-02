"use client";

import { type Lang, resolveLang } from "./resolveLang";
import { useStore } from "./store";

export { type Lang, browserIsFrench, resolveLang } from "./resolveLang";

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
