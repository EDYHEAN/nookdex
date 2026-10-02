/**
 * The language of a card is part of its key: a French card keeps its TCGdex id ("sv08-001", as in every save made
 * before), an English one is "en:sv08-001", a Japanese one "ja:SV8-033" (Japanese sets are their own, with their own
 * ids). Same for sets ("sv08", "en:sv08", "ja:SV8"). A collection can then hold several prints of a card, each in its
 * own binder, with no change to the code that reads `collection[id]`.
 */
export type CardLang = "fr" | "en" | "ja";

export const CARD_LANGS: CardLang[] = ["fr", "en", "ja"];

const PREFIX = /^(en|ja):/;

export const langOfKey = (key: string): CardLang => (PREFIX.exec(key)?.[1] as CardLang | undefined) ?? "fr";
/** The TCGdex id, without the language. */
export const bareId = (key: string) => key.replace(PREFIX, "");
export const keyOf = (lang: CardLang, id: string) => (lang === "fr" ? id : `${lang}:${id}`);

export type Currency = "EUR" | "USD";

/**
 * Each language is priced on its own market: Cardmarket (euros) for French and Japanese cards, TCGplayer (dollars) for
 * English ones. Cardmarket's guide mixes the languages of a card, except Japanese prints, which are products of their own.
 */
export const currencyOf = (lang: CardLang): Currency => (lang === "en" ? "USD" : "EUR");

/** Label on the language stamps and on a binder's spine: French collectors say "JAP". */
export const langLabel = (lang: CardLang, site: "fr" | "en") => (lang === "ja" ? (site === "fr" ? "JAP" : "JP") : lang.toUpperCase());
