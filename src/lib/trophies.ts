"use client";

import { MAX_BINDERS, PER_PAGE, pocketsOf } from "./binders";
import { langOfKey } from "./cardLang";
import { catalogSet, setIdOfCard } from "./catalog";
import { collectionTotals, priceOf, setStats } from "./price";
import { rankOf, sortCards } from "./rarity";
import type { CardData, Copy, SetData, UserBinder } from "./types";

export type TrophyTier = "bronze" | "silver" | "gold" | "platinum";
export type TrophyCat = "collection" | "binders" | "treasures" | "pokemon" | "desk" | "secret";

/** What a tier is worth in the trainer's score. */
export const TIER_POINTS: Record<TrophyTier, number> = { bronze: 10, silver: 25, gold: 50, platinum: 100 };

export const CATS: { id: TrophyCat; fr: string; en: string }[] = [
  { id: "collection", fr: "Collection", en: "Collection" },
  { id: "binders", fr: "Classeurs", en: "Binders" },
  { id: "treasures", fr: "Trésors", en: "Treasures" },
  { id: "pokemon", fr: "Pokémon", en: "Pokémon" },
  { id: "desk", fr: "Le bureau", en: "The desk" },
  { id: "secret", fr: "Secrets", en: "Secrets" },
];

/** What the collection says, worked out once for every trophy to read. */
export interface Facts {
  distinct: number;
  maxQty: number;
  reverse: boolean;
  langs: number;
  vintage: boolean;
  bestRank: number;
  /** the dearest card owned, in the player's money */
  bestPrice: number;
  value: number;
  paid: boolean;
  pulled: boolean;
  /** a copy worth 3x what it cost */
  flip: boolean;
  /** best share of one set binder owned (0-1) */
  setPct: number;
  master: boolean;
  fullPage: boolean;
  binders: number;
  freeBinder: boolean;
  /** names of the Pokémon owned, lower case, no accents (Japanese cards: their French and English names) */
  names: string;
  signedIn: boolean;
}

export interface Trophy {
  id: string;
  tier: TrophyTier;
  cat: TrophyCat;
  name: { fr: string; en: string };
  /** "{50}" is written in the player's money */
  desc: { fr: string; en: string };
  /** hidden ("???") until won */
  secret?: boolean;
  /** won by the collection itself; without it, a gesture in the room wins it */
  test?: (f: Facts) => boolean;
}

const has = (f: Facts, ...names: string[]) => names.every((n) => new RegExp(`\\b${n}\\b`).test(f.names));

export const TROPHIES: Trophy[] = [
  // Collection
  { id: "first-card", tier: "bronze", cat: "collection", name: { fr: "Première carte", en: "First card" }, desc: { fr: "Range ta toute première carte.", en: "Put away your very first card." }, test: (f) => f.distinct >= 1 },
  { id: "cards-10", tier: "bronze", cat: "collection", name: { fr: "Petite pile", en: "Small pile" }, desc: { fr: "10 cartes différentes.", en: "10 different cards." }, test: (f) => f.distinct >= 10 },
  { id: "cards-50", tier: "silver", cat: "collection", name: { fr: "Ça prend forme", en: "Taking shape" }, desc: { fr: "50 cartes différentes.", en: "50 different cards." }, test: (f) => f.distinct >= 50 },
  { id: "cards-151", tier: "silver", cat: "collection", name: { fr: "Les 151", en: "The original 151" }, desc: { fr: "151 cartes différentes, comme le tout premier Pokédex.", en: "151 different cards, like the very first Pokédex." }, test: (f) => f.distinct >= 151 },
  { id: "cards-500", tier: "gold", cat: "collection", name: { fr: "Mur de cartes", en: "Wall of cards" }, desc: { fr: "500 cartes différentes.", en: "500 different cards." }, test: (f) => f.distinct >= 500 },
  { id: "cards-1000", tier: "platinum", cat: "collection", name: { fr: "Archiviste", en: "Archivist" }, desc: { fr: "1 000 cartes différentes. Respect.", en: "1,000 different cards. Respect." }, test: (f) => f.distinct >= 1000 },
  { id: "double", tier: "bronze", cat: "collection", name: { fr: "Doublon", en: "Double" }, desc: { fr: "Deux exemplaires de la même carte.", en: "Two copies of the same card." }, test: (f) => f.maxQty >= 2 },
  { id: "playset", tier: "silver", cat: "collection", name: { fr: "Playset", en: "Playset" }, desc: { fr: "4 exemplaires d'une même carte : de quoi faire un deck.", en: "4 copies of one card: enough for a deck." }, test: (f) => f.maxQty >= 4 },
  { id: "reverse", tier: "bronze", cat: "collection", name: { fr: "Reflets", en: "Reverse shine" }, desc: { fr: "Une carte en version reverse.", en: "A card in its reverse holo version." }, test: (f) => f.reverse },
  { id: "bilingual", tier: "bronze", cat: "collection", name: { fr: "Bilingue", en: "Bilingual" }, desc: { fr: "Des cartes dans deux langues.", en: "Cards in two languages." }, test: (f) => f.langs >= 2 },
  { id: "polyglot", tier: "silver", cat: "collection", name: { fr: "Polyglotte", en: "Polyglot" }, desc: { fr: "Des cartes en français, en anglais et en japonais.", en: "Cards in French, English and Japanese." }, test: (f) => f.langs >= 3 },
  { id: "vintage", tier: "silver", cat: "collection", name: { fr: "Vintage", en: "Vintage" }, desc: { fr: "Une carte sortie avant 2004.", en: "A card released before 2004." }, test: (f) => f.vintage },

  // Binders
  { id: "first-binder", tier: "bronze", cat: "binders", name: { fr: "Premier classeur", en: "First binder" }, desc: { fr: "Pose ton premier classeur sur l'étagère.", en: "Put your first binder on the shelf." }, test: (f) => f.binders >= 1 },
  { id: "free-binder", tier: "bronze", cat: "binders", name: { fr: "Classeur libre", en: "Free spirit" }, desc: { fr: "Crée un classeur libre, rangé à ta façon.", en: "Make a free binder, sorted your way." }, test: (f) => f.freeBinder },
  { id: "first-page", tier: "bronze", cat: "binders", name: { fr: "Première page", en: "First page" }, desc: { fr: "Une page entière de 9 cartes.", en: "A full page of 9 cards." }, test: (f) => f.fullPage },
  { id: "set-25", tier: "bronze", cat: "binders", name: { fr: "Bon début", en: "Good start" }, desc: { fr: "Un quart d'une extension.", en: "A quarter of a set." }, test: (f) => f.setPct >= 0.25 },
  { id: "set-50", tier: "silver", cat: "binders", name: { fr: "À mi-chemin", en: "Halfway there" }, desc: { fr: "La moitié d'une extension.", en: "Half of a set." }, test: (f) => f.setPct >= 0.5 },
  { id: "set-100", tier: "gold", cat: "binders", name: { fr: "Classeur complet", en: "Complete binder" }, desc: { fr: "Toutes les cartes d'une extension.", en: "Every card of a set." }, test: (f) => f.setPct >= 1 },
  { id: "master-set", tier: "platinum", cat: "binders", name: { fr: "Master set", en: "Master set" }, desc: { fr: "Toutes les cartes d'une extension, dans toutes leurs versions.", en: "Every card of a set, in every version." }, test: (f) => f.master },
  { id: "shelf-6", tier: "silver", cat: "binders", name: { fr: "Étagère du haut", en: "Top shelf" }, desc: { fr: "6 classeurs sur l'étagère.", en: "6 binders on the shelf." }, test: (f) => f.binders >= 6 },
  { id: "shelf-full", tier: "gold", cat: "binders", name: { fr: "Plus de place !", en: "No room left!" }, desc: { fr: "L'étagère est pleine.", en: "The shelf is full." }, test: (f) => f.binders >= MAX_BINDERS },
  { id: "decorator", tier: "bronze", cat: "binders", name: { fr: "Décorateur", en: "Decorator" }, desc: { fr: "Change la couleur d'un classeur.", en: "Change a binder's colour." } },
  { id: "sorter", tier: "bronze", cat: "binders", name: { fr: "Bien rangé", en: "Neat and tidy" }, desc: { fr: "Range un classeur autrement (rareté, prix, nom).", en: "Sort a binder another way (rarity, price, name)." } },

  // Treasures
  { id: "art-rare", tier: "silver", cat: "treasures", name: { fr: "Œuvre d'art", en: "Work of art" }, desc: { fr: "Une illustration rare.", en: "An illustration rare." }, test: (f) => f.bestRank >= 8 },
  { id: "sir", tier: "gold", cat: "treasures", name: { fr: "Chef-d'œuvre", en: "Masterpiece" }, desc: { fr: "Une illustration spéciale rare.", en: "A special illustration rare." }, test: (f) => f.bestRank >= 10 },
  { id: "gold-card", tier: "gold", cat: "treasures", name: { fr: "Tout ce qui brille", en: "All that glitters" }, desc: { fr: "Une hyper rare (une carte dorée).", en: "A hyper rare (a gold card)." }, test: (f) => f.bestRank >= 11 },
  { id: "card-50", tier: "silver", cat: "treasures", name: { fr: "Pépite", en: "Nugget" }, desc: { fr: "Une carte qui vaut {50} ou plus.", en: "A card worth {50} or more." }, test: (f) => f.bestPrice >= 50 },
  { id: "card-200", tier: "gold", cat: "treasures", name: { fr: "Gros poisson", en: "Big fish" }, desc: { fr: "Une carte qui vaut {200} ou plus.", en: "A card worth {200} or more." }, test: (f) => f.bestPrice >= 200 },
  { id: "value-100", tier: "bronze", cat: "treasures", name: { fr: "Tirelire", en: "Piggy bank" }, desc: { fr: "Une collection qui vaut {100}.", en: "A collection worth {100}." }, test: (f) => f.value >= 100 },
  { id: "value-1000", tier: "gold", cat: "treasures", name: { fr: "Coffre-fort", en: "Vault" }, desc: { fr: "Une collection qui vaut {1000}.", en: "A collection worth {1000}." }, test: (f) => f.value >= 1000 },
  { id: "value-10000", tier: "platinum", cat: "treasures", name: { fr: "Dragon sur son trésor", en: "Dragon's hoard" }, desc: { fr: "Une collection qui vaut {10000}.", en: "A collection worth {10000}." }, test: (f) => f.value >= 10000 },
  { id: "bookkeeper", tier: "bronze", cat: "treasures", name: { fr: "Comptable", en: "Bookkeeper" }, desc: { fr: "Note le prix payé d'une carte.", en: "Write down what a card cost you." }, test: (f) => f.paid },
  { id: "pulled", tier: "bronze", cat: "treasures", name: { fr: "Tout frais du booster", en: "Fresh pull" }, desc: { fr: "Une carte tirée d'un booster (payée 0).", en: "A card pulled from a booster (paid 0)." }, test: (f) => f.pulled },
  { id: "flip", tier: "gold", cat: "treasures", name: { fr: "Flair de trader", en: "Trader's nose" }, desc: { fr: "Une carte qui vaut 3 fois ce que tu l'as payée.", en: "A card worth 3 times what you paid." }, test: (f) => f.flip },
  { id: "combo", tier: "silver", cat: "treasures", name: { fr: "Combo x10", en: "Combo x10" }, desc: { fr: "10 cartes rangées d'affilée, sans souffler.", en: "10 cards put away in a row, without a break." } },

  // Pokémon (names in French, English, and the Japanese cards' "aka")
  { id: "pikachu", tier: "bronze", cat: "pokemon", name: { fr: "Pika pika !", en: "Pika pika!" }, desc: { fr: "Un Pikachu.", en: "A Pikachu." }, test: (f) => has(f, "pikachu") },
  { id: "charizard", tier: "silver", cat: "pokemon", name: { fr: "Dracaufeu !", en: "Charizard!" }, desc: { fr: "Le rêve de toutes les cours de récré.", en: "Every playground's dream." }, test: (f) => has(f, "dracaufeu") || has(f, "charizard") },
  { id: "starters", tier: "silver", cat: "pokemon", name: { fr: "Le choix du prof", en: "Professor's pick" }, desc: { fr: "Bulbizarre, Salamèche et Carapuce.", en: "Bulbasaur, Charmander and Squirtle." }, test: (f) => has(f, "bulbizarre", "salameche", "carapuce") || has(f, "bulbasaur", "charmander", "squirtle") },
  { id: "birds", tier: "silver", cat: "pokemon", name: { fr: "Trio légendaire", en: "Legendary trio" }, desc: { fr: "Artikodin, Électhor et Sulfura.", en: "Articuno, Zapdos and Moltres." }, test: (f) => has(f, "artikodin", "electhor", "sulfura") || has(f, "articuno", "zapdos", "moltres") },
  {
    id: "eevee", tier: "gold", cat: "pokemon", name: { fr: "Famille Évoli", en: "Eevee family" },
    desc: { fr: "Évoli et ses 8 évolutions.", en: "Eevee and its 8 evolutions." },
    test: (f) =>
      has(f, "evoli", "aquali", "voltali", "pyroli", "mentali", "noctali", "phyllali", "givrali", "nymphali") ||
      has(f, "eevee", "vaporeon", "jolteon", "flareon", "espeon", "umbreon", "leafeon", "glaceon", "sylveon"),
  },
  { id: "magikarp", tier: "bronze", cat: "pokemon", secret: true, name: { fr: "Magicarpe utilise Trempette", en: "Magikarp used Splash" }, desc: { fr: "… mais rien ne se passe.", en: "… but nothing happened." }, test: (f) => has(f, "magicarpe") || has(f, "magikarp") },
  { id: "mew", tier: "silver", cat: "pokemon", secret: true, name: { fr: "Sous le camion", en: "Under the truck" }, desc: { fr: "Un Mew. La légende de la cour d'école était vraie.", en: "A Mew. The schoolyard legend was true." }, test: (f) => has(f, "mew") },

  // The desk
  { id: "radio", tier: "bronze", cat: "desk", name: { fr: "Lofi & chill", en: "Lofi & chill" }, desc: { fr: "Allume la radio.", en: "Turn on the radio." } },
  { id: "pet", tier: "bronze", cat: "desk", name: { fr: "Gratouilles", en: "Head scratches" }, desc: { fr: "Caresse Warwick.", en: "Pet Warwick." } },
  { id: "os", tier: "bronze", cat: "desk", name: { fr: "Hacker", en: "Hacker" }, desc: { fr: "Démarre NookDex OS.", en: "Boot NookDex OS." } },
  { id: "blog", tier: "bronze", cat: "desk", name: { fr: "Toujours au courant", en: "In the know" }, desc: { fr: "Lis le tableau en liège (le blog).", en: "Read the cork board (the blog)." } },
  { id: "about", tier: "bronze", cat: "desk", name: { fr: "Curieux", en: "Curious" }, desc: { fr: "Ouvre le carnet de Johan.", en: "Open Johan's notebook." } },
  { id: "cloud", tier: "bronze", cat: "desk", name: { fr: "Dans les nuages", en: "Up in the clouds" }, desc: { fr: "Une sauvegarde en ligne, avec ton compte.", en: "An online save, with your account." }, test: (f) => f.signedIn },
  { id: "share", tier: "silver", cat: "desk", name: { fr: "Fier de mon classeur", en: "Show-off" }, desc: { fr: "Partage un classeur.", en: "Share a binder." } },
  { id: "days-7", tier: "silver", cat: "desk", name: { fr: "Habitué", en: "Regular" }, desc: { fr: "Passe au bureau 7 jours différents.", en: "Come to the desk on 7 different days." } },
  { id: "days-30", tier: "gold", cat: "desk", name: { fr: "Comme à la maison", en: "Home sweet home" }, desc: { fr: "Passe au bureau 30 jours différents.", en: "Come to the desk on 30 different days." } },

  // Secrets: no hint but "???" until found
  { id: "night-owl", tier: "silver", cat: "secret", secret: true, name: { fr: "Oiseau de nuit", en: "Night owl" }, desc: { fr: "Au bureau entre minuit et 5 h.", en: "At the desk between midnight and 5 am." } },
  { id: "moonlight", tier: "bronze", cat: "secret", secret: true, name: { fr: "Au clair de lune", en: "By moonlight" }, desc: { fr: "Éteins la lampe en pleine nuit.", en: "Switch the lamp off in the dead of night." } },
  { id: "rainbow", tier: "bronze", cat: "secret", secret: true, name: { fr: "Arc-en-ciel", en: "Rainbow" }, desc: { fr: "Toutes les couleurs de la lampe à lave.", en: "Every colour of the lava lamp." } },
  { id: "weather", tier: "silver", cat: "secret", secret: true, name: { fr: "Maître du temps", en: "Weather master" }, desc: { fr: "Jour, nuit, jour, nuit… 10 fois de suite.", en: "Day, night, day, night… 10 times in a row." } },
  { id: "pet-20", tier: "silver", cat: "secret", secret: true, name: { fr: "Warwick t'adore", en: "Warwick adores you" }, desc: { fr: "20 caresses. Il ronronne encore.", en: "20 pets. He's still purring." } },
  { id: "xylophone", tier: "silver", cat: "secret", secret: true, name: { fr: "Xylophoniste", en: "Xylophonist" }, desc: { fr: "Une gamme sur le dos des classeurs.", en: "A scale played on the binders' spines." } },
  { id: "konami", tier: "gold", cat: "secret", secret: true, name: { fr: "↑↑↓↓←→←→BA", en: "↑↑↓↓←→←→BA" }, desc: { fr: "Le code des anciens.", en: "The elders' code." } },
  { id: "treat", tier: "gold", cat: "secret", secret: true, name: { fr: "Un bonbon pour Warwick", en: "A treat for Warwick" }, desc: { fr: "Merci de soutenir NookDex ♥", en: "Thank you for supporting NookDex ♥" } },

  // The big one: every trophy that isn't a secret
  { id: "all", tier: "platinum", cat: "collection", name: { fr: "Attrapez-les tous", en: "Gotta catch 'em all" }, desc: { fr: "Tous les trophées (sauf les secrets).", en: "Every trophy (secrets aside)." } },
];

export const TROPHY = new Map(TROPHIES.map((t) => [t.id, t]));

const TIER_ORDER: TrophyTier[] = ["bronze", "silver", "gold", "platinum"];
export const tierRank = (t: TrophyTier) => TIER_ORDER.indexOf(t);

/** lower case, no accents: "Électhor" -> "electhor" */
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface Input {
  collection: Record<string, Copy[]>;
  binders: UserBinder[];
  cards: Record<string, CardData>;
  sets: Record<string, SetData>;
  signedIn: boolean;
}

export function factsOf({ collection, binders, cards, sets, signedIn }: Input): Facts {
  const f: Facts = {
    distinct: 0, maxQty: 0, reverse: false, langs: 0, vintage: false, bestRank: -1, bestPrice: 0, value: 0, paid: false,
    pulled: false, flip: false, setPct: 0, master: false, fullPage: false, binders: binders.length,
    freeBinder: binders.some((b) => b.kind === "free"), names: "", signedIn,
  };
  const langs = new Set<string>();
  const names: string[] = [];
  for (const [id, copies] of Object.entries(collection)) {
    if (!copies.length) continue;
    f.distinct++;
    langs.add(langOfKey(id));
    f.maxQty = Math.max(f.maxQty, copies.reduce((n, c) => n + c.qty, 0));
    const release = catalogSet(setIdOfCard(id) ?? "")?.releaseDate;
    if (release && release < "2004") f.vintage = true;
    const card = cards[id];
    for (const c of copies) {
      if (c.variant === "reverse") f.reverse = true;
      if (c.paid === 0) f.pulled = true;
      if (c.paid != null && c.paid > 0) f.paid = true;
      if (!card) continue;
      const worth = priceOf(card, c.variant, "trend");
      if (worth == null) continue;
      f.bestPrice = Math.max(f.bestPrice, worth);
      if (c.paid && worth >= 5 && worth >= c.paid * 3) f.flip = true;
    }
    if (!card) continue;
    f.bestRank = Math.max(f.bestRank, rankOf(card.rarity));
    names.push(plain(card.name), plain(card.aka ?? ""));
  }
  f.langs = langs.size;
  f.names = names.join(" | ");
  f.value = collectionTotals(collection, cards, []).trend;

  for (const b of binders) {
    if (b.kind === "free") {
      const pockets = pocketsOf(b.id, collection);
      const pages = new Set([...pockets.keys()].map((p) => Math.floor(p / PER_PAGE)));
      for (const pg of pages) {
        if (Array.from({ length: PER_PAGE }, (_, k) => pockets.has(pg * PER_PAGE + k)).every(Boolean)) f.fullPage = true;
      }
      continue;
    }
    const set = sets[b.setId];
    if (!set?.cards.length) continue;
    const st = setStats(set, collection);
    f.setPct = Math.max(f.setPct, st.owned / st.total);
    if (st.masterTotal && st.masterOwned >= st.masterTotal) f.master = true;
    const sorted = sortCards(set.cards, b.sort ?? "num");
    for (let i = 0; i + PER_PAGE <= sorted.length && !f.fullPage; i += PER_PAGE) {
      if (sorted.slice(i, i + PER_PAGE).every((c) => collection[c.id]?.length)) f.fullPage = true;
    }
  }
  return f;
}

/** Trophies the collection wins, "all" included once every other one is in. */
export function earned(f: Facts, got: Record<string, number>): string[] {
  const out = TROPHIES.filter((t) => t.test?.(f) && !got[t.id]).map((t) => t.id);
  const won = new Set([...Object.keys(got), ...out]);
  if (!won.has("all") && TROPHIES.every((t) => t.secret || t.id === "all" || won.has(t.id))) out.push("all");
  return out;
}
