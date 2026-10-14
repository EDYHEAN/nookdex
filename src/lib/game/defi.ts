// The daily challenge (Johan, 2026-10-14): ten waves against the clock. A wave ends when its last foe falls, then the next
// comes; a boss of its own at wave 5 and a giga boss at wave 10 (a Mega form, twice as big, in three phases). Beating it
// wins the day; the ladder is the time it took. One Pokémon a day of the week, never a starter, each with its own attack
// and talent, against foes of a theme. Same Pokémon, foes and cards for everyone (UTC day), no Pension nor purse.

import type { BossDef, Starter, Txt, Wild } from "./data";

/** the day the challenge replaced the old daily (a wave to reach in a classic run) */
export const DEFI_FROM = "2026-10-15";
export const DEFI_WAVES = 10;

/** the foes to beat in each wave (the boss waves: its guards, sent while it stands) */
export const DEFI_QUOTA = [26, 32, 38, 44, 24, 50, 56, 62, 70, 30];

/* ---------------- the Pokémon of the day ---------------- */

const EEVEE: Starter = {
  dex: 133,
  // the evolution changes with the day (defiOf): Vaporeon, Jolteon or Flareon
  evolves: [[135, 12]],
  hp: 120,
  speed: 72,
  basic: { kind: "swift", name: ["Météores", "Swift"], every: 0.5, dmg: 9 },
  evoBasic: {
    134: { kind: "water", name: ["Hydrocanon", "Hydro Pump"], every: 0.38, dmg: 9 },
    135: { kind: "bolt", name: ["Fatal-Foudre", "Thunder"], every: 0.5, dmg: 15 },
    136: { kind: "ember", name: ["Lance-Flammes", "Flamethrower"], every: 0.5, dmg: 15 },
  },
  blurb: ["Des étoiles qui suivent leur cible. Évolue au N.12, selon le jour.", "Stars that follow their target. Evolves at lv 12, depending on the day."],
  type: "normal",
  sig: "adapt",
  talent: { name: ["Adaptabilité", "Adaptability"], desc: ["+10 % de dégâts à chaque vague nettoyée.", "+10% damage for each wave cleared."] },
};

const GROWLITHE: Starter = {
  dex: 58,
  evolves: [[59, 11]],
  hp: 120,
  speed: 74,
  basic: { kind: "ember", name: ["Flammèche", "Ember"], every: 0.55, dmg: 12 },
  blurb: ["Boules de feu, et des charges éclair à travers la meute.", "Fireballs, and lightning charges through the pack."],
  type: "fire",
  sig: "speed",
  talent: { name: ["Vitesse Extrême", "Extreme Speed"], desc: ["Fonce à travers les ennemis et les brûle (Arcanin : plus souvent).", "Dashes through the foes and burns them (Arcanine: more often)."] },
};

const LAPRAS: Starter = {
  dex: 131,
  evolves: [],
  hp: 210,
  speed: 56,
  basic: { kind: "icy", name: ["Éclats Glace", "Ice Shard"], every: 0.5, dmg: 10 },
  blurb: ["Robuste et lent. La glace gèle ce que l'eau a mouillé.", "Sturdy and slow. Ice freezes what water has soaked."],
  type: "ice",
  sig: "ere",
  talent: { name: ["Surf glacé", "Icy Surf"], desc: ["Une vague autour de lui qui mouille tout, puis gèle. Coups reçus -25 %.", "A wave around it that soaks everything, then freezes. Hits taken -25%."] },
};

const MAGIKARP: Starter = {
  dex: 129,
  evolves: [[130, 8]],
  hp: 90,
  speed: 60,
  basic: { kind: "splash", name: ["Trempette", "Splash"], every: 0.5, dmg: 7 },
  evoBasic: { 130: { kind: "water", name: ["Cascade", "Waterfall"], every: 0.36, dmg: 10 } },
  blurb: ["Inutile… jusqu'au N.8. Ensuite, Léviator.", "Useless… until lv 8. Then, Gyarados."],
  type: "water",
  sig: "rage",
  talent: { name: ["Colère", "Outrage"], desc: ["Magicarpe : +50 % d'XP. Léviator : Ultralaser, et les coups reçus -25 %.", "Magikarp: +50% XP. Gyarados: Hyper Beam, and hits taken -25%."] },
};

const MACHOP: Starter = {
  dex: 66,
  evolves: [[67, 9], [68, 18]],
  hp: 140,
  speed: 64,
  basic: { kind: "punch", name: ["Poing-Karaté", "Karate Chop"], every: 0.45, dmg: 14 },
  blurb: ["Des coups en éventail, au contact. Plus il souffre, plus il cogne.", "Fanned blows, up close. The more it hurts, the harder it hits."],
  type: "fight",
  sig: "counter",
  talent: { name: ["Riposte", "Counter"], desc: ["Chaque coup reçu renvoie une onde de choc. Sous 50 % de PV : +30 % de dégâts.", "Each hit taken sends a shockwave back. Under 50% HP: +30% damage."] },
};

const SNORLAX: Starter = {
  dex: 143,
  evolves: [],
  hp: 280,
  speed: 54,
  basic: { kind: "slam", name: ["Plaquage", "Body Slam"], every: 0.8, dmg: 36 },
  blurb: ["Énorme. Écrase tout autour de lui, et ceux qui le touchent s'y piquent.", "Huge. Crushes all around it, and those who touch it regret it."],
  type: "normal",
  sig: "rest",
  talent: { name: ["Repos", "Rest"], desc: ["Sous 35 % de PV, il dort 2 s, intouchable, et se soigne tout (toutes les 25 s).", "Under 35% HP, it sleeps 2 s, untouchable, and heals fully (every 25 s)."] },
};

const ABRA: Starter = {
  dex: 63,
  evolves: [[64, 10], [65, 20]],
  hp: 85,
  speed: 70,
  basic: { kind: "psyorb", name: ["Choc Mental", "Confusion"], every: 0.5, dmg: 11 },
  blurb: ["Fragile, mais insaisissable. Des orbes psy qui suivent leur cible.", "Frail, but out of reach. Psychic orbs that follow their target."],
  type: "psy",
  sig: "teleport",
  talent: { name: ["Téléport", "Teleport"], desc: ["Un coup va le toucher ? Il se téléporte et laisse une mine psy (toutes les 2,5 s).", "About to be hit? It teleports and leaves a psychic mine (every 2.5 s)."] },
};

/* ---------------- the days: a Pokémon, a theme of foes, the boss of wave 5 and the giga boss of wave 10 ---------------- */

export interface DefiDay {
  mon: Starter;
  theme: Txt;
  /** the foes, by when they show up: from wave 1 (gone from wave 7), from wave 3, from wave 6 */
  early: number[];
  mid: number[];
  late: number[];
  boss: BossDef;
  giga: BossDef;
}

/** by the UTC day of the week (0 = Sunday) */
export const DEFI_DAYS: DefiDay[] = [
  {
    mon: ABRA,
    theme: ["Le labo", "The lab"],
    early: [81, 100, 147, 132, 137],
    mid: [82, 101, 125, 126],
    late: [82, 101, 125, 126, 142],
    boss: { dex: 148, hp: 4300, speed: 40, dmg: 26, r: 14, moves: ["beam", "charge", "radial"], shot: "dragon", title: ["ondule hors du labo.", "glides out of the lab."] },
    giga: { dex: 10150, hp: 27000, speed: 38, dmg: 32, r: 24, moves: ["rain", "spiral", "fan", "teleport"], shot: "psy", title: ["s'est échappé.", "broke free."], giga: true },
  },
  {
    mon: EEVEE,
    theme: ["Les Normaux", "The Normal ones"],
    early: [16, 19, 39, 52],
    mid: [17, 20, 83, 84, 40],
    late: [18, 53, 85, 108, 128, 132],
    boss: { dex: 128, hp: 5200, speed: 34, dmg: 26, r: 16, moves: ["charge", "slam"], shot: "normal", title: ["gratte le sol.", "paws the ground."] },
    giga: { dex: 10115, hp: 41000, speed: 30, dmg: 32, r: 24, moves: ["slam", "rain", "spiral", "charge"], shot: "normal", title: ["protège son petit.", "guards its little one."], giga: true },
  },
  {
    mon: GROWLITHE,
    theme: ["La nuit toxique", "The toxic night"],
    early: [41, 23, 92, 88],
    mid: [42, 109, 93, 24],
    late: [24, 110, 89, 93],
    boss: { dex: 89, hp: 4000, speed: 22, dmg: 26, r: 16, moves: ["slam", "radial"], shot: "poison", title: ["déborde !", "overflows!"] },
    giga: { dex: 10094, hp: 19500, speed: 36, dmg: 32, r: 22, moves: ["teleport", "spiral", "rain"], shot: "ghost", title: ["sort de ton ombre.", "rises from your shadow."], giga: true },
  },
  {
    mon: LAPRAS,
    theme: ["Le volcan", "The volcano"],
    early: [37, 77, 58],
    mid: [38, 126, 59],
    late: [38, 78, 126, 59],
    boss: { dex: 78, hp: 5200, speed: 44, dmg: 26, r: 14, moves: ["charge", "radial"], shot: "fire", title: ["galope dans les flammes.", "gallops through the flames."] },
    giga: { dex: 10006, hp: 15000, speed: 34, dmg: 34, r: 24, moves: ["fan", "spiral", "charge", "rain"], shot: "fire", title: ["crache des flammes bleues.", "breathes blue flames."], giga: true },
  },
  {
    mon: MAGIKARP,
    theme: ["Les fossiles", "The fossils"],
    early: [74, 27, 138, 104],
    mid: [75, 28, 139, 111],
    late: [76, 112, 141, 139],
    boss: { dex: 112, hp: 4600, speed: 30, dmg: 28, r: 16, moves: ["charge", "slam"], shot: "ground", title: ["fait trembler la terre.", "shakes the earth."] },
    giga: { dex: 10142, hp: 28000, speed: 44, dmg: 32, r: 22, moves: ["charge", "rain", "fan"], shot: "ground", title: ["fond du ciel.", "dives from the sky."], giga: true },
  },
  {
    mon: MACHOP,
    theme: ["Les psys", "The psychics"],
    early: [63, 79, 96, 102],
    mid: [64, 122, 124, 80],
    late: [65, 103, 124, 97],
    boss: { dex: 97, hp: 3000, speed: 32, dmg: 26, r: 13, moves: ["teleport", "aimed"], shot: "psy", title: ["balance son pendule…", "swings its pendulum…"] },
    giga: { dex: 10065, hp: 35000, speed: 34, dmg: 32, r: 22, moves: ["teleport", "spiral", "rain", "fan"], shot: "psy", title: ["plie les cuillères… et l'espace.", "bends spoons… and space."], giga: true },
  },
  {
    mon: SNORLAX,
    theme: ["La marée", "The tide"],
    early: [60, 72, 90, 98, 116, 118, 120],
    mid: [61, 73, 86, 117, 119, 121],
    late: [62, 87, 91, 99, 73, 121],
    boss: { dex: 99, hp: 3600, speed: 32, dmg: 28, r: 15, moves: ["charge", "aimed"], shot: "water", title: ["claque sa pince !", "snaps its claw!"] },
    giga: { dex: 10080, hp: 9000, speed: 26, dmg: 32, r: 24, moves: ["spiral", "rain", "fan", "slam"], shot: "water", title: ["se réveille… enfin.", "wakes up… at last."], giga: true },
  },
];

/** the starters given on the select screen too: the ladder takes their dex (game_submit2) */
export const DEFI_MONS = [ABRA, EEVEE, GROWLITHE, LAPRAS, MAGIKARP, MACHOP, SNORLAX];

/** the day's challenge: the same for everyone (UTC day) */
export function defiOf(day: string) {
  let h = 2166136261;
  for (const ch of day + "defi") h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h >>>= 0;
  const d = DEFI_DAYS[new Date(day + "T12:00:00Z").getUTCDay()];
  // Eevee's evolution: one of three, by the day
  const mon: Starter = d.mon === EEVEE ? { ...EEVEE, evolves: [[[134, 135, 136][h % 3], 12]] } : d.mon;
  return { day, seed: h, d: { ...d, mon } };
}
export type Defi = ReturnType<typeof defiOf>;

/** its gold: a bonus for beating it (the day's first win), and a little for each wave cleared (every run) */
export const DEFI_WIN_GOLD = 250;
export const defiWaveGold = (cleared: number) => 12 * cleared;

/* ---------------- its foes (the classic ones are in data's WILD) ---------------- */

export const DEFI_WILD: Record<number, Wild> = {
  // weak, from wave 1
  17: { dex: 17, hp: 26, speed: 40, dmg: 9, xp: 3, act: "erratic", r: 7 },
  39: { dex: 39, hp: 16, speed: 26, dmg: 7, xp: 2, act: "chase", r: 6 },
  37: { dex: 37, hp: 16, speed: 34, dmg: 8, xp: 2, act: "shoot", r: 6, shot: "fire" },
  77: { dex: 77, hp: 18, speed: 46, dmg: 8, xp: 2, act: "chase", r: 7 },
  88: { dex: 88, hp: 22, speed: 20, dmg: 8, xp: 2, act: "chase", r: 7 },
  138: { dex: 138, hp: 22, speed: 20, dmg: 8, xp: 2, act: "shoot", r: 6, shot: "water" },
  63: { dex: 63, hp: 12, speed: 30, dmg: 7, xp: 2, act: "ghost", r: 6 },
  79: { dex: 79, hp: 26, speed: 16, dmg: 8, xp: 2, act: "chase", r: 7 },
  96: { dex: 96, hp: 18, speed: 28, dmg: 8, xp: 2, act: "shoot", r: 7, shot: "psy" },
  102: { dex: 102, hp: 16, speed: 24, dmg: 7, xp: 2, act: "chase", r: 7 },
  60: { dex: 60, hp: 14, speed: 30, dmg: 7, xp: 2, act: "chase", r: 6 },
  72: { dex: 72, hp: 16, speed: 28, dmg: 7, xp: 2, act: "erratic", r: 6 },
  90: { dex: 90, hp: 22, speed: 22, dmg: 8, xp: 2, act: "shoot", r: 6, shot: "ice" },
  98: { dex: 98, hp: 18, speed: 30, dmg: 8, xp: 2, act: "chase", r: 6 },
  116: { dex: 116, hp: 14, speed: 30, dmg: 7, xp: 2, act: "shoot", r: 6, shot: "water" },
  118: { dex: 118, hp: 14, speed: 36, dmg: 7, xp: 2, act: "erratic", r: 6 },
  120: { dex: 120, hp: 16, speed: 40, dmg: 7, xp: 2, act: "erratic", r: 6 },
  147: { dex: 147, hp: 20, speed: 30, dmg: 8, xp: 2, act: "erratic", r: 6 },
  132: { dex: 132, hp: 24, speed: 30, dmg: 8, xp: 3, act: "chase", r: 6 },
  137: { dex: 137, hp: 20, speed: 26, dmg: 8, xp: 2, act: "shoot", r: 6, shot: "normal" },
  // tougher, from wave 3
  20: { dex: 20, hp: 40, speed: 50, dmg: 13, xp: 4, act: "chase", r: 8 },
  40: { dex: 40, hp: 50, speed: 24, dmg: 11, xp: 4, act: "chase", r: 8 },
  83: { dex: 83, hp: 34, speed: 44, dmg: 12, xp: 4, act: "charge", r: 7 },
  84: { dex: 84, hp: 32, speed: 54, dmg: 11, xp: 4, act: "erratic", r: 7 },
  38: { dex: 38, hp: 44, speed: 40, dmg: 12, xp: 4, act: "shoot", r: 8, shot: "fire" },
  126: { dex: 126, hp: 60, speed: 32, dmg: 13, xp: 5, act: "shoot", r: 8, shot: "fire" },
  28: { dex: 28, hp: 56, speed: 34, dmg: 13, xp: 5, act: "charge", r: 8 },
  139: { dex: 139, hp: 70, speed: 18, dmg: 13, xp: 5, act: "shoot", r: 9, shot: "water" },
  64: { dex: 64, hp: 36, speed: 32, dmg: 12, xp: 4, act: "ghost", r: 7 },
  122: { dex: 122, hp: 44, speed: 30, dmg: 12, xp: 4, act: "shoot", r: 8, shot: "psy" },
  124: { dex: 124, hp: 50, speed: 30, dmg: 12, xp: 5, act: "shoot", r: 8, shot: "ice" },
  80: { dex: 80, hp: 80, speed: 16, dmg: 13, xp: 5, act: "chase", r: 9 },
  61: { dex: 61, hp: 40, speed: 34, dmg: 11, xp: 4, act: "chase", r: 7 },
  73: { dex: 73, hp: 54, speed: 30, dmg: 12, xp: 5, act: "erratic", r: 8 },
  86: { dex: 86, hp: 46, speed: 30, dmg: 11, xp: 4, act: "chase", r: 8 },
  117: { dex: 117, hp: 40, speed: 34, dmg: 11, xp: 4, act: "shoot", r: 7, shot: "water" },
  119: { dex: 119, hp: 46, speed: 40, dmg: 12, xp: 4, act: "charge", r: 8 },
  121: { dex: 121, hp: 44, speed: 50, dmg: 12, xp: 5, act: "erratic", r: 7 },
  82: { dex: 82, hp: 46, speed: 24, dmg: 12, xp: 5, act: "shoot", r: 8, shot: "elec" },
  101: { dex: 101, hp: 40, speed: 56, dmg: 30, xp: 4, act: "explode", r: 8 },
  125: { dex: 125, hp: 60, speed: 40, dmg: 14, xp: 5, act: "chase", r: 8 },
  // the late ones, from wave 6
  18: { dex: 18, hp: 70, speed: 58, dmg: 16, xp: 6, act: "erratic", r: 9 },
  53: { dex: 53, hp: 66, speed: 56, dmg: 16, xp: 6, act: "chase", r: 8 },
  85: { dex: 85, hp: 80, speed: 50, dmg: 17, xp: 6, act: "charge", r: 9 },
  108: { dex: 108, hp: 120, speed: 22, dmg: 16, xp: 7, act: "chase", r: 10 },
  110: { dex: 110, hp: 90, speed: 20, dmg: 15, xp: 7, act: "shoot", r: 10, shot: "poison" },
  78: { dex: 78, hp: 80, speed: 62, dmg: 17, xp: 7, act: "charge", r: 9 },
  141: { dex: 141, hp: 90, speed: 50, dmg: 18, xp: 7, act: "chase", r: 9 },
  103: { dex: 103, hp: 130, speed: 18, dmg: 16, xp: 7, act: "shoot", r: 11, shot: "grass" },
  97: { dex: 97, hp: 90, speed: 28, dmg: 16, xp: 7, act: "shoot", r: 9, shot: "psy" },
  62: { dex: 62, hp: 100, speed: 34, dmg: 17, xp: 7, act: "chase", r: 9 },
  87: { dex: 87, hp: 100, speed: 28, dmg: 16, xp: 7, act: "shoot", r: 10, shot: "ice" },
  91: { dex: 91, hp: 140, speed: 16, dmg: 16, xp: 7, act: "shoot", r: 10, shot: "ice" },
  99: { dex: 99, hp: 100, speed: 30, dmg: 18, xp: 7, act: "charge", r: 10 },
};

/** the big ones, from wave 3: a foe of the theme twice as big, ten times as tough */
export const TITAN = { scale: 1.8, hp: 10, dmg: 1.6, speed: 0.8, xp: 8 };
