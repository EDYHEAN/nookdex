"use client";

import { useStore } from "./store";

/** One of the browser's languages is French. */
export const browserIsFrench = () =>
  (navigator.languages?.length ? navigator.languages : [navigator.language]).some((l) => /^fr\b/i.test(l));

/**
 * The site speaks French. A browser in another language gets the few first screens in English
 * (loader, the "French only for now" note), until the visitor chooses to go on in French.
 */
export const useEnglishIntro = () => {
  const frenchOk = useStore((s) => s.frenchOk);
  return !frenchOk && !browserIsFrench();
};
