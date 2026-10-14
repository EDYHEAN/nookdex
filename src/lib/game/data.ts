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
};

export type BasicKind = "whip" | "ember" | "water" | "bolt" | "psycut" | "shadowball"
  // the daily challenge's Pokémon (lib/game/defi)
  | "swift" | "icy" | "splash" | "punch" | "slam" | "psyorb";
export type Basic = { kind: BasicKind; name: Txt; every: number; dmg: number };
/** what a Pokémon does on its own, outside the 4 slots: Mewtwo, Gengar, and each Pokémon of the daily challenge */
export type Sig = "psystrike" | "phantom" | "adapt" | "speed" | "ere" | "rage" | "counter" | "rest" | "teleport";

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
  /** that move, told on the daily challenge's screen */
  talent?: { name: Txt; desc: Txt };
}

export type Elem = "grass" | "fire" | "water" | "elec" | "ice" | "ghost" | "ground" | "psy" | "normal" | "fly" | "dragon" | "poison" | "fight";

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

/* ---------------- moves (auto-cast on their cooldown, or keys 1-4) and held items ---------------- */

export type MoveId =
  | "thunder" | "flamethrower" | "surf" | "leaf" | "ice" | "quake" | "shadow" | "protect" | "swift" | "psychic"
  | "quick" | "sleep" | "hyper" | "rocks" | "toxic" | "solar" | "twister"
  | "bubble" | "discharge" | "bone" | "firespin" | "sludge" | "icebeam" | "gigadrain" | "hex" | "aura" | "future"
  // the evolved ones
  | "fulgur" | "blast" | "hydro" | "petal" | "blizzard" | "draco" | "fissure"
  | "scald" | "zapcannon" | "poltergeist" | "sacredfire" | "closecombat" | "doomdesire" | "gunk";
export type ItemId =
  | "leftovers" | "band" | "scarf" | "claw" | "lens" | "magnet" | "share" | "hpup" | "root" | "shellbell" | "belt" | "lifeorb" | "helmet"
  | "eviolite" | "kingsrock" | "sash" | "spoon";

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
];

/** when there's nothing left to learn or raise: boosts that stack forever */
export type BonusId = "protein" | "ppup" | "sitrus";

/**
 * Combos: a hit of one type on a foe in a state. Water wets, fire burns, Toxic poisons, Sleep Powder and Blizzard put to
 * sleep; the right type next does more. Shown in the pause screen.
 */
export const COMBOS: { on: "wet" | "burn" | "poison" | "sleep"; by: Elem; mul: number; name: Txt }[] = [
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
];
export const BONUSES: { id: BonusId; name: Txt; desc: Txt }[] = [
  { id: "protein", name: ["Protéine", "Protein"], desc: ["+6 % de dégâts, pour toujours.", "+6% damage, for good."] },
  { id: "ppup", name: ["PP Plus", "PP Up"], desc: ["Capacités 4 % plus vite prêtes.", "Moves ready 4% sooner."] },
  { id: "sitrus", name: ["Baie Sitrus", "Sitrus Berry"], desc: ["Soigne 40 % de tes PV.", "Heals 40% of your HP."] },
];

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

export const WAVE_SECONDS = 30;

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

/** experience to reach the next level */
export const xpFor = (level: number) => Math.round(4 + level * 3 + Math.pow(level, 1.7) + 0.9 * Math.max(0, level - 15) ** 2);

/* ---------------- the Pension: permanent boosts, bought with what's left of a run's gold ---------------- */

export type PensionId = "power" | "hp" | "speed" | "haste" | "magnet" | "xp" | "gold" | "reroll" | "revive";
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
}
export const PENSION: PensionDef[] = [
  { id: "power", name: ["Entraînement", "Training"], desc: ["+2 % de dégâts", "+2% damage"], max: 10, cost: 30, per: 2, stat: ["dégâts", "damage"], pct: true },
  { id: "hp", name: ["Vitamines", "Vitamins"], desc: ["+4 % de PV max", "+4% max HP"], max: 10, cost: 30, per: 4, stat: ["PV max", "max HP"], pct: true },
  { id: "speed", name: ["Footing", "Jogging"], desc: ["+1,5 % de vitesse", "+1.5% speed"], max: 8, cost: 40, per: 1.5, stat: ["vitesse", "speed"], pct: true },
  { id: "haste", name: ["Méditation", "Meditation"], desc: ["capacités 1,5 % plus vite prêtes", "moves 1.5% sooner"], max: 8, cost: 50, per: 1.5, stat: ["recharge", "cooldowns"], pct: true },
  { id: "magnet", name: ["Gourmandise", "Sweet tooth"], desc: ["bonbons attirés 8 % plus loin", "candies pulled 8% further"], max: 6, cost: 20, per: 8, stat: ["aimant", "pull"], pct: true },
  { id: "xp", name: ["Leçons", "Lessons"], desc: ["+3 % d'expérience", "+3% experience"], max: 8, cost: 40, per: 3, stat: ["XP", "XP"], pct: true },
  { id: "gold", name: ["Flair", "Flair"], desc: ["+6 % d'or ramassé", "+6% gold picked up"], max: 8, cost: 25, per: 6, stat: ["or", "gold"], pct: true },
  { id: "reroll", name: ["Dé pipé", "Lucky die"], desc: ["+1 relance des cartes par partie", "+1 card reroll per run"], max: 3, cost: 120, per: 1, stat: ["relance", "reroll"], pct: false },
  { id: "revive", name: ["Rappel", "Revive"], desc: ["te relève une fois par partie", "gets you up once per run"], max: 1, cost: 400, per: 1, stat: ["rappel", "revive"], pct: false },
];
/** the purse is kept from run to run: dearer, and climbing faster (Johan, 2026-10-13) */
export const pensionCost = (d: PensionDef, level: number) => Math.round(d.cost * 2 * Math.pow(1.6, level));

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
