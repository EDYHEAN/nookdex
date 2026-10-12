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
};

export type BasicKind = "whip" | "ember" | "water" | "bolt";

export interface Starter {
  dex: number;
  /** evolutions: [dex, level] */
  evolves: [number, number][];
  hp: number;
  speed: number;
  basic: { kind: BasicKind; name: Txt; every: number; dmg: number };
  blurb: Txt;
  type: Elem;
}

export type Elem = "grass" | "fire" | "water" | "elec" | "ice" | "ghost" | "ground" | "psy" | "normal" | "fly";

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

/* ---------------- moves (auto-cast on their cooldown, or keys 1-4) and held items ---------------- */

export type MoveId = "thunder" | "flamethrower" | "surf" | "leaf" | "ice" | "quake" | "shadow" | "protect" | "swift" | "psychic";
export type ItemId = "leftovers" | "band" | "scarf" | "claw" | "lens" | "magnet" | "share" | "hpup" | "root";

export interface MoveDef {
  id: MoveId;
  name: Txt;
  type: Elem;
  /** what each level does, short */
  desc: Txt;
  /** cooldown at level 1..5 */
  cd: number[];
}

export const MOVES: MoveDef[] = [
  { id: "thunder", name: ["Tonnerre", "Thunderbolt"], type: "elec", desc: ["La foudre frappe des ennemis au hasard.", "Lightning strikes random foes."], cd: [2.8, 2.6, 2.4, 2.2, 1.9] },
  { id: "flamethrower", name: ["Lance-Flammes", "Flamethrower"], type: "fire", desc: ["Un cône de feu vers ta visée.", "A cone of fire where you aim."], cd: [4.5, 4.2, 3.9, 3.6, 3.2] },
  { id: "surf", name: ["Surf", "Surf"], type: "water", desc: ["Une vague autour de toi, qui repousse.", "A wave all around you, pushing back."], cd: [7, 6.5, 6, 5.5, 5] },
  { id: "leaf", name: ["Feuille Magik", "Magical Leaf"], type: "grass", desc: ["Des feuilles qui ne ratent jamais.", "Leaves that never miss."], cd: [2.2, 2.1, 2, 1.9, 1.7] },
  { id: "ice", name: ["Vent Glace", "Icy Wind"], type: "ice", desc: ["Des cristaux tournent autour de toi et ralentissent.", "Crystals circle you and slow foes."], cd: [6, 5.6, 5.2, 4.8, 4.4] },
  { id: "quake", name: ["Séisme", "Earthquake"], type: "ground", desc: ["Tout tremble : gros dégâts autour.", "Everything shakes: big damage around."], cd: [9, 8.4, 7.8, 7.2, 6.4] },
  { id: "shadow", name: ["Ball'Ombre", "Shadow Ball"], type: "ghost", desc: ["Une boule lente qui traverse tout.", "A slow orb that goes through it all."], cd: [3.4, 3.2, 3, 2.8, 2.5] },
  { id: "protect", name: ["Abri", "Protect"], type: "normal", desc: ["Une bulle qui bloque les coups.", "A bubble that blocks the hits."], cd: [12, 11, 10, 9, 8] },
  { id: "swift", name: ["Météores", "Swift"], type: "normal", desc: ["Des étoiles vers les plus proches.", "Stars at the closest foes."], cd: [1.6, 1.5, 1.4, 1.3, 1.1] },
  { id: "psychic", name: ["Psyko", "Psychic"], type: "psy", desc: ["Une aura qui blesse ceux qui s'approchent.", "An aura that hurts whoever comes close."], cd: [0.35, 0.33, 0.31, 0.29, 0.26] },
];

export interface ItemDef {
  id: ItemId;
  name: Txt;
  desc: Txt;
}

export const ITEMS: ItemDef[] = [
  { id: "leftovers", name: ["Restes", "Leftovers"], desc: ["Régénère des PV.", "Restores HP over time."] },
  { id: "band", name: ["Bandeau Choix", "Choice Band"], desc: ["+12 % de dégâts.", "+12% damage."] },
  { id: "scarf", name: ["Mouchoir Choix", "Choice Scarf"], desc: ["+8 % de vitesse.", "+8% speed."] },
  { id: "claw", name: ["Vive Griffe", "Quick Claw"], desc: ["Capacités plus vite prêtes (−8 %).", "Moves ready sooner (−8%)."] },
  { id: "lens", name: ["Lentilscope", "Scope Lens"], desc: ["+7 % de coups critiques.", "+7% critical hits."] },
  { id: "magnet", name: ["Aimant", "Magnet"], desc: ["Attire les bonbons de plus loin.", "Pulls candies from further away."] },
  { id: "share", name: ["Multi Exp", "Exp. Share"], desc: ["+12 % d'expérience.", "+12% experience."] },
  { id: "hpup", name: ["PV Plus", "HP Up"], desc: ["+20 PV max (et soigne).", "+20 max HP (and heals)."] },
  { id: "root", name: ["Grosse Racine", "Big Root"], desc: ["+10 % de zone d'effet.", "+10% area of effect."] },
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
  113: { dex: 113, hp: 160, speed: 54, dmg: 0, xp: 60, act: "treasure", r: 9 },
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
];
/** the early weak ones leave the field as the waves go on */
export const RETIRE: Record<number, number> = { 10: 8, 13: 8, 16: 11, 19: 12, 41: 14, 29: 15, 32: 15, 21: 17, 43: 17 };

export const WAVE_SECONDS = 30;

/* ---------------- bosses, every 5 waves ---------------- */

export type BossMove = "slam" | "charge" | "radial" | "aimed" | "teleport" | "beam" | "strikes";

export interface BossDef {
  dex: number;
  hp: number;
  speed: number;
  dmg: number;
  r: number;
  moves: BossMove[];
  shot: Elem;
  title: Txt;
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
export const xpFor = (level: number) => Math.round(4 + level * 3 + Math.pow(level, 1.7));
