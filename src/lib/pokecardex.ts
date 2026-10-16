import { keyOf, type CardLang } from "./cardLang";
import { catalog, catalogSet, loadSet } from "./catalog";
import type { CardData, Condition, Variant } from "./types";

/*
 * Importing a collection exported from pokecardex.com (Mon compte → Exporter): a CSV, ";"-separated, quoted, UTF-8 with
 * a BOM, columns Serie;Numero;Nom;Type;Rarete;Version;Langue;Etat;Quantite;Note;"Date ajout". A line is a card in a
 * version, language and condition, with how many. Sets are found by their French name (a few named apart, ALIAS),
 * cards by their printed number. Checked on a player's export (2026-10-16): 98 % of the lines found.
 */

/** Pokécardex's names that aren't TCGdex's */
const ALIAS: Record<string, string> = {
  "Promos Épée et Bouclier": "swshp",
  "Promos Soleil et Lune": "smp",
  "Promos X&Y": "xyp",
  "Promos Méga-Évolution": "mep",
  "Promos Écarlate et Violet": "svp",
  "Promos Noir & Blanc": "bwp",
  "Promos HeartGold SoulSilver": "hgssp",
  "Promos Diamant & Perle": "dpp",
  "HS : Indomptable": "hgss3",
  "HS : Triomphe": "hgss4",
  "HS : Déchaînement": "hgss2",
  "Diamant & Perle : Tempête": "dp7",
  "Diamant & Perle : Trésors Mystérieux": "dp2",
  "Promo Black Star Wizards Of The Coast": "basep",
  "SL Kit du Dresseur (Lougaroc)": "tk-sm-l",
  "SL Kit du Dresseur (Raichu)": "tk-sm-r",
  "D&P Kit Dresseur (Lucario)": "tk-dp-l",
  "D&P Kit Dresseur (Manaphy)": "tk-dp-m",
  "Promo McDonald's 2011": "2011bw",
  "Promo McDonald's 2012": "2012bw",
  "Promo McDonald's 2013": "2013bw",
  "Promo McDonald's 2014": "2014xy",
  "Promo McDonald's 2015": "2015xy",
  "Promo McDonald's 2016": "2016xy",
  "Promo McDonald's 2017": "2017sm",
  "Promo McDonald's 2018": "2018sm-fr",
  "Promo McDonald's 2019": "2019sm-fr",
  "Promo McDonald's 2021": "2021swsh",
  "Promo McDonald's 2022": "2022swsh",
  "Promo McDonald's 2023": "2023sv",
  "Promo McDonald's 2024": "2024sv",
};

/** Pokécardex's conditions, as Cardmarket's */
const CONDITION: Record<string, Condition> = { Neuve: "NM", Excellent: "EX", "Très bon": "GD", Bon: "LP", Moyen: "PL", Abimée: "PO", Abîmée: "PO" };
/** its languages: French and English cards are ours; Japanese sets are their own (not matched yet), Korean none */
const LANG: Record<string, CardLang | null> = { FR: "fr", US: "en", EN: "en", UK: "en", JP: null, KR: null };

export interface ImportLine {
  set: string;
  number: string;
  name: string;
  qty: number;
}
export interface Found {
  key: string;
  variant: Variant;
  condition: Condition;
  qty: number;
  addedAt: number;
  /** the set binder the card goes in */
  setId: string;
}
export interface ImportResult {
  found: Found[];
  missing: (ImportLine & { why: "set" | "card" | "lang" })[];
  /** sets of the cards found, the biggest first; `binder`: it can have a set binder (extra sets can't) */
  sets: { setId: string; name: string; copies: number; binder: boolean }[];
}

/** The CSV's rows (quotes, ";" and line breaks in quotes handled) */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ";") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.length > 1 || row[0]) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const head = rows.shift() ?? [];
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

/** Looks like a Pokécardex export: its columns are there */
export const isPokecardex = (rows: Record<string, string>[]) => rows.length > 0 && ["Serie", "Numero", "Version", "Quantite"].every((k) => k in rows[0]);

const norm = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ᵉ/g, "e")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
let byName: Map<string, string> | null = null;
/** the TCGdex id of a Pokécardex set name (French sets, extra ones included) */
function setIdOf(name: string) {
  byName ??= new Map(catalog("fr").map((s) => [norm(s.name), s.id]));
  return ALIAS[name] ?? byName.get(norm(name)) ?? null;
}
/** "001/128" -> "1", "SWSH001" -> "SWSH1", "TG05/TG30" -> "TG5" */
const numKey = (n: string) => n.split("/")[0].trim().toUpperCase().replace(/(\D*)0+(?=\d)/, "$1");

function variantOf(version: string, card: CardData): Variant {
  const want: Variant = /^reverse/i.test(version) ? "reverse" : /holo/i.test(version) ? "holo" : "normal";
  if (card.variants.includes(want)) return want;
  // a plain print TCGdex only lists as holo (or the other way round): its only variant
  return want === "reverse" && card.variants.length > 1 ? card.variants[card.variants.length - 1] : card.variants[0];
}

/** Finds each line's card (downloading the sets it needs). */
export async function matchImport(rows: Record<string, string>[], onProgress?: (done: number, total: number) => void): Promise<ImportResult> {
  const found: Found[] = [];
  const missing: ImportResult["missing"] = [];
  const lines = rows.map((r) => ({ r, line: { set: r.Serie, number: r.Numero, name: r.Nom, qty: Math.max(1, Number(r.Quantite) || 1) } }));
  // the sets to download, each once
  const keys = new Set<string>();
  for (const { r } of lines) {
    const id = setIdOf(r.Serie);
    const lang = LANG[r.Langue?.toUpperCase() ?? "FR"] ?? null;
    if (id && lang) keys.add(keyOf(lang, id));
  }
  const sets = new Map<string, CardData[]>();
  let done = 0;
  await Promise.all(
    [...keys].map(async (key) => {
      try {
        sets.set(key, (await loadSet(key)).cards);
      } catch {
        sets.set(key, []);
      }
      onProgress?.(++done, keys.size);
    }),
  );
  for (const { r, line } of lines) {
    const lang = LANG[r.Langue?.toUpperCase() ?? "FR"];
    if (!lang) {
      missing.push({ ...line, why: "lang" });
      continue;
    }
    const id = setIdOf(r.Serie);
    if (!id) {
      missing.push({ ...line, why: "set" });
      continue;
    }
    const setId = keyOf(lang, id);
    const want = numKey(r.Numero);
    const card = sets.get(setId)?.find((c) => numKey(c.num) === want);
    if (!card) {
      missing.push({ ...line, why: "card" });
      continue;
    }
    const added = Date.parse((r["Date ajout"] ?? "").replace(" ", "T"));
    found.push({
      key: card.id,
      variant: variantOf(r.Version ?? "", card),
      condition: CONDITION[r.Etat] ?? "NM",
      qty: line.qty,
      addedAt: Number.isFinite(added) ? added : Date.now(),
      setId,
    });
  }
  const bySet = new Map<string, number>();
  found.forEach((f) => bySet.set(f.setId, (bySet.get(f.setId) ?? 0) + f.qty));
  const setList = [...bySet]
    .map(([setId, copies]) => {
      const set = catalogSet(setId);
      return { setId, name: set?.name ?? setId, copies, binder: !!set && !set.extra };
    })
    .sort((a, b) => b.copies - a.copies);
  return { found, missing, sets: setList };
}
