/**
 * The language of a card is part of its key: a French card keeps its TCGdex id ("sv08-001", as in every save made
 * before), an English one is "en:sv08-001". Same for sets ("sv08", "en:sv08"). A collection can then hold the French and
 * the English print of the same card, each in its own binder, with no change to the code that reads `collection[id]`.
 */
export type CardLang = "fr" | "en";

export const CARD_LANGS: CardLang[] = ["fr", "en"];

const PREFIX = /^(en):/;

export const langOfKey = (key: string): CardLang => (PREFIX.exec(key)?.[1] as CardLang | undefined) ?? "fr";
/** The TCGdex id, without the language. */
export const bareId = (key: string) => key.replace(PREFIX, "");
export const keyOf = (lang: CardLang, id: string) => (lang === "fr" ? id : `${lang}:${id}`);

/** Each language is priced on its own market: Cardmarket (euros) for French cards, TCGplayer (dollars) for English. */
export const currencyOf = (lang: CardLang): Currency => (lang === "en" ? "USD" : "EUR");

/** Label on the language chips and on a binder's spine. */
export const LANG_LABEL: Record<CardLang, string> = { fr: "FR", en: "EN" };

export type Currency = "EUR" | "USD";
