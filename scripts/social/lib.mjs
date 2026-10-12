// What the social renderers (render.mjs: pictures, motion.mjs: TikTok videos) share: the site's card data and prices,
// the fonts, small text helpers.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const APP = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const url = (p) => "file:///" + p.replace(/\\/g, "/");

let ASSETS = "";
/** the social branch's assets folder (app screenshots, photos) */
export const setAssets = (dir) => (ASSETS = dir);
export const asset = (name) => url(join(ASSETS, name));

const CATALOGS = { fr: "catalog.json", en: "catalog-en.json", ja: "catalog-ja.json" };
const OWNER = {};
for (const [lang, f] of Object.entries(CATALOGS)) {
  OWNER[lang] = new Map();
  for (const s of JSON.parse(readFileSync(join(APP, "src/data", f), "utf8"))) [s.id, ...s.subs].forEach((id) => OWNER[lang].set(id, s.id));
}
const sets = new Map();
const readSet = (lang, setId) => {
  const file = join(APP, "public/sets", lang === "fr" ? "" : lang, `${setId}.json`);
  if (!sets.has(file)) sets.set(file, JSON.parse(readFileSync(file, "utf8")));
  return sets.get(file);
};
/** a set by its key: "me05", "en:sv08" */
export const setOf = (key) => {
  const lang = /^(en|ja):/.exec(key)?.[1] ?? "fr";
  return readSet(lang, key.replace(/^(en|ja):/, ""));
};
/** "sv08-238", "en:sv08-238", "ja:SV8-033" -> the card, its set file, its language */
export function card(key) {
  const m = /^(en|ja):/.exec(key);
  const lang = m ? m[1] : "fr";
  const id = m ? key.slice(3) : key;
  const setId = OWNER[lang].get(id.slice(0, id.lastIndexOf("-")));
  if (!setId) throw new Error(`unknown card ${key}`);
  const set = readSet(lang, setId);
  const c = set.cards.find((x) => x.id === id);
  if (!c) throw new Error(`card ${key} not in ${setId}`);
  return { ...c, set, lang, hi: `${c.img}/high.webp` };
}

export const money = (n, set) =>
  n == null ? "—" : set.currency === "USD" ? `$${n.toFixed(2)}` : `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
export const dayOf = (set) => new Date(set.pricesUpdated).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
export const market = (set) => (set.currency === "USD" ? "TCGplayer" : "Cardmarket");
export const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** texts may carry <br>, <b>, <em> on purpose: those three are let through */
export const txt = (s = "") => esc(s).replace(/&lt;(\/?)(br|b|em)\s*\/?&gt;/g, "<$1$2>");

export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .32 0 0 0 0 .22 0 0 0 0 .18 0 0 0 .11 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
export const FONT_FACES = `
@font-face { font-family: Press; src: url(${url(join(APP, "src/assets/fonts/PressStart2P-Regular.ttf"))}); }
@font-face { font-family: VT; src: url(${url(join(APP, "src/assets/fonts/VT323-Regular.ttf"))}); }`;
export const AVATAR = url(join(APP, "public/email/warwick.png"));
export const DESK = url(join(APP, "src/assets/share-desk.jpg"));
