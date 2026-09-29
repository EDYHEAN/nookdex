import type { BinderDef, SetData } from "./types";
import swsh12 from "@/data/sets/swsh12.json";

const logo = (serie: "swsh" | "sv", id: string) => `https://assets.tcgdex.net/fr/${serie}/${id}/logo`;

// Binder ids are TCGdex set ids. To fill one: `npm run fetch-set <id> [subSetId]`,
// import the JSON here and set it on the matching binder.
// `slot` = which painted binder of the room it is ("shelf-index", see src/data/scene.json);
// colors are sampled from that painted spine.
export const BINDERS: BinderDef[] = [
  // Top shelf
  { id: "swsh12", slot: "0-0", code: "EB12", name: "Tempête Argentée", color: "#b7aca9", dark: "#5e5654", ink: "#1b1b22", logo: logo("swsh", "swsh12"), set: swsh12 as SetData },
  { id: "swsh12.5", slot: "0-1", code: "EB12.5", name: "Zénith Suprême", color: "#c69c63", dark: "#6e5230", ink: "#23180a", logo: logo("swsh", "swsh12.5"), set: null },
  { id: "swsh9", slot: "0-2", code: "EB09", name: "Stars Étincelantes", color: "#84a0b7", dark: "#3f5569", ink: "#101a24", logo: logo("swsh", "swsh9"), set: null },
  { id: "swsh11", slot: "0-3", code: "EB11", name: "Origine Perdue", color: "#927eab", dark: "#4a3a60", ink: "#fff3e6", logo: logo("swsh", "swsh11"), set: null },
  { id: "swsh10.5", slot: "0-4", code: "PGO", name: "Pokémon GO", color: "#b86b6f", dark: "#633337", ink: "#fff3e6", logo: logo("swsh", "swsh10.5"), set: null },
  { id: "swsh10", slot: "0-5", code: "EB10", name: "Astres Radieux", color: "#777677", dark: "#3a393b", ink: "#fff3e6", logo: logo("swsh", "swsh10"), set: null },
  // Bottom shelf
  { id: "sv04.5", slot: "1-0", code: "EV4.5", name: "Destinées de Paldea", color: "#ae967c", dark: "#5c4b39", ink: "#1f160c", logo: logo("sv", "sv04.5"), set: null },
  { id: "sv04", slot: "1-1", code: "EV04", name: "Faille Paradoxe", color: "#7d7ea6", dark: "#3b3c5c", ink: "#fff3e6", logo: logo("sv", "sv04"), set: null },
  { id: "sv01", slot: "1-2", code: "EV01", name: "Écarlate et Violet", color: "#c46962", dark: "#6a2f2a", ink: "#fff3e6", logo: logo("sv", "sv01"), set: null },
  { id: "sv02", slot: "1-3", code: "EV02", name: "Évolutions à Paldea", color: "#99a77e", dark: "#4d5a3a", ink: "#15190e", logo: logo("sv", "sv02"), set: null },
  { id: "sv03", slot: "1-4", code: "EV03", name: "Flammes Obsidiennes", color: "#8d7f7a", dark: "#433a37", ink: "#fff3e6", logo: logo("sv", "sv03"), set: null },
  { id: "sv06", slot: "1-5", code: "EV06", name: "Mascarade Crépusculaire", color: "#aa988f", dark: "#574a44", ink: "#1f1814", logo: logo("sv", "sv06"), set: null },
  { id: "sv03.5", slot: "1-6", code: "MEW", name: "151", color: "#c793a0", dark: "#6b4450", ink: "#22131a", logo: logo("sv", "sv03.5"), set: null },
  { id: "sv05", slot: "1-7", code: "EV05", name: "Forces Temporelles", color: "#7b9694", dark: "#3a4f4d", ink: "#fff3e6", logo: logo("sv", "sv05"), set: null },
];

export const binderOfCard = (cardId: string) => BINDERS.find((b) => b.set?.cards.some((c) => c.id === cardId));
