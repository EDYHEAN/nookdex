// What the NookBoy survival game is made of: the Pokémon, the starters, the moves and held items won on level-up, the waves.
// Numbers are in game pixels (the screen is 320x288) and seconds.

export type Lang = "fr" | "en";
export type Txt = [string, string];
export const say = (t: Txt, lang: Lang) => (lang === "fr" ? t[0] : t[1]);

/** French and English names of every Pokémon in the game (dex number) */
export const NAMES: Record<number, Txt> = {
  1: ["Bulbizarre", "Bulbasaur"], 2: ["Herbizarre", "Ivysaur"], 3: ["Florizarre", "Venusaur"],
  4: ["Salamèche", "Charmander"], 5: ["Reptincel", "Charmeleon"], 6: ["Dracaufeu", "Charizard"],
  7: ["Carapuce", "Squirtle"], 8: ["Carabaffe", "Wartortle"], 9: ["Tortank", "Blastoise"],
  10: ["Chenipan", "Caterpie"], 13: ["Aspicot", "Weedle"], 16: ["Roucool", "Pidgey"], 19: ["Rattata", "Rattata"],
  20: ["Rattatac", "Raticate"], 21: ["Piafabec", "Spearow"], 22: ["Rapasdepic", "Fearow"], 23: ["Abo", "Ekans"],
  24: ["Arbok", "Arbok"], 25: ["Pikachu", "Pikachu"], 26: ["Raichu", "Raichu"], 27: ["Sabelette", "Sandshrew"],
  29: ["Nidoran♀", "Nidoran♀"], 32: ["Nidoran♂", "Nidoran♂"], 41: ["Nosferapti", "Zubat"], 42: ["Nosferalto", "Golbat"],
  43: ["Mystherbe", "Oddish"], 52: ["Miaouss", "Meowth"], 54: ["Psykokwak", "Psyduck"], 56: ["Férosinge", "Mankey"],
  58: ["Caninos", "Growlithe"], 66: ["Machoc", "Machop"], 74: ["Racaillou", "Geodude"], 75: ["Gravalanche", "Graveler"],
  81: ["Magnéti", "Magnemite"], 92: ["Fantominus", "Gastly"], 93: ["Spectrum", "Haunter"], 94: ["Ectoplasma", "Gengar"],
  95: ["Onix", "Onix"], 100: ["Voltorbe", "Voltorb"], 104: ["Osselait", "Cubone"], 109: ["Smogo", "Koffing"],
  111: ["Rhinocorne", "Rhyhorn"], 113: ["Leveinard", "Chansey"], 123: ["Insécateur", "Scyther"], 128: ["Tauros", "Tauros"],
  129: ["Magicarpe", "Magikarp"], 130: ["Léviator", "Gyarados"], 143: ["Ronflex", "Snorlax"], 144: ["Artikodin", "Articuno"],
  145: ["Électhor", "Zapdos"], 146: ["Sulfura", "Moltres"], 149: ["Dracolosse", "Dragonite"], 150: ["Mewtwo", "Mewtwo"], 151: ["Mew", "Mew"],
  15: ["Dardargnan", "Beedrill"], 59: ["Arcanin", "Arcanine"], 65: ["Alakazam", "Alakazam"], 68: ["Mackogneur", "Machamp"],
  76: ["Grolem", "Golem"], 89: ["Grotadmorv", "Muk"], 112: ["Rhinoféros", "Rhydon"], 142: ["Ptéra", "Aerodactyl"],
  352: ["Kecleon", "Kecleon"],
  // the daily challenge's Pokémon and foes (lib/game/defi)
  17: ["Roucoups", "Pidgeotto"], 18: ["Roucarnage", "Pidgeot"], 28: ["Sablaireau", "Sandslash"], 37: ["Goupix", "Vulpix"], 38: ["Feunard", "Ninetales"],
  39: ["Rondoudou", "Jigglypuff"], 40: ["Grodoudou", "Wigglytuff"], 53: ["Persian", "Persian"], 60: ["Ptitard", "Poliwag"], 61: ["Têtarte", "Poliwhirl"],
  62: ["Tartard", "Poliwrath"], 63: ["Abra", "Abra"], 64: ["Kadabra", "Kadabra"], 67: ["Machopeur", "Machoke"], 72: ["Tentacool", "Tentacool"],
  73: ["Tentacruel", "Tentacruel"], 77: ["Ponyta", "Ponyta"], 78: ["Galopa", "Rapidash"], 79: ["Ramoloss", "Slowpoke"], 80: ["Flagadoss", "Slowbro"],
  82: ["Magnéton", "Magneton"], 83: ["Canarticho", "Farfetch'd"], 84: ["Doduo", "Doduo"], 85: ["Dodrio", "Dodrio"], 86: ["Otaria", "Seel"],
  87: ["Lamantine", "Dewgong"], 88: ["Tadmorv", "Grimer"], 90: ["Kokiyas", "Shellder"], 91: ["Crustabri", "Cloyster"], 96: ["Soporifik", "Drowzee"],
  97: ["Hypnomade", "Hypno"], 98: ["Krabby", "Krabby"], 99: ["Krabboss", "Kingler"], 101: ["Électrode", "Electrode"], 102: ["Noeunoeuf", "Exeggcute"],
  103: ["Noadkoko", "Exeggutor"], 108: ["Excelangue", "Lickitung"], 110: ["Smogogo", "Weezing"], 116: ["Hypotrempe", "Horsea"], 117: ["Hypocéan", "Seadra"],
  118: ["Poissirène", "Goldeen"], 119: ["Poissoroy", "Seaking"], 120: ["Stari", "Staryu"], 121: ["Staross", "Starmie"], 122: ["M. Mime", "Mr. Mime"],
  124: ["Lippoutou", "Jynx"], 125: ["Élektek", "Electabuzz"], 126: ["Magmar", "Magmar"], 131: ["Lokhlass", "Lapras"], 132: ["Métamorph", "Ditto"],
  133: ["Évoli", "Eevee"], 134: ["Aquali", "Vaporeon"], 135: ["Voltali", "Jolteon"], 136: ["Pyroli", "Flareon"], 137: ["Porygon", "Porygon"],
  138: ["Amonita", "Omanyte"], 139: ["Amonistar", "Omastar"], 141: ["Kabutops", "Kabutops"], 147: ["Minidraco", "Dratini"], 148: ["Draco", "Dragonair"],
  // forms get a number of their own: 10000 + the dex number
  10150: ["Méga-Mewtwo Y", "Mega Mewtwo Y"], 10094: ["Méga-Ectoplasma", "Mega Gengar"], 10006: ["Méga-Dracaufeu X", "Mega Charizard X"],
  10065: ["Méga-Alakazam", "Mega Alakazam"], 10080: ["Méga-Flagadoss", "Mega Slowbro"], 10115: ["Méga-Kangourex", "Mega Kangaskhan"],
  10142: ["Méga-Ptéra", "Mega Aerodactyl"],
  // the starters to unlock
  33: ["Nidorino", "Nidorino"], 34: ["Nidoking", "Nidoking"], 173: ["Mélo", "Cleffa"], 35: ["Mélofée", "Clefairy"], 36: ["Mélodelfe", "Clefable"],
};

export type BasicKind = "whip" | "ember" | "water" | "bolt" | "psycut" | "shadowball"
  // the daily challenge's Pokémon (lib/game/defi)
  | "swift" | "icy" | "splash" | "punch" | "slam" | "psyorb"
  // the starters to unlock
  | "jab" | "rock" | "fairy" | "dragon";
export type Basic = { kind: BasicKind; name: Txt; every: number; dmg: number };
/** what a Pokémon does on its own, outside the 4 slots: Mewtwo, Gengar, each Pokémon of the daily challenge, the starters to unlock */
export type Sig = "psystrike" | "phantom" | "adapt" | "speed" | "ere" | "rage" | "counter" | "rest" | "teleport"
  | "poisonpoint" | "rollout" | "wish" | "dragondance";
/** what opens a starter: a wave reached (with one starter, or any), or daily challenges won (on as many days) */
export type Unlock = { wave: number; with?: number } | { defis: number };

export interface Starter {
  dex: number;
  /** evolutions: [dex, level] */
  evolves: [number, number][];
  hp: number;
  speed: number;
  basic: Basic;
  /** a basic attack that changes with the evolution (Eevee's three, Gyarados's): by dex */
  evoBasic?: Record<number, Basic>;
  blurb: Txt;
  type: Elem;
  /** only for the players given this reward (game_rewards) */
  reward?: string;
  /** stronger from the start, and more with each level: damage x power x (1 + growth per level) */
  power?: number;
  growth?: number;
  /** max HP won per level (2 by default) */
  hpPerLevel?: number;
  /** a move of its own, always there, outside the 4 slots */
  sig?: Sig;
  /** that move, told on the daily challenge's screen (and the starter screen) */
  talent?: { name: Txt; desc: Txt };
  /** a starter to unlock: what opens it (shown as a silhouette until then) */
  unlock?: Unlock;
  /** damage taken, x (Geodude's rock body) */
  armor?: number;
}

export type Elem =
  | "grass" | "fire" | "water" | "elec" | "ice" | "ghost" | "ground" | "psy" | "normal" | "fly" | "dragon" | "poison" | "fight"
  // 2026-10-17: Fairy charms, Dark makes foes flinch, Steel and Bug for their combos
  | "fairy" | "steel" | "dark" | "bug";

/** how rare a level-up card is: the rarer, the less often it comes up (and the stronger) */
export type Rarity = "common" | "rare" | "epic" | "legendary";
export const RARITY: Record<Rarity, { weight: number; name: Txt }> = {
  common: { weight: 1, name: ["commune", "common"] },
  rare: { weight: 0.6, name: ["rare", "rare"] },
  epic: { weight: 0.3, name: ["épique", "epic"] },
  legendary: { weight: 0.12, name: ["légendaire", "legendary"] },
};

export const STARTERS: Starter[] = [
  {
    dex: 1,
    evolves: [[2, 12], [3, 26]],
    hp: 125,
    speed: 60,
    basic: { kind: "whip", name: ["Fouet Lianes", "Vine Whip"], every: 0.75, dmg: 15 },
    blurb: ["Costaud. Fouette tout ce qui approche.", "Sturdy. Whips whatever comes close."],
    type: "grass",
  },
  {
    dex: 4,
    evolves: [[5, 12], [6, 26]],
    hp: 95,
    speed: 66,
    basic: { kind: "ember", name: ["Flammèche", "Ember"], every: 0.6, dmg: 12 },
    blurb: ["Boules de feu qui éclatent à l'impact.", "Fireballs that burst on impact."],
    type: "fire",
  },
  {
    dex: 7,
    evolves: [[8, 12], [9, 26]],
    hp: 110,
    speed: 62,
    basic: { kind: "water", name: ["Pistolet à O", "Water Gun"], every: 0.42, dmg: 6 },
    blurb: ["Jets rapides qui repoussent et transpercent.", "Quick jets that push back and pierce."],
    type: "water",
  },
  {
    dex: 25,
    evolves: [[26, 20]],
    hp: 85,
    speed: 76,
    basic: { kind: "bolt", name: ["Éclair", "Thunder Shock"], every: 0.62, dmg: 10 },
    blurb: ["Rapide et fragile. L'éclair rebondit.", "Fast and frail. The shock chains."],
    type: "elec",
  },
];

/**
 * Mewtwo, a character of its own for the players given it (Johan, 2026-10-13: godlike, from the start and over time):
 * piercing psychic blades, Psystrike sweeping the whole screen every few seconds, more HP, and damage that grows with
 * every level; Mega Mewtwo Y at level 16. Never in the daily challenge (the same for all).
 */
export const MEWTWO: Starter = {
  dex: 150,
  evolves: [[10150, 16]],
  hp: 170,
  speed: 76,
  basic: { kind: "psycut", name: ["Coupe Psycho", "Psycho Cut"], every: 0.4, dmg: 15 },
  blurb: ["Légendaire. Lames psychiques, et Frappe Psy balaie tout l'écran.", "Legendary. Psychic blades, and Psystrike sweeps the whole screen."],
  type: "psy",
  reward: "skin-mewtwo",
  power: 1.35,
  growth: 0.03,
  hpPerLevel: 5,
  sig: "psystrike",
};

/**
 * Gengar, the same deal for the players given it (Johan, 2026-10-14: godlike too, with moves of its own): Shadow Balls
 * that home in, Phantom Force (it sinks into the shadows, untouchable, then bursts out and puts the survivors to sleep:
 * asleep + Ghost is the nightmare combo), Curse (each foe it knocks out sends a wisp at the next one); Mega Gengar at 16,
 * whose Shadow Tag slows every foe close to it. Never in the daily challenge.
 */
export const GENGAR: Starter = {
  dex: 94,
  evolves: [[10094, 16]],
  hp: 155,
  speed: 80,
  basic: { kind: "shadowball", name: ["Ball'Ombre", "Shadow Ball"], every: 0.45, dmg: 13 },
  blurb: ["Légendaire. Hantise, Malédiction : chaque K.O. en hante un autre.", "Legendary. Phantom Force, Curse: each knockout haunts another."],
  type: "ghost",
  reward: "skin-gengar",
  power: 1.35,
  growth: 0.03,
  hpPerLevel: 5,
  sig: "phantom",
};

/** the characters given by hand (game_rewards), after the four starters on the select screen */
export const REWARD_STARTERS: Starter[] = [MEWTWO, GENGAR];

/**
 * Four more starters, won by playing (Johan, 2026-10-19), of types the first four don't cover; none of the daily
 * challenge's Pokémon nor the rewards. Each has its basic attack, a talent of its own and evolves mid-run. On the starter
 * screen's second row, a silhouette with what opens it until then. Their progress rides in the Pension's levels
 * (pensionStore: `w<dex>` the best wave with a starter, `defis` the days a daily challenge was won).
 */
export const UNLOCK_STARTERS: Starter[] = [
  {
    // in the thick of it: every blow poisons, and the poisoned hit it less
    dex: 32,
    evolves: [[33, 12], [34, 26]],
    hp: 130,
    speed: 62,
    hpPerLevel: 3,
    basic: { kind: "jab", name: ["Direct Toxik", "Poison Jab"], every: 0.5, dmg: 14 },
    blurb: ["Au corps à corps. Empoisonne tout, et tient bon.", "Up close. Poisons everything, and holds on."],
    type: "poison",
    sig: "poisonpoint",
    talent: { name: ["Point Poison", "Poison Point"], desc: ["Qui le touche est empoisonné. Coups des empoisonnés -30 %.", "Whoever touches it is poisoned. Poisoned foes hit 30% softer."] },
    unlock: { wave: 30, with: 1 },
  },
  {
    // slow, but it rolls through the crowd now and then, untouchable
    dex: 74,
    evolves: [[75, 12], [76, 26]],
    hp: 150,
    speed: 50,
    hpPerLevel: 3,
    armor: 0.8,
    basic: { kind: "rock", name: ["Jet-Pierres", "Rock Throw"], every: 0.7, dmg: 17 },
    blurb: ["Un roc lent. Roule à travers la foule.", "A slow rock. Rolls right through the crowd."],
    type: "ground",
    sig: "rollout",
    talent: { name: ["Roulade", "Rollout"], desc: ["Fonce en boule à travers les ennemis, intouchable. Coups reçus -20 %.", "Rolls through the foes, untouchable. Hits taken -20%."] },
    unlock: { wave: 30, with: 7 },
  },
  {
    // its sparkles charm the foes (they go for each other), and a wish heals it now and then
    dex: 173,
    evolves: [[35, 12], [36, 26]],
    hp: 100,
    speed: 66,
    basic: { kind: "fairy", name: ["Vent Féérique", "Fairy Wind"], every: 0.6, dmg: 8 },
    blurb: ["Charme les ennemis : ils se battent entre eux.", "Charms the foes: they fight each other."],
    type: "fairy",
    sig: "wish",
    talent: { name: ["Vœu", "Wish"], desc: ["Toutes les 10 s, soigne 20 % des PV et charme autour.", "Every 10 s, heals 20% HP and charms all around."] },
    unlock: { defis: 3 },
  },
  {
    // weak at first, then stronger with every level: the late game's
    dex: 147,
    evolves: [[148, 14], [149, 30]],
    hp: 100,
    speed: 64,
    power: 0.8,
    growth: 0.018,
    basic: { kind: "dragon", name: ["Draco-Rage", "Dragon Rage"], every: 0.55, dmg: 13 },
    blurb: ["Faible au début, redoutable sur la fin.", "Weak at first, fearsome late on."],
    type: "dragon",
    sig: "dragondance",
    talent: { name: ["Danse Draco", "Dragon Dance"], desc: ["+1,8 % de dégâts par niveau. PV pleins : coups reçus -50 %.", "+1.8% damage a level. At full HP: hits taken -50%."] },
    unlock: { wave: 75 },
  },
];
/** how far a starter's unlock is, from the Pension's levels (`wave` the best wave with any): [done, needed] */
export const unlockProgress = (u: Unlock, levels: Record<string, number>): [number, number] =>
  "defis" in u ? [levels.defis ?? 0, u.defis] : [(u.with ? levels[`w${u.with}`] : levels.wave) ?? 0, u.wave];
export const unlockedStarters = (levels: Record<string, number>) =>
  UNLOCK_STARTERS.filter((s) => {
    const [have, need] = unlockProgress(s.unlock!, levels);
    return have >= need;
  }).map((s) => s.dex);

/* ---------------- moves (auto-cast on their cooldown, or keys 1-4) and held items ---------------- */

export type MoveId =
  | "thunder" | "flamethrower" | "surf" | "leaf" | "ice" | "quake" | "shadow" | "protect" | "swift" | "psychic"
  | "quick" | "sleep" | "hyper" | "rocks" | "toxic" | "solar" | "twister"
  | "bubble" | "discharge" | "bone" | "firespin" | "sludge" | "icebeam" | "gigadrain" | "hex" | "aura" | "future"
  | "dazzle" | "flashcannon" | "darkpulse" | "xscissor"
  // 2026-10-20 (Johan: more moves, items, combos)
  | "dragonbreath" | "airslash" | "drainpunch" | "crunch" | "bugbuzz"
  // the evolved ones
  | "fulgur" | "blast" | "hydro" | "petal" | "blizzard" | "draco" | "fissure"
  | "scald" | "zapcannon" | "poltergeist" | "sacredfire" | "closecombat" | "doomdesire" | "gunk" | "moonblast" | "steelbeam"
  | "hurricane" | "outrage" | "aeroblast" | "focuspunch" | "nightslash" | "megahorn";
export type ItemId =
  | "leftovers" | "band" | "scarf" | "claw" | "lens" | "magnet" | "share" | "hpup" | "root" | "shellbell" | "belt" | "lifeorb" | "helmet"
  | "eviolite" | "kingsrock" | "sash" | "spoon"
  | "razorfang" | "metronome" | "amulet";

export interface MoveDef {
  id: MoveId;
  rarity: Rarity;
  name: Txt;
  type: Elem;
  /** what each level does, short */
  desc: Txt;
  /** cooldown at level 1..5 */
  cd: number[];
  /** an evolved move: a move at its last level plus a held item turn into it (never offered otherwise) */
  evo?: { from: MoveId; item: ItemId };
}

export const MOVES: MoveDef[] = [
  { id: "thunder", rarity: "epic", name: ["Tonnerre", "Thunderbolt"], type: "elec", desc: ["La foudre frappe des ennemis au hasard.", "Lightning strikes random foes."], cd: [2.8, 2.6, 2.4, 2.2, 1.9] },
  { id: "flamethrower", rarity: "rare", name: ["Lance-Flammes", "Flamethrower"], type: "fire", desc: ["Un cône de feu vers ta visée.", "A cone of fire where you aim."], cd: [4.5, 4.2, 3.9, 3.6, 3.2] },
  { id: "surf", rarity: "rare", name: ["Surf", "Surf"], type: "water", desc: ["Une vague autour de toi, qui repousse.", "A wave all around you, pushing back."], cd: [7, 6.5, 6, 5.5, 5] },
  { id: "leaf", rarity: "common", name: ["Feuille Magik", "Magical Leaf"], type: "grass", desc: ["Des feuilles qui ne ratent jamais.", "Leaves that never miss."], cd: [2.2, 2.1, 2, 1.9, 1.7] },
  { id: "ice", rarity: "rare", name: ["Vent Glace", "Icy Wind"], type: "ice", desc: ["Des cristaux tournent autour de toi et ralentissent.", "Crystals circle you and slow foes."], cd: [6, 5.6, 5.2, 4.8, 4.4] },
  { id: "quake", rarity: "epic", name: ["Séisme", "Earthquake"], type: "ground", desc: ["Tout tremble : gros dégâts autour.", "Everything shakes: big damage around."], cd: [9, 8.4, 7.8, 7.2, 6.4] },
  { id: "shadow", rarity: "rare", name: ["Ball'Ombre", "Shadow Ball"], type: "ghost", desc: ["Une boule lente qui traverse tout.", "A slow orb that goes through it all."], cd: [3.4, 3.2, 3, 2.8, 2.5] },
  { id: "protect", rarity: "epic", name: ["Abri", "Protect"], type: "normal", desc: ["Une bulle qui bloque les coups.", "A bubble that blocks the hits."], cd: [12, 11, 10, 9, 8] },
  { id: "swift", rarity: "common", name: ["Météores", "Swift"], type: "normal", desc: ["Des étoiles vers les plus proches.", "Stars at the closest foes."], cd: [1.6, 1.5, 1.4, 1.3, 1.1] },
  { id: "psychic", rarity: "common", name: ["Psyko", "Psychic"], type: "psy", desc: ["Une aura qui blesse ceux qui s'approchent.", "An aura that hurts whoever comes close."], cd: [0.35, 0.33, 0.31, 0.29, 0.26] },
  { id: "quick", rarity: "common", name: ["Vive-Attaque", "Quick Attack"], type: "normal", desc: ["Une ruée à travers les ennemis, intouchable.", "A dash through foes, untouchable."], cd: [4, 3.6, 3.2, 2.8, 2.4] },
  { id: "sleep", rarity: "rare", name: ["Poudre Dodo", "Sleep Powder"], type: "grass", desc: ["Des nuages qui endorment les ennemis.", "Clouds that put foes to sleep."], cd: [6, 5.6, 5.2, 4.8, 4.2] },
  { id: "hyper", rarity: "epic", name: ["Ultralaser", "Hyper Beam"], type: "normal", desc: ["Un rayon énorme qui traverse tout.", "A huge beam through everything."], cd: [6.5, 6, 5.5, 5, 4.5] },
  { id: "rocks", rarity: "common", name: ["Piège de Roc", "Stealth Rock"], type: "ground", desc: ["Des pierres pointues autour de toi.", "Pointed stones around you."], cd: [3.5, 3.3, 3.1, 2.9, 2.6] },
  { id: "toxic", rarity: "common", name: ["Toxik", "Toxic"], type: "poison", desc: ["Empoisonne les ennemis proches.", "Poisons the foes around you."], cd: [4, 3.7, 3.4, 3.1, 2.7] },
  { id: "solar", rarity: "epic", name: ["Lance-Soleil", "Solar Beam"], type: "grass", desc: ["Se charge, puis un rayon de soleil dévastateur.", "Charges, then a devastating beam of sunlight."], cd: [7, 6.5, 6, 5.5, 5] },
  { id: "twister", rarity: "rare", name: ["Ouragan", "Twister"], type: "fly", desc: ["Une tornade qui aspire les ennemis.", "A tornado that sucks foes in."], cd: [5, 4.7, 4.4, 4.1, 3.7] },
  { id: "bubble", rarity: "common", name: ["Bulles d'O", "Bubble"], type: "water", desc: ["Des bulles qui flottent et mouillent.", "Bubbles that drift and soak foes."], cd: [2.6, 2.5, 2.4, 2.2, 2] },
  { id: "discharge", rarity: "rare", name: ["Coup d'Jus", "Discharge"], type: "elec", desc: ["Une décharge autour de toi qui paralyse.", "A shock all around you that paralyses."], cd: [5, 4.7, 4.4, 4.1, 3.7] },
  { id: "bone", rarity: "rare", name: ["Osmerang", "Bonemerang"], type: "ground", desc: ["Un os qui part, transperce, et revient.", "A bone that flies out, pierces, and comes back."], cd: [2.4, 2.3, 2.2, 2.1, 1.9] },
  { id: "firespin", rarity: "rare", name: ["Danse Flammes", "Fire Spin"], type: "fire", desc: ["Un cercle de feu te suit et brûle.", "A ring of fire follows you and burns."], cd: [6, 5.6, 5.2, 4.8, 4.4] },
  { id: "sludge", rarity: "common", name: ["Bomb-Beurk", "Sludge Bomb"], type: "poison", desc: ["Des boules qui laissent des flaques toxiques.", "Blobs that leave toxic puddles."], cd: [3.6, 3.4, 3.2, 3, 2.7] },
  { id: "icebeam", rarity: "epic", name: ["Laser Glace", "Ice Beam"], type: "ice", desc: ["Un rayon glacé qui gèle ce qu'il touche.", "An icy beam that freezes what it hits."], cd: [4.5, 4.2, 3.9, 3.6, 3.2] },
  { id: "gigadrain", rarity: "rare", name: ["Giga-Sangsue", "Giga Drain"], type: "grass", desc: ["Aspire la vie des plus proches, te soigne.", "Drains the closest foes, heals you."], cd: [4, 3.8, 3.6, 3.4, 3] },
  { id: "hex", rarity: "epic", name: ["Châtiment", "Hex"], type: "ghost", desc: ["Frappe fort chaque ennemi qui a un statut.", "Hits hard every foe with a status."], cd: [5, 4.6, 4.2, 3.8, 3.4] },
  { id: "aura", rarity: "rare", name: ["Aurasphère", "Aura Sphere"], type: "fight", desc: ["Une sphère qui ne rate jamais, et éclate.", "A sphere that never misses, and bursts."], cd: [3, 2.9, 2.8, 2.6, 2.3] },
  { id: "future", rarity: "epic", name: ["Prescience", "Future Sight"], type: "psy", desc: ["Marque les plus costauds… qui explosent après.", "Marks the toughest foes… who blow up later."], cd: [6, 5.6, 5.2, 4.8, 4.2] },
  { id: "dazzle", rarity: "rare", name: ["Éclat Magique", "Dazzling Gleam"], type: "fairy", desc: ["Un éclat rose autour de toi : les ennemis touchés sont charmés.", "A pink flash all around you: the foes it hits are charmed."], cd: [6.5, 6.1, 5.7, 5.3, 4.9] },
  { id: "flashcannon", rarity: "epic", name: ["Luminocanon", "Flash Cannon"], type: "steel", desc: ["Un rayon d'acier qui perce tout.", "A steel beam that pierces everything."], cd: [4.2, 3.9, 3.6, 3.3, 3] },
  { id: "darkpulse", rarity: "rare", name: ["Vibrobscur", "Dark Pulse"], type: "dark", desc: ["Une onde noire qui repousse et fait flancher.", "A dark wave that pushes back and makes foes flinch."], cd: [5.5, 5.2, 4.9, 4.6, 4.2] },
  { id: "xscissor", rarity: "common", name: ["Plaie-Croix", "X-Scissor"], type: "bug", desc: ["Deux lames en croix vers les plus proches.", "Two crossed blades at the closest foes."], cd: [1.8, 1.7, 1.6, 1.5, 1.3] },
  { id: "dragonbreath", rarity: "rare", name: ["Dracosouffle", "Dragon Breath"], type: "dragon", desc: ["Trois souffles de dragon en éventail.", "Three dragon breaths in a fan."], cd: [3, 2.8, 2.6, 2.4, 2.1] },
  { id: "airslash", rarity: "common", name: ["Lame d'Air", "Air Slash"], type: "fly", desc: ["Des lames d'air partent en étoile.", "Blades of air fly out in a star."], cd: [2.4, 2.3, 2.2, 2, 1.8] },
  { id: "drainpunch", rarity: "rare", name: ["Poing Drainant", "Drain Punch"], type: "fight", desc: ["Un gros coup au plus proche, qui te soigne.", "A big blow at the closest foe, that heals you."], cd: [2.6, 2.4, 2.2, 2, 1.8] },
  { id: "crunch", rarity: "common", name: ["Mâchouille", "Crunch"], type: "dark", desc: ["Croque les ennemis les plus proches.", "Bites the closest foes."], cd: [2.2, 2.1, 2, 1.9, 1.7] },
  { id: "bugbuzz", rarity: "rare", name: ["Bourdon", "Bug Buzz"], type: "bug", desc: ["Un bourdonnement autour de toi, qui repousse.", "A buzz all around you, pushing back."], cd: [5, 4.7, 4.4, 4.1, 3.7] },
  // evolutions: a move at level 5 + an item
  { id: "fulgur", rarity: "legendary", name: ["Fatal-Foudre", "Thunder"], type: "elec", desc: ["La foudre s'abat partout et rebondit.", "Lightning everywhere, bouncing on."], cd: [1.5, 1.5, 1.5, 1.5, 1.5], evo: { from: "thunder", item: "magnet" } },
  { id: "blast", rarity: "legendary", name: ["Déflagration", "Fire Blast"], type: "fire", desc: ["Une boule de feu qui explose en étoile.", "A fireball that bursts into a star."], cd: [2.6, 2.6, 2.6, 2.6, 2.6], evo: { from: "flamethrower", item: "band" } },
  { id: "hydro", rarity: "legendary", name: ["Hydrocanon", "Hydro Pump"], type: "water", desc: ["Deux raz-de-marée qui te soignent.", "Two tidal waves that heal you."], cd: [4.5, 4.5, 4.5, 4.5, 4.5], evo: { from: "surf", item: "leftovers" } },
  { id: "petal", rarity: "legendary", name: ["Tempête Florale", "Petal Blizzard"], type: "grass", desc: ["Des pétales tourbillonnent sans fin.", "Petals whirl around you, endlessly."], cd: [0.6, 0.6, 0.6, 0.6, 0.6], evo: { from: "leaf", item: "root" } },
  { id: "blizzard", rarity: "legendary", name: ["Blizzard", "Blizzard"], type: "ice", desc: ["Des cristaux éternels qui gèlent sur place.", "Crystals that never melt, and freeze foes."], cd: [1, 1, 1, 1, 1], evo: { from: "ice", item: "claw" } },
  { id: "draco", rarity: "legendary", name: ["Draco-Météore", "Draco Meteor"], type: "dragon", desc: ["Une pluie de météores sur les ennemis.", "A meteor shower on your foes."], cd: [2.4, 2.4, 2.4, 2.4, 2.4], evo: { from: "swift", item: "scarf" } },
  { id: "fissure", rarity: "legendary", name: ["Abîme", "Fissure"], type: "ground", desc: ["Le sol s'ouvre : certains ne s'en relèvent pas.", "The ground opens: some never get up."], cd: [5, 5, 5, 5, 5], evo: { from: "quake", item: "lens" } },
  { id: "scald", rarity: "legendary", name: ["Ébullition", "Scald"], type: "water", desc: ["Des bulles bouillantes : mouillé ET brûlé.", "Boiling bubbles: soaked AND burnt."], cd: [1.6, 1.6, 1.6, 1.6, 1.6], evo: { from: "bubble", item: "spoon" } },
  { id: "zapcannon", rarity: "legendary", name: ["Élecanon", "Zap Cannon"], type: "elec", desc: ["Une onde énorme qui paralyse tout le monde.", "A huge wave that paralyses everyone."], cd: [4, 4, 4, 4, 4], evo: { from: "discharge", item: "magnet" } },
  { id: "poltergeist", rarity: "legendary", name: ["Poltergeist", "Poltergeist"], type: "ghost", desc: ["Tout l'écran hanté ; les ennemis à statut souffrent.", "The whole screen haunted; foes with a status suffer."], cd: [2, 2, 2, 2, 2], evo: { from: "hex", item: "kingsrock" } },
  { id: "sacredfire", rarity: "legendary", name: ["Feu Sacré", "Sacred Fire"], type: "fire", desc: ["Un grand cercle de feu sacré qui te soigne.", "A great ring of sacred fire that heals you."], cd: [4, 4, 4, 4, 4], evo: { from: "firespin", item: "sash" } },
  { id: "closecombat", rarity: "legendary", name: ["Close Combat", "Close Combat"], type: "fight", desc: ["Une rafale de coups devant toi.", "A flurry of blows in front of you."], cd: [1.1, 1.1, 1.1, 1.1, 1.1], evo: { from: "aura", item: "band" } },
  { id: "doomdesire", rarity: "legendary", name: ["Vœu Destructeur", "Doom Desire"], type: "psy", desc: ["Six cibles marquées, six explosions.", "Six foes marked, six blasts."], cd: [3, 3, 3, 3, 3], evo: { from: "future", item: "lens" } },
  { id: "gunk", rarity: "legendary", name: ["Détricanon", "Gunk Shot"], type: "poison", desc: ["D'énormes flaques toxiques partout.", "Huge toxic puddles everywhere."], cd: [2.5, 2.5, 2.5, 2.5, 2.5], evo: { from: "sludge", item: "eviolite" } },
  { id: "moonblast", rarity: "legendary", name: ["Pouvoir Lunaire", "Moonblast"], type: "fairy", desc: ["Une lune tombe sur la mêlée, charme et te soigne.", "A moon falls on the crowd, charms it, heals you."], cd: [2.4, 2.4, 2.4, 2.4, 2.4], evo: { from: "dazzle", item: "shellbell" } },
  { id: "steelbeam", rarity: "legendary", name: ["Métalaser", "Steel Beam"], type: "steel", desc: ["Quatre rayons d'acier en croix, qui tournent.", "Four steel beams in a cross, turning."], cd: [1.6, 1.6, 1.6, 1.6, 1.6], evo: { from: "flashcannon", item: "lifeorb" } },
  { id: "hurricane", rarity: "legendary", name: ["Vent Violent", "Hurricane"], type: "fly", desc: ["Trois tornades géantes qui aspirent tout.", "Three giant tornadoes that suck it all in."], cd: [3.2, 3.2, 3.2, 3.2, 3.2], evo: { from: "twister", item: "root" } },
  { id: "outrage", rarity: "legendary", name: ["Colère", "Outrage"], type: "dragon", desc: ["Une couronne de flammes de dragon tout autour.", "A crown of dragon flames all around."], cd: [1.8, 1.8, 1.8, 1.8, 1.8], evo: { from: "dragonbreath", item: "lifeorb" } },
  { id: "aeroblast", rarity: "legendary", name: ["Aéroblast", "Aeroblast"], type: "fly", desc: ["Des lames d'air sans fin, qui percent tout.", "Endless blades of air, piercing everything."], cd: [1, 1, 1, 1, 1], evo: { from: "airslash", item: "belt" } },
  { id: "focuspunch", rarity: "legendary", name: ["Mitra-Poing", "Focus Punch"], type: "fight", desc: ["Un coup énorme sur le plus costaud, qui te soigne.", "A huge blow on the toughest, that heals you."], cd: [1.6, 1.6, 1.6, 1.6, 1.6], evo: { from: "drainpunch", item: "helmet" } },
  { id: "nightslash", rarity: "legendary", name: ["Tranche-Nuit", "Night Slash"], type: "dark", desc: ["Des lames d'ombre, toujours critiques.", "Shadow blades, always critical."], cd: [1.2, 1.2, 1.2, 1.2, 1.2], evo: { from: "crunch", item: "razorfang" } },
  { id: "megahorn", rarity: "legendary", name: ["Mégacorne", "Megahorn"], type: "bug", desc: ["Une onde géante qui empoisonne tout.", "A giant wave that poisons everything."], cd: [2.6, 2.6, 2.6, 2.6, 2.6], evo: { from: "bugbuzz", item: "metronome" } },
];

export interface ItemDef {
  id: ItemId;
  rarity: Rarity;
  name: Txt;
  desc: Txt;
}

export const ITEMS: ItemDef[] = [
  { id: "leftovers", rarity: "rare", name: ["Restes", "Leftovers"], desc: ["Régénère des PV.", "Restores HP over time."] },
  { id: "band", rarity: "rare", name: ["Bandeau Choix", "Choice Band"], desc: ["+12 % de dégâts.", "+12% damage."] },
  { id: "scarf", rarity: "common", name: ["Mouchoir Choix", "Choice Scarf"], desc: ["+8 % de vitesse.", "+8% speed."] },
  { id: "claw", rarity: "rare", name: ["Vive Griffe", "Quick Claw"], desc: ["Capacités plus vite prêtes (−8 %).", "Moves ready sooner (−8%)."] },
  { id: "lens", rarity: "epic", name: ["Lentilscope", "Scope Lens"], desc: ["+7 % de coups critiques.", "+7% critical hits."] },
  { id: "magnet", rarity: "common", name: ["Aimant", "Magnet"], desc: ["Attire les bonbons de plus loin.", "Pulls candies from further away."] },
  { id: "share", rarity: "common", name: ["Multi Exp", "Exp. Share"], desc: ["+12 % d'expérience.", "+12% experience."] },
  { id: "hpup", rarity: "common", name: ["PV Plus", "HP Up"], desc: ["+20 PV max (et soigne).", "+20 max HP (and heals)."] },
  { id: "root", rarity: "rare", name: ["Grosse Racine", "Big Root"], desc: ["+10 % de zone d'effet.", "+10% area of effect."] },
  { id: "shellbell", rarity: "epic", name: ["Grelot Coque", "Shell Bell"], desc: ["Chaque K.O. te soigne un peu.", "Each KO heals you a little."] },
  { id: "belt", rarity: "epic", name: ["Ceinture Pro", "Expert Belt"], desc: ["Coups critiques plus forts (+25 %).", "Stronger critical hits (+25%)."] },
  { id: "helmet", rarity: "epic", name: ["Casque Brut", "Rocky Helmet"], desc: ["Qui te touche se fait mal.", "Whoever touches you gets hurt."] },
  { id: "lifeorb", rarity: "legendary", name: ["Orbe Vie", "Life Orb"], desc: ["+20 % de dégâts, −5 % de PV max.", "+20% damage, −5% max HP."] },
  { id: "eviolite", rarity: "rare", name: ["Évoluroc", "Eviolite"], desc: ["−7 % de dégâts subis.", "−7% damage taken."] },
  { id: "kingsrock", rarity: "rare", name: ["Roche Royale", "King's Rock"], desc: ["Tes coups peuvent endormir (4 %).", "Your hits may put foes to sleep (4%)."] },
  { id: "sash", rarity: "epic", name: ["Ceinture Force", "Focus Sash"], desc: ["Survit à un coup fatal, de temps en temps.", "Survives a fatal blow, now and then."] },
  { id: "spoon", rarity: "rare", name: ["Cuillère Tordue", "Twisted Spoon"], desc: ["Brûlures et poisons +30 % plus forts.", "Burns and poisons 30% stronger."] },
  { id: "razorfang", rarity: "rare", name: ["Croc Rasoir", "Razor Fang"], desc: ["+12 % de dégâts aux ennemis qui ont un statut.", "+12% damage to foes with a status."] },
  { id: "metronome", rarity: "epic", name: ["Métronome", "Metronome"], desc: ["Sans être touché, tu frappes de plus en plus fort.", "Untouched, you hit harder and harder."] },
  { id: "amulet", rarity: "common", name: ["Pièce Rune", "Amulet Coin"], desc: ["+15 % d'or ramassé.", "+15% gold picked up."] },
];

/**
 * Build packs (Johan, 2026-10-18): a start tier offers 3 of them, drawn by rarity, instead of a draft of single cards.
 * Each one is four moves and four items that play together (their combos, their evolutions); the commons work, the
 * legendaries are the broken ones and rarely come up. All get the same number of cards (the tier's): a pack is a
 * start as strong as a run played that far, its rarity only says how well its cards play together.
 */
export type PackId =
  | "wildfire" | "mud" | "venom" | "bulwark" | "woods" | "storm" | "floe" | "charmer" | "swarm" | "molten" | "critical"
  | "tempest" | "wisp" | "nightmare" | "eclipse" | "gale" | "drake" | "brawler";
export interface PackDef {
  id: PackId;
  rarity: Rarity;
  name: Txt;
  moves: MoveId[];
  items: ItemId[];
}
export const PACKS: PackDef[] = [
  { id: "wildfire", rarity: "common", name: ["Brasier", "Wildfire"], moves: ["flamethrower", "firespin", "twister", "toxic"], items: ["band", "sash", "scarf", "root"] },
  { id: "mud", rarity: "common", name: ["Bourbier", "Mudslide"], moves: ["bubble", "quake", "rocks", "bone"], items: ["lens", "root", "eviolite", "hpup"] },
  { id: "venom", rarity: "common", name: ["Venin", "Venom"], moves: ["toxic", "sludge", "psychic", "future"], items: ["eviolite", "lens", "spoon", "root"] },
  { id: "bulwark", rarity: "common", name: ["Rempart", "Bulwark"], moves: ["protect", "gigadrain", "quake", "flashcannon"], items: ["helmet", "leftovers", "eviolite", "lifeorb"] },
  { id: "woods", rarity: "common", name: ["Sous-bois", "Undergrowth"], moves: ["leaf", "sleep", "gigadrain", "solar"], items: ["root", "leftovers", "claw", "share"] },
  { id: "storm", rarity: "legendary", name: ["Orage", "Thunderstorm"], moves: ["bubble", "thunder", "discharge", "surf"], items: ["magnet", "leftovers", "claw", "band"] },
  { id: "floe", rarity: "rare", name: ["Banquise", "Ice Floe"], moves: ["bubble", "ice", "icebeam", "aura"], items: ["claw", "band", "root", "leftovers"] },
  { id: "charmer", rarity: "rare", name: ["Charmeur", "Charmer"], moves: ["dazzle", "darkpulse", "psychic", "swift"], items: ["shellbell", "scarf", "band", "claw"] },
  { id: "swarm", rarity: "rare", name: ["Essaim", "Swarm"], moves: ["xscissor", "toxic", "sludge", "bone"], items: ["eviolite", "spoon", "lens", "belt"] },
  { id: "molten", rarity: "epic", name: ["Métal en fusion", "Molten Metal"], moves: ["flashcannon", "firespin", "flamethrower", "protect"], items: ["lifeorb", "sash", "band", "lens"] },
  { id: "critical", rarity: "epic", name: ["Coup critique", "Critical Hit"], moves: ["swift", "aura", "bone", "xscissor"], items: ["scarf", "band", "lens", "belt"] },
  { id: "tempest", rarity: "epic", name: ["Tempête", "Tempest"], moves: ["bubble", "thunder", "twister", "hyper"], items: ["magnet", "band", "claw", "lens"] },
  // 2026-10-20, with the new moves: wind on soaked and burnt foes, dragonfire, fists on charmed foes
  { id: "gale", rarity: "rare", name: ["Bourrasque", "Gale"], moves: ["airslash", "twister", "bubble", "flamethrower"], items: ["root", "belt", "claw", "band"] },
  { id: "drake", rarity: "epic", name: ["Dompteur", "Dragon Tamer"], moves: ["dragonbreath", "firespin", "sleep", "crunch"], items: ["lifeorb", "razorfang", "band", "lens"] },
  { id: "brawler", rarity: "rare", name: ["Bagarreur", "Brawler"], moves: ["drainpunch", "dazzle", "bugbuzz", "aura"], items: ["helmet", "metronome", "eviolite", "band"] },
  // the broken ones: soaked foes and lightning (the safest of all, 2026-10-18), burns and poisons that Hex and Poltergeist
  // feed on (a friend's build), sleep and Ghost, charm and Dark
  { id: "wisp", rarity: "legendary", name: ["Feu follet", "Will-o'-Wisp"], moves: ["flamethrower", "toxic", "firespin", "hex"], items: ["spoon", "kingsrock", "band", "sash"] },
  { id: "nightmare", rarity: "legendary", name: ["Cauchemar", "Nightmare"], moves: ["sleep", "hex", "future", "shadow"], items: ["kingsrock", "lens", "claw", "belt"] },
  { id: "eclipse", rarity: "legendary", name: ["Éclipse", "Eclipse"], moves: ["dazzle", "darkpulse", "future", "psychic"], items: ["shellbell", "lens", "lifeorb", "belt"] },
];
/** how likely a pack of each rarity is (shared among the packs of that rarity) */
export const PACK_ODDS: Record<Rarity, number> = { common: 52, rare: 28, epic: 16, legendary: 4 };

/** when there's nothing left to learn or raise: boosts that stack forever */
export type BonusId = "protein" | "ppup" | "sitrus";

/** The states a foe can be put in, for the guide (Johan, 2026-10-18: players asked how statuses and combos work) */
export const STATUSES: { name: Txt; by: Txt; does: Txt }[] = [
  { name: ["Mouillé", "Wet"], by: ["Eau", "Water"], does: ["4 s. Électrik, Glace et Sol frappent plus fort.", "4 s. Electric, Ice and Ground hit harder."] },
  { name: ["Brûlé", "Burnt"], by: ["Feu", "Fire"], does: ["3 s, perd des PV chaque seconde.", "3 s, loses HP every second."] },
  { name: ["Empoisonné", "Poisoned"], by: ["Poison", "Poison"], does: ["Perd des PV chaque seconde.", "Loses HP every second."] },
  { name: ["Endormi / gelé", "Asleep / frozen"], by: ["Plante, Glace", "Grass, Ice"], does: ["Ne bouge plus. Glace sur un mouillé : gelé net.", "Can't move. Ice on a wet foe: frozen solid."] },
  { name: ["Ralenti", "Slowed"], by: ["Vent Glace, Coup d'Jus…", "Icy Wind, Discharge…"], does: ["Avance deux fois moins vite.", "Moves half as fast."] },
  { name: ["Charmé", "Charmed"], by: ["Fée", "Fairy"], does: ["Attaque ses voisins au lieu de toi.", "Attacks its neighbours instead of you."] },
  { name: ["Flanche", "Flinch"], by: ["Ténèbres", "Dark"], does: ["3 fois sur 10, figé un instant.", "3 times in 10, frozen for a moment."] },
];
/**
 * A boss's affix (Johan, 2026-10-20: something new to play late in a run, on the bosses only, the crowd is busy enough):
 * one from wave 50, two from 150 (classic and coop). Named under its bar and in its banner, listed in the guide.
 */
export type AffixId = "shield" | "swift" | "regen" | "summon" | "blink";
export const AFFIXES: { id: AffixId; name: Txt; short: Txt; does: Txt }[] = [
  { id: "shield", name: ["Bouclier", "Shield"], short: ["casse son bouclier", "break its shield"], does: ["Casse son bouclier d'abord : il est sonné. Revient si tu le laisses.", "Break its shield first: it's stunned. Comes back if you let it be."] },
  { id: "swift", name: ["Vif", "Swift"], short: ["rapide", "fast"], does: ["Bouge et attaque plus vite.", "Moves and attacks faster."] },
  { id: "regen", name: ["Régénération", "Regenerator"], short: ["ne le lâche pas", "don't let up"], does: ["Se soigne dès que tu arrêtes de frapper.", "Heals as soon as you stop hitting."] },
  { id: "summon", name: ["Meneur", "Leader"], short: ["appelle des renforts", "calls in backup"], does: ["Appelle des renforts de temps en temps.", "Calls in backup now and then."] },
  { id: "blink", name: ["Téléporteur", "Blinker"], short: ["surgit à côté de toi", "pops up next to you"], does: ["Surgit à côté de toi.", "Pops up right next to you."] },
];
/** the waves its affixes start at: one, then two */
export const AFFIX_WAVES = [50, 150];
/** a boss left standing this long gets angry: hits harder, moves faster (its wave no longer ends on a clock) */
export const ENRAGE_AFTER = 75;

/** what the statuses feed, for the guide */
export const STATUS_NOTES: Txt[] = [
  ["Châtiment et Poltergeist frappent fort les ennemis qui ont un statut.", "Hex and Poltergeist hit foes with a status hard."],
  ["Cuillère Tordue : brûlures et poisons +30 %.", "Twisted Spoon: burns and poisons +30%."],
  ["Roche Royale : tes coups peuvent endormir.", "King's Rock: your hits may put foes to sleep."],
  ["Les boss ne dorment, ne gèlent, ni ne ralentissent jamais.", "Bosses are never put to sleep, frozen or slowed."],
];

/**
 * Combos: a hit of one type on a foe in a state. Water wets, fire burns, Toxic poisons, Sleep Powder and Blizzard put to
 * sleep; the right type next does more. Shown in the pause screen.
 */
export const COMBOS: { on: "wet" | "burn" | "poison" | "sleep" | "charm"; by: Elem; mul: number; name: Txt }[] = [
  { on: "wet", by: "elec", mul: 1.8, name: ["Mouillé + Électrik : électrocution", "Wet + Electric: electrocution"] },
  { on: "wet", by: "ice", mul: 1.5, name: ["Mouillé + Glace : gelé net", "Wet + Ice: frozen solid"] },
  { on: "burn", by: "fly", mul: 1.6, name: ["Brûlé + Vol : le vent attise", "Burnt + Flying: the wind fans it"] },
  { on: "poison", by: "psy", mul: 1.6, name: ["Empoisonné + Psy : migraine", "Poisoned + Psychic: migraine"] },
  { on: "sleep", by: "ghost", mul: 2, name: ["Endormi + Spectre : cauchemar", "Asleep + Ghost: nightmare"] },
  { on: "sleep", by: "fire", mul: 1.5, name: ["Gelé/endormi + Feu : réveil brûlant", "Frozen/asleep + Fire: a hot wake-up"] },
  { on: "sleep", by: "psy", mul: 1.8, name: ["Endormi + Psy : Dévorêve", "Asleep + Psychic: Dream Eater"] },
  { on: "sleep", by: "fight", mul: 1.7, name: ["Gelé/endormi + Combat : brise-glace", "Frozen/asleep + Fighting: ice breaker"] },
  { on: "poison", by: "fire", mul: 1.6, name: ["Empoisonné + Feu : le gaz s'enflamme", "Poisoned + Fire: the gas ignites"] },
  { on: "wet", by: "ground", mul: 1.4, name: ["Mouillé + Sol : dans la boue", "Wet + Ground: stuck in the mud"] },
  { on: "burn", by: "ghost", mul: 1.5, name: ["Brûlé + Spectre : feu follet", "Burnt + Ghost: will-o'-wisp"] },
  { on: "charm", by: "dark", mul: 1.8, name: ["Charmé + Ténèbres : coup bas", "Charmed + Dark: a low blow"] },
  { on: "charm", by: "psy", mul: 1.6, name: ["Charmé + Psy : hypnose", "Charmed + Psychic: hypnosis"] },
  { on: "burn", by: "steel", mul: 1.5, name: ["Brûlé + Acier : métal en fusion", "Burnt + Steel: molten metal"] },
  { on: "poison", by: "bug", mul: 1.7, name: ["Empoisonné + Insecte : nid de vermine", "Poisoned + Bug: a nest of vermin"] },
  { on: "sleep", by: "fairy", mul: 1.6, name: ["Endormi + Fée : doux rêve", "Asleep + Fairy: sweet dreams"] },
  { on: "wet", by: "grass", mul: 1.4, name: ["Mouillé + Plante : ça pousse", "Wet + Grass: it grows"] },
  // 2026-10-20, with the new moves
  { on: "burn", by: "dragon", mul: 1.5, name: ["Brûlé + Dragon : flamme draconique", "Burnt + Dragon: dragonfire"] },
  { on: "sleep", by: "dragon", mul: 1.6, name: ["Endormi + Dragon : le dragon s'éveille", "Asleep + Dragon: the dragon wakes"] },
  { on: "poison", by: "dark", mul: 1.5, name: ["Empoisonné + Ténèbres : coup sournois", "Poisoned + Dark: a dirty trick"] },
  { on: "charm", by: "fight", mul: 1.7, name: ["Charmé + Combat : coup en traître", "Charmed + Fighting: a sucker punch"] },
  { on: "wet", by: "fly", mul: 1.4, name: ["Mouillé + Vol : vent glacial", "Wet + Flying: an icy wind"] },
];
export const BONUSES: { id: BonusId; name: Txt; desc: Txt }[] = [
  { id: "protein", name: ["Protéine", "Protein"], desc: ["+6 % de dégâts, pour toujours.", "+6% damage, for good."] },
  { id: "ppup", name: ["PP Plus", "PP Up"], desc: ["Capacités 4 % plus vite prêtes.", "Moves ready 4% sooner."] },
  { id: "sitrus", name: ["Baie Sitrus", "Sitrus Berry"], desc: ["Soigne 40 % de tes PV.", "Heals 40% of your HP."] },
];

/**
 * Paragon cards (Johan, 2026-10-20: past a point only boosts came up, and nothing changed how a run plays): one-off cards
 * from wave 75 (classic and coop), each a rule of its own, said in a few words. Among the level-up cards (more often once
 * the build is full) and at Kecleon's.
 */
export type ParagonId = "echo" | "blast" | "vamp" | "hunter" | "frenzy" | "limit" | "fatal" | "giant" | "second";
export const PARAGONS: { id: ParagonId; name: Txt; desc: Txt }[] = [
  { id: "echo", name: ["Écho", "Echo"], desc: ["1 capacité sur 5 repart aussitôt.", "1 move in 5 is ready again at once."] },
  { id: "blast", name: ["Détonation", "Detonation"], desc: ["Chaque K.O. explose sur ses voisins.", "Each K.O. blows up on its neighbours."] },
  { id: "vamp", name: ["Vampire", "Vampire"], desc: ["Chaque K.O. rend un peu de PV.", "Each K.O. gives back a little HP."] },
  { id: "hunter", name: ["Chasseur", "Hunter"], desc: ["+50 % de dégâts aux boss et titans.", "+50% damage to bosses and titans."] },
  { id: "frenzy", name: ["Frénésie", "Frenzy"], desc: ["Plus il y a d'ennemis autour, plus tu frappes fort.", "The more foes around, the harder you hit."] },
  { id: "limit", name: ["Hâte ultime", "Ultimate haste"], desc: ["Les recharges descendent plus bas.", "Cooldowns go lower still."] },
  { id: "fatal", name: ["Coup fatal", "Deadly blow"], desc: ["Critiques : dégâts x2 en plus.", "Crits: twice the damage on top."] },
  { id: "giant", name: ["Colosse", "Colossus"], desc: ["+40 % de PV max.", "+40% max HP."] },
  { id: "second", name: ["Ténacité", "Grit"], desc: ["Te relève une fois de plus.", "Gets you up once more."] },
];
export const PARAGON_WAVE = 75;

/**
 * Kecleon's pacts (Johan, 2026-10-20: a risk for a big reward): at its stall from wave 10, a curse until the next boss falls
 * against a reward taken at once, for good.
 */
export type PactId = "horde" | "glass" | "fury" | "elite";
export const PACTS: { id: PactId; name: Txt; curse: Txt; gift: Txt }[] = [
  { id: "horde", name: ["Horde", "Horde"], curse: ["+60 % d'ennemis", "+60% foes"], gift: ["+3 cartes, tout de suite", "+3 cards, right now"] },
  { id: "glass", name: ["Verre", "Glass"], curse: ["Tu prends +50 % de dégâts", "You take +50% damage"], gift: ["+30 % de dégâts, pour toujours", "+30% damage, for good"] },
  { id: "fury", name: ["Furie", "Fury"], curse: ["Ennemis 30 % plus rapides", "Foes 30% faster"], gift: ["+30 % de PV max, pour toujours", "+30% max HP, for good"] },
  { id: "elite", name: ["Élite", "Elite"], curse: ["1 ennemi sur 4 est une élite", "1 foe in 4 is an elite"], gift: ["Un gros sac d'or", "A big bag of gold"] },
];
export const PACT_WAVE = 10;

/**
 * A shiny run (Johan, 2026-10-20: "stats de fou et sprite"): now and then a classic or coop run starts with its starter
 * shiny, SpriteCollab's shiny sprite (scripts/build-game: 20000 + its dex number) and much stronger. Never in the daily
 * challenge: the same for everyone there.
 */
export const SHINY = 20000;
export const SHINY_ODDS = 1 / 40;
/** the Shiny Charm (OBJECTS): twice as often */
export const CHARM_ODDS = 2;
export const SHINY_BOOST = { power: 1.5, hp: 1.5, speed: 1.15, xp: 1.25 };

export const MAX_MOVES = 4;
export const MAX_ITEMS = 4;
export const MAX_LEVEL = 5;

/* ---------------- wild Pokémon ---------------- */

export type Behaviour = "chase" | "erratic" | "charge" | "shoot" | "explode" | "ghost" | "treasure" | "flop";

export interface Wild {
  dex: number;
  hp: number;
  speed: number;
  dmg: number;
  xp: number;
  act: Behaviour;
  /** body radius for hits */
  r: number;
  /** what it shoots */
  shot?: Elem;
}

export const WILD: Record<number, Wild> = {
  10: { dex: 10, hp: 10, speed: 22, dmg: 6, xp: 1, act: "chase", r: 6 },
  13: { dex: 13, hp: 11, speed: 24, dmg: 7, xp: 1, act: "chase", r: 6 },
  16: { dex: 16, hp: 9, speed: 36, dmg: 6, xp: 1, act: "erratic", r: 6 },
  19: { dex: 19, hp: 12, speed: 40, dmg: 7, xp: 1, act: "chase", r: 6 },
  21: { dex: 21, hp: 12, speed: 40, dmg: 8, xp: 2, act: "erratic", r: 6 },
  29: { dex: 29, hp: 18, speed: 28, dmg: 8, xp: 2, act: "chase", r: 6 },
  32: { dex: 32, hp: 18, speed: 30, dmg: 9, xp: 2, act: "chase", r: 6 },
  41: { dex: 41, hp: 10, speed: 46, dmg: 7, xp: 1, act: "erratic", r: 6 },
  43: { dex: 43, hp: 20, speed: 22, dmg: 8, xp: 2, act: "chase", r: 6 },
  23: { dex: 23, hp: 22, speed: 26, dmg: 9, xp: 3, act: "shoot", r: 7, shot: "ghost" },
  27: { dex: 27, hp: 28, speed: 30, dmg: 10, xp: 3, act: "chase", r: 7 },
  52: { dex: 52, hp: 22, speed: 38, dmg: 9, xp: 3, act: "chase", r: 7 },
  54: { dex: 54, hp: 30, speed: 24, dmg: 9, xp: 3, act: "shoot", r: 7, shot: "psy" },
  56: { dex: 56, hp: 22, speed: 52, dmg: 11, xp: 3, act: "chase", r: 7 },
  58: { dex: 58, hp: 30, speed: 40, dmg: 11, xp: 3, act: "chase", r: 7 },
  74: { dex: 74, hp: 60, speed: 16, dmg: 13, xp: 4, act: "chase", r: 8 },
  81: { dex: 81, hp: 26, speed: 22, dmg: 9, xp: 3, act: "shoot", r: 7, shot: "elec" },
  92: { dex: 92, hp: 26, speed: 30, dmg: 10, xp: 4, act: "ghost", r: 7 },
  100: { dex: 100, hp: 24, speed: 44, dmg: 22, xp: 3, act: "explode", r: 7 },
  104: { dex: 104, hp: 34, speed: 30, dmg: 11, xp: 4, act: "shoot", r: 7, shot: "ground" },
  20: { dex: 20, hp: 40, speed: 50, dmg: 13, xp: 4, act: "chase", r: 8 },
  22: { dex: 22, hp: 36, speed: 46, dmg: 13, xp: 4, act: "erratic", r: 8 },
  24: { dex: 24, hp: 55, speed: 30, dmg: 13, xp: 5, act: "shoot", r: 9, shot: "ghost" },
  42: { dex: 42, hp: 34, speed: 50, dmg: 12, xp: 4, act: "erratic", r: 8 },
  66: { dex: 66, hp: 50, speed: 36, dmg: 14, xp: 5, act: "chase", r: 8 },
  75: { dex: 75, hp: 120, speed: 14, dmg: 18, xp: 7, act: "chase", r: 10 },
  93: { dex: 93, hp: 46, speed: 36, dmg: 14, xp: 6, act: "ghost", r: 8 },
  109: { dex: 109, hp: 50, speed: 20, dmg: 12, xp: 5, act: "shoot", r: 9, shot: "ghost" },
  111: { dex: 111, hp: 90, speed: 30, dmg: 18, xp: 7, act: "charge", r: 10 },
  123: { dex: 123, hp: 56, speed: 58, dmg: 16, xp: 6, act: "chase", r: 8 },
  128: { dex: 128, hp: 80, speed: 34, dmg: 18, xp: 7, act: "charge", r: 10 },
  129: { dex: 129, hp: 6, speed: 18, dmg: 2, xp: 1, act: "flop", r: 7 },
  113: { dex: 113, hp: 70, speed: 36, dmg: 0, xp: 60, act: "treasure", r: 9 },
  // the late waves
  15: { dex: 15, hp: 70, speed: 62, dmg: 18, xp: 7, act: "erratic", r: 8 },
  59: { dex: 59, hp: 120, speed: 52, dmg: 22, xp: 9, act: "chase", r: 10 },
  142: { dex: 142, hp: 90, speed: 66, dmg: 20, xp: 9, act: "erratic", r: 10 },
  76: { dex: 76, hp: 260, speed: 16, dmg: 28, xp: 12, act: "chase", r: 12 },
  68: { dex: 68, hp: 170, speed: 40, dmg: 26, xp: 11, act: "chase", r: 10 },
  112: { dex: 112, hp: 200, speed: 34, dmg: 28, xp: 12, act: "charge", r: 12 },
  65: { dex: 65, hp: 110, speed: 30, dmg: 22, xp: 11, act: "shoot", r: 9, shot: "psy" },
  89: { dex: 89, hp: 220, speed: 20, dmg: 24, xp: 12, act: "chase", r: 12 },
};

/** who comes out, by the wave they start showing up */
export const POOLS: [number, number[]][] = [
  [1, [10, 13, 16, 19]],
  [2, [21, 29, 32, 41]],
  [3, [43, 23, 52]],
  [5, [27, 56, 54]],
  [7, [58, 74, 81, 100]],
  [9, [92, 104]],
  [12, [20, 22, 24, 42, 66]],
  [15, [93, 109, 111, 123]],
  [18, [75, 128]],
  [20, [15, 59, 142]],
  [24, [76, 68, 112]],
  [28, [65, 89]],
];
/** the early weak ones leave the field as the waves go on */
export const RETIRE: Record<number, number> = {
  10: 8, 13: 8, 16: 11, 19: 12, 41: 14, 29: 15, 32: 15, 21: 17, 43: 17, 23: 23, 27: 23, 52: 23, 56: 24, 54: 25, 58: 27, 74: 27, 81: 28,
};

/** a wave's length from wave 50 on */
export const WAVE_SECONDS = 30;
/**
 * Shorter waves early on (Clément, 2026-10-18: the first ones dragged): 15 s up to wave 24, 20 s from 25 to 49, then 30 s.
 * The ladder's time check (game_submit2 v5 in docs/supabase.sql) follows the same steps.
 */
export const waveLength = (w: number) => (w < 25 ? 15 : w < 50 ? 20 : WAVE_SECONDS);
/**
 * Since 2026-10-20 (Johan: "kill all, next wave") a classic wave holds a count of foes: all of them knocked out, the next one
 * comes at once; its length is only the most it lasts (the next one comes anyway, these still about). A wave's crowd, the
 * foes a second the old clock-driven waves brought in...
 */
export const waveRate = (w: number) => 0.6 + 0.3 * w + 0.012 * w * w;
/**
 * ...and its count: the old crowd early on, then a count a good build clears before the clock (the old one never ended:
 * 14 000 at wave 190). A god-mode bot with a plain build knocked out ~7-8 foes a second at waves 100 to 175: 200 is about
 * 25 s for it, much less for a strong one.
 */
export const waveQuota = (w: number) => Math.round(Math.min(waveRate(w) * waveLength(w), 40 + 2 * w, 200));
/**
 * Gold: a foe drops a coin now and then, worth a little more as the waves go on (the late waves bring many more foes
 * already). `waveGold` is what a plain wave brings (no elite, boss nor Pension): Kecleon's prices follow it (Johan,
 * 2026-10-21: they rose 12 % a wave, out of reach past wave 40, a card 4 400 gold at a start from wave 50).
 */
export const COIN_ODDS = 0.06;
export const coinValue = (w: number) => 1 + Math.floor(w / 6);
export const waveGold = (w: number) =>
  Math.min(1.5 * waveQuota(w), waveRate(w) * waveLength(w)) * COIN_ODDS * coinValue(w) * (WAVE_SECONDS / waveLength(w));
/** the last few of a wave's count rush at the player (no waiting for stragglers walking in from off screen) */
export const WAVE_HURRY = 12;
/** when wave w starts at the latest (each wave to its full length): where a start tier's clock begins */
export const waveStart = (w: number) => {
  const a = Math.min(w, 25) - 1, b = Math.max(0, Math.min(w, 50) - 25), c = Math.max(0, w - 50);
  return a * 15 + b * 20 + c * WAVE_SECONDS;
};

/* ---------------- biomes and weather (Johan, 2026-10-19: variety, never at the cost of reading the field) ---------------- */

export type WeatherId = "rain" | "sun" | "hail" | "sand";
/** a wave's weather: what it does to the moves' types (the foes have none), said in the wave's banner and the pause */
export const WEATHERS: Record<WeatherId, { name: Txt; does: Txt; mul: Partial<Record<Elem, number>> }> = {
  rain: { name: ["Pluie", "Rain"], does: ["Eau +25 %, Feu -20 %", "Water +25%, Fire -20%"], mul: { water: 1.25, fire: 0.8 } },
  sun: { name: ["Grand soleil", "Harsh sun"], does: ["Feu +25 %, Plante +10 %, Eau -20 %", "Fire +25%, Grass +10%, Water -20%"], mul: { fire: 1.25, grass: 1.1, water: 0.8 } },
  hail: { name: ["Grêle", "Hail"], does: ["Glace +25 %, les mouillés gèlent plus longtemps", "Ice +25%, wet foes freeze longer"], mul: { ice: 1.25 } },
  sand: { name: ["Tempête de sable", "Sandstorm"], does: ["Sol +25 %, Acier +15 %", "Ground +25%, Steel +15%"], mul: { ground: 1.25, steel: 1.15 } },
};

export type BiomeId = "meadow" | "beach" | "forest" | "cave" | "snow" | "volcano";
/**
 * The field changes every 10 waves, round and round: the ground's colours (the tiles are drawn from them), the wild
 * Pokémon met more often there (among those of the wave), the weather it brings (the chance of each, else none).
 */
export const BIOMES: { id: BiomeId; name: Txt; colors?: Record<string, string>; foes: number[]; weather: Partial<Record<WeatherId, number>> }[] = [
  { id: "meadow", name: ["La prairie", "The meadow"], foes: [], weather: { rain: 0.15, sun: 0.15 } },
  {
    id: "beach", name: ["La plage", "The beach"], foes: [54, 129, 27, 74],
    colors: { grass: "#e8d39a", grassDark: "#d4bb7c", grassLight: "#f4e4b4", blade: "#b89a5a", flowerA: "#f7d9d0", flowerB: "#fff1c9", pebble: "#c7b49a", grassFx: "#9cd4e8" },
    weather: { rain: 0.3, sun: 0.2 },
  },
  {
    id: "forest", name: ["La forêt", "The forest"], foes: [43, 123, 15, 41, 13],
    colors: { grass: "#5d8c4f", grassDark: "#476f3e", grassLight: "#74a35f", blade: "#355a33", flowerA: "#e4685a", flowerB: "#f2e3b4", pebble: "#8a8c78" },
    weather: { rain: 0.35 },
  },
  {
    id: "cave", name: ["La grotte", "The cave"], foes: [41, 42, 74, 75, 76, 92, 93],
    colors: { grass: "#7c7486", grassDark: "#625b6c", grassLight: "#938aa0", blade: "#4c4656", flowerA: "#9fe4ff", flowerB: "#d8b6ff", pebble: "#a8a0b4", grassFx: "#9fe4ff" },
    weather: { sand: 0.2 },
  },
  {
    id: "snow", name: ["La neige", "The snow"], foes: [],
    colors: { grass: "#dfe9f1", grassDark: "#c3d1de", grassLight: "#f4f9fd", blade: "#93a9bd", flowerA: "#bfe3ff", flowerB: "#ffffff", pebble: "#aab8c6", grassFx: "#bfe3ff" },
    weather: { hail: 0.45 },
  },
  {
    id: "volcano", name: ["Le volcan", "The volcano"], foes: [58, 59, 76, 111, 112],
    colors: { grass: "#6b4a42", grassDark: "#523630", grassLight: "#85594d", blade: "#3a2724", flowerA: "#ff8a3d", flowerB: "#ffd36e", pebble: "#9a8075", grassFx: "#ff8a3d" },
    weather: { sun: 0.45, sand: 0.15 },
  },
];
export const BIOME_WAVES = 10;

/* ---------------- bosses, every 5 waves ---------------- */

export type BossMove = "slam" | "charge" | "radial" | "aimed" | "teleport" | "beam" | "strikes"
  // the daily challenge's giga bosses (lib/game/defi): a rain of strikes around the player, a spiral of shots, a star of beams
  | "rain" | "spiral" | "fan";

export interface BossDef {
  dex: number;
  hp: number;
  speed: number;
  dmg: number;
  r: number;
  moves: BossMove[];
  shot: Elem;
  title: Txt;
  /** a giga boss (the daily challenge's wave 10): drawn twice as big, three phases, a roar and its guards between them */
  giga?: boolean;
}

export const BOSSES: BossDef[] = [
  { dex: 143, hp: 700, speed: 16, dmg: 20, r: 16, moves: ["slam"], shot: "normal", title: ["bloque la route !", "blocks the road!"] },
  { dex: 95, hp: 1300, speed: 30, dmg: 22, r: 16, moves: ["charge", "radial"], shot: "ground", title: ["sort de terre !", "bursts out of the ground!"] },
  { dex: 94, hp: 2000, speed: 34, dmg: 22, r: 13, moves: ["teleport", "aimed"], shot: "ghost", title: ["rôde dans l'ombre…", "lurks in the shadows…"] },
  { dex: 130, hp: 3000, speed: 36, dmg: 26, r: 16, moves: ["beam", "charge"], shot: "water", title: ["est furieux !", "is enraged!"] },
  { dex: 149, hp: 4200, speed: 42, dmg: 28, r: 14, moves: ["charge", "radial", "slam"], shot: "normal", title: ["déploie ses ailes !", "spreads its wings!"] },
  { dex: 150, hp: 5600, speed: 38, dmg: 30, r: 13, moves: ["teleport", "radial", "aimed"], shot: "psy", title: ["te défie.", "challenges you."] },
  { dex: 144, hp: 7000, speed: 44, dmg: 30, r: 15, moves: ["radial", "aimed"], shot: "ice", title: ["fait tomber la neige.", "brings the snow."] },
  { dex: 145, hp: 8500, speed: 50, dmg: 32, r: 15, moves: ["strikes", "charge"], shot: "elec", title: ["déchire le ciel !", "tears the sky!"] },
  { dex: 146, hp: 10000, speed: 46, dmg: 34, r: 15, moves: ["radial", "beam"], shot: "fire", title: ["embrase la plaine !", "sets the plain ablaze!"] },
  { dex: 151, hp: 12000, speed: 52, dmg: 36, r: 12, moves: ["teleport", "strikes", "radial", "aimed"], shot: "psy", title: ["joue avec toi.", "is playing with you."] },
];

/* ---------------- La Ligue: the waves past 300 (Johan, 2026-10-31: two players reached 300 in October) ---------------- */

/**
 * A Ligue wave's foes and bosses: this much more HP than the wave before, compounding on top of the classic curve (which
 * goes on in a straight line), and this much more damage. Tuned with a god-mode bot from the Ligue's start tier (level 600,
 * a full build, 2026-10-31): x1.10 a wave, a Dratini's bosses outlast their enrage from wave 360 and it's walled at 380
 * (x1.05: still clearing 420; x1.12: walled at 370); a Squirtle's walled at 330, whatever the rate (no growth per level).
 */
export const LIGUE_HP = 1.1;
export const LIGUE_DMG = 1.02;
/** the most one blow takes past wave 300: from 30 % of the max HP up to 60 % by wave 375 */
export const ligueHitCap = (w: number) => Math.min(0.6, 0.3 + (0.3 * Math.max(0, w - 300)) / 75);
/** the Ligue's ranks by the wave reached, a pip each (readable without colour) */
export const LIGUE_RANKS: { from: number; name: Txt }[] = [
  { from: 325, name: ["BRONZE", "BRONZE"] },
  { from: 350, name: ["ARGENT", "SILVER"] },
  { from: 375, name: ["OR", "GOLD"] },
  { from: 400, name: ["PLATINE", "PLATINUM"] },
  { from: 450, name: ["MAITRE", "MASTER"] },
];
export const ligueRank = (w: number) => LIGUE_RANKS.filter((r) => w >= r.from).length;
/** a damage share a Ligue boss takes from the types it resists */
export const RESIST = 0.4;
/**
 * The Conseil 4, a giga boss every 10th Ligue wave in turn (310 Olga, 320 Aldo, 330 Agatha, 340 Peter), then Le Maître
 * every 50th (350, 400…): three bosses at once. Each resists its own type and one more (Peter: « les dragons ne craignent
 * pas les dragons »), and has the late bosses' affixes.
 */
export interface LigueBoss {
  name: Txt;
  resist: Elem[];
  boss: BossDef;
}
export const COUNCIL: LigueBoss[] = [
  {
    name: ["OLGA", "LORELEI"], resist: ["ice", "water"],
    boss: { dex: 131, hp: 9000, speed: 30, dmg: 34, r: 22, moves: ["spiral", "rain", "fan"], shot: "ice", title: ["gèle l'arène.", "freezes the arena."], giga: true },
  },
  {
    name: ["ALDO", "BRUNO"], resist: ["fight", "dark"],
    boss: { dex: 68, hp: 9500, speed: 40, dmg: 36, r: 22, moves: ["charge", "slam", "rain"], shot: "fight", title: ["serre les poings.", "clenches his fists."], giga: true },
  },
  {
    name: ["AGATHA", "AGATHA"], resist: ["ghost", "poison"],
    boss: { dex: 94, hp: 9000, speed: 36, dmg: 34, r: 22, moves: ["teleport", "spiral", "rain"], shot: "ghost", title: ["ricane dans l'ombre.", "cackles in the dark."], giga: true },
  },
  {
    name: ["PETER", "LANCE"], resist: ["dragon", "fly"],
    boss: { dex: 149, hp: 10000, speed: 42, dmg: 36, r: 22, moves: ["charge", "fan", "rain"], shot: "dragon", title: ["les dragons ne craignent pas les dragons.", "dragons don't fear dragons."], giga: true },
  },
];
/** Le Maître's three: Pidgeot, Alakazam, then Arcanine or Rhydon in turn */
export const MASTER_NAME: Txt = ["LE MAITRE", "THE CHAMPION"];
export const MASTER: LigueBoss[] = [
  { name: ["ROUCARNAGE", "PIDGEOT"], resist: ["fly"], boss: { dex: 18, hp: 9000, speed: 52, dmg: 34, r: 15, moves: ["charge", "aimed"], shot: "fly", title: ["fond du ciel.", "dives from the sky."] } },
  { name: ["ALAKAZAM", "ALAKAZAM"], resist: ["psy"], boss: { dex: 65, hp: 8000, speed: 38, dmg: 34, r: 14, moves: ["teleport", "radial", "aimed"], shot: "psy", title: ["lit dans tes pensées.", "reads your mind."] } },
  { name: ["ARCANIN", "ARCANINE"], resist: ["fire"], boss: { dex: 59, hp: 9500, speed: 50, dmg: 36, r: 15, moves: ["charge", "radial"], shot: "fire", title: ["rugit.", "roars."] } },
  { name: ["RHINOFEROS", "RHYDON"], resist: ["ground"], boss: { dex: 112, hp: 11000, speed: 30, dmg: 38, r: 16, moves: ["slam", "charge"], shot: "ground", title: ["fait trembler le sol.", "shakes the ground."] } },
];

/** experience to reach the next level */
export const xpFor = (level: number) => Math.round(4 + level * 3 + Math.pow(level, 1.7) + 0.9 * Math.max(0, level - 15) ** 2);

/* ---------------- the Pension: permanent boosts, bought with what's left of a run's gold ---------------- */

export type PensionId =
  | "power" | "hp" | "speed" | "haste" | "magnet" | "xp" | "gold" | "reroll" | "revive"
  | "armor" | "crit" | "luck" | "regen" | "discount" | "pack";
export interface PensionDef {
  id: PensionId;
  name: Txt;
  /** what one level gives */
  desc: Txt;
  max: number;
  /** price of the first level (doubled in pensionCost); each next one costs 60 % more */
  cost: number;
  /** what one level adds, and what it is (shown "+4 % -> +6 % PV") */
  per: number;
  stat: Txt;
  /** a share (%), else a count */
  pct: boolean;
  /** it takes off (damage taken, prices): shown "−4 %" */
  less?: boolean;
  /** the levels each of the ranks 3 to 5 adds (default a quarter of the first rank's) */
  late?: number;
}
export const PENSION: PensionDef[] = [
  { id: "power", name: ["Entraînement", "Training"], desc: ["+2 % de dégâts", "+2% damage"], max: 10, cost: 30, per: 2, stat: ["dégâts", "damage"], pct: true },
  { id: "hp", name: ["Vitamines", "Vitamins"], desc: ["+4 % de PV max", "+4% max HP"], max: 10, cost: 30, per: 4, stat: ["PV max", "max HP"], pct: true },
  { id: "speed", name: ["Footing", "Jogging"], desc: ["+1,5 % de vitesse", "+1.5% speed"], max: 8, cost: 40, per: 1.5, stat: ["vitesse", "speed"], pct: true },
  { id: "haste", name: ["Méditation", "Meditation"], desc: ["capacités 1,5 % plus vite prêtes", "moves 1.5% sooner"], max: 8, cost: 50, per: 1.5, stat: ["recharge", "cooldowns"], pct: true },
  { id: "magnet", name: ["Gourmandise", "Sweet tooth"], desc: ["bonbons attirés 8 % plus loin", "candies pulled 8% further"], max: 6, cost: 20, per: 8, stat: ["aimant", "pull"], pct: true },
  { id: "xp", name: ["Leçons", "Lessons"], desc: ["+3 % d'expérience", "+3% experience"], max: 8, cost: 40, per: 3, stat: ["XP", "XP"], pct: true },
  { id: "gold", name: ["Flair", "Flair"], desc: ["+6 % d'or ramassé", "+6% gold picked up"], max: 8, cost: 25, per: 6, stat: ["or", "gold"], pct: true },
  { id: "reroll", name: ["Dé pipé", "Lucky die"], desc: ["+1 relance des cartes par partie", "+1 card reroll per run"], max: 3, cost: 120, per: 1, stat: ["relance", "reroll"], pct: false, late: 1 },
  { id: "revive", name: ["Rappel", "Revive"], desc: ["te relève une fois par partie", "gets you up once per run"], max: 1, cost: 400, per: 1, stat: ["rappel", "revive"], pct: false, late: 0 },
  // the second page (Johan, 2026-10-17: somewhere for the purse to go, now that a run starts with no gold)
  { id: "armor", name: ["Carapace", "Hard shell"], desc: ["−2,5 % de dégâts subis", "−2.5% damage taken"], max: 8, cost: 45, per: 2.5, stat: ["dégâts subis", "damage taken"], pct: true, less: true },
  { id: "crit", name: ["Concentration", "Focus"], desc: ["+1,5 % de chances de critique", "+1.5% crit chance"], max: 8, cost: 50, per: 1.5, stat: ["critiques", "crits"], pct: true },
  { id: "luck", name: ["Trèfle", "Clover"], desc: ["cartes rares 10 % plus fréquentes", "rare cards 10% more often"], max: 6, cost: 60, per: 10, stat: ["cartes rares", "rare cards"], pct: true },
  { id: "regen", name: ["Siestes", "Naps"], desc: ["+0,25 PV par seconde", "+0.25 HP a second"], max: 6, cost: 40, per: 0.25, stat: ["PV/s", "HP/s"], pct: false },
  { id: "discount", name: ["Carte fidélité", "Loyalty card"], desc: ["−4 % chez Kecleon", "−4% at Kecleon's"], max: 6, cost: 50, per: 4, stat: ["prix", "prices"], pct: true, less: true, late: 1 },
  { id: "pack", name: ["Sac à dos", "Backpack"], desc: ["+1 carte à choisir au départ", "+1 card to pick at the start"], max: 3, cost: 300, per: 1, stat: ["carte au départ", "starting card"], pct: false, late: 0 },
];
/**
 * The Pension's ranks (Johan, 2026-10-21: three players had it all and sat on millions of gold): each opens once the best
 * classic or coop wave reaches its wave. The 2nd adds half as many levels again as the first, the 3rd to the 5th a quarter
 * each (`late`: the Revive and the Backpack stop at the 2nd). Each rank has its colour on the tiles' pips.
 */
export const RANK_WAVES = [0, 100, 150, 200, 250];
export const rankOf = (best: number) => RANK_WAVES.filter((w) => best >= w).length;
/** an upgrade's levels once rank r is open */
export const pensionMax = (d: PensionDef, rank: number) =>
  d.max + (rank >= 2 ? Math.ceil(d.max / 2) : 0) + Math.max(0, rank - 2) * (d.late ?? Math.ceil(d.max / 4));
/** the rank a level (0-based) belongs to */
export const rankOfLevel = (d: PensionDef, level: number) => {
  let r = 1;
  while (r < RANK_WAVES.length && level >= pensionMax(d, r)) r++;
  return r;
};
/**
 * The purse is kept from run to run: dearer, and climbing faster (Johan, 2026-10-13). The 2nd rank climbs slower from the
 * first rank's last price, or its levels would cost hundreds of thousands; the 3rd to the 5th slower still. The whole of
 * the 5 ranks is about 1.8 M gold, the first two 360 k (lib/pensionStore PURSE_CAP).
 */
export const pensionCost = (d: PensionDef, level: number) => {
  const m2 = pensionMax(d, 2);
  if (level < d.max) return Math.round(d.cost * 2 * Math.pow(1.6, level));
  const last1 = d.cost * 2 * Math.pow(1.6, d.max - 1);
  if (level < m2) return Math.round(last1 * Math.pow(1.4, level - d.max + 1));
  return Math.round(last1 * Math.pow(1.4, m2 - d.max) * Math.pow(1.15, level - m2 + 1));
};

/**
 * Things to buy with the purse, once and for all (Johan, 2026-10-21: something for the gold to go to past the Pension): the
 * Shiny Charm, and Game Boy palettes (lib/game/gfx PALETTES, `obj`). Kept among the Pension's levels as "obj-<id>": 1.
 */
export interface PensionObject {
  id: string;
  name: Txt;
  desc: Txt;
  price: number;
}
export const OBJECTS: PensionObject[] = [
  { id: "chroma", name: ["Charme Chroma", "Shiny Charm"], desc: ["un shiny deux fois plus souvent", "shinies twice as often"], price: 60000 },
  { id: "pal-ruby", name: ["Palette Rubis", "Ruby palette"], desc: ["la Game Boy en rouge", "the Game Boy in red"], price: 15000 },
  { id: "pal-sapphire", name: ["Palette Saphir", "Sapphire palette"], desc: ["la Game Boy en bleu", "the Game Boy in blue"], price: 15000 },
  { id: "pal-gold", name: ["Palette Or", "Gold palette"], desc: ["la Game Boy dorée", "the Game Boy in gold"], price: 30000 },
];
export const ownsObject = (levels: Record<string, number>, id: string) => (levels[`obj-${id}`] ?? 0) > 0;

/* ---------------- the daily challenge: the same starter and rule for everyone, no Pension ---------------- */

export interface DailyMod {
  id: string;
  name: Txt;
  desc: Txt;
  spawn?: number;
  playerDmg?: number;
  enemyDmg?: number;
  elite?: number;
  gold?: number;
  xp?: number;
  /** a type that hits harder */
  elem?: [Elem, number];
  noCenter?: boolean;
}
export const DAILY_MODS: DailyMod[] = [
  { id: "horde", name: ["La horde", "The horde"], desc: ["50 % d'ennemis en plus, 20 % d'XP en plus.", "50% more foes, 20% more XP."], spawn: 1.5, xp: 1.2 },
  { id: "glass", name: ["Verre fragile", "Glass cannon"], desc: ["Tout le monde tape 50 % plus fort.", "Everyone hits 50% harder."], playerDmg: 1.5, enemyDmg: 1.5 },
  { id: "rain", name: ["Jour de pluie", "Rainy day"], desc: ["Eau et Électrik 30 % plus forts.", "Water and Electric 30% stronger."], elem: ["water", 1.3] },
  { id: "heat", name: ["Canicule", "Heatwave"], desc: ["Le Feu 40 % plus fort.", "Fire 40% stronger."], elem: ["fire", 1.4] },
  { id: "elite", name: ["Les cadors", "The tough ones"], desc: ["Trois fois plus d'ennemis dorés, deux fois plus d'or.", "Three times as many golden foes, twice the gold."], elite: 3, gold: 2 },
  { id: "alone", name: ["Sans Centre", "No Center"], desc: ["Pas de Centre Pokémon. Courage.", "No Pokémon Center. Good luck."], noCenter: true, xp: 1.15 },
];
