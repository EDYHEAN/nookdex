// The NookBoy survival game: one starter against waves of wild Pokémon. A fixed 60 Hz step, drawn on a 320x288 canvas.
// React (components/game/NookBoy) owns the menus and the shell; the engine tells it when its phase changes.

import { unlock } from "@/lib/trophyStore";
import { gsfx, music } from "./audio";
import {
  BONUSES, BOSSES, COMBOS, ITEMS, PACKS, PACK_ODDS, MAX_ITEMS, MAX_LEVEL, MAX_MOVES, MOVES, NAMES, POOLS, RARITY, RETIRE, REWARD_STARTERS, STARTERS, UNLOCK_STARTERS, WILD, BIOMES, BIOME_WAVES, WEATHERS, type WeatherId, waveAt, waveLength, waveStart, xpFor,
  DAILY_MODS, type BonusId, type DailyMod, type PensionId, type Rarity, type BossDef, type BossMove, type Elem, type ItemId, type Lang, type MoveId, type PackDef, type PackId, type Starter, type Wild,
} from "./data";
import { DEFI_DAYS, DEFI_MONS, DEFI_QUOTA, DEFI_WAVES, DEFI_WILD, TITAN, type Defi } from "./defi";
import { SH, SW, T, TILE, TYPE_FX, anim, animSeconds, dirOf, frameAt, mon, type AnimName, type ColorKey, type Gfx } from "./gfx";

/** after each boss, a break: everyone healed, the levels won, shop (Kecleon's), countdown (3-2-1) */
export type Phase = "title" | "select" | "play" | "levelup" | "evolve" | "paused" | "dying" | "over" | "shop" | "countdown";
/** "daily": the old daily (a wave to reach in a classic run), until 2026-10-14; "defi": the daily challenge since (lib/game/defi) */
export type Mode = "classic" | "daily" | "coop" | "defi";
/** the classic and coop runs end there, won once its giga boss falls (Johan, 2026-10-17: 100 was too close) */
export const MAX_WAVE = 200;
/** past it, the titans: one every few seconds, and a giga boss every 10th wave; reaching it opens the Pension's 2nd rank */
export const BEYOND = 100;
/** a classic giga boss's HP before the wave's multiplier (the daily's are tuned for its 10 waves) */
const GIGA_HP = 9000;
/** a wild Pokémon's damage past wave 100: this much more of its base a wave */
const BEYOND_DMG = 0.3;
/**
 * The start tiers (Johan, 2026-10-17: not the first 50 waves all over again): a classic or coop run may start at a tier
 * reached before (its wave, its boss), the Pokémon at about the level a run has there, evolved, and a draft of cards to
 * pick first. A card per level, as a run played that far (a friend's feedback, 2026-10-18: 11 cards at wave 25, against
 * the 50-odd of a run, couldn't hold its boss). All of them come at once as a build pack picked out of 3 (`PACKS`), no card
 * by card after it (Johan, 2026-10-18); past the 48 a full build and its evolutions take, the stacking boosts a run
 * picks then (2 Proteins for a PP Up): without them a wave-125 start knocked out 2 foes in 9 s.
 */
export const TIERS = [25, 50, 75, 100, 125, 150, 175];
/**
 * The level a start tier gives: about a played run's by then (the ladder, 2026-10-18: ~60 at wave 25, ~120 at 50, 148 at
 * 92, the XP curve steepening), wave 25 a little under (a friend found it right with its pack), past 100 as before (no run
 * went that far yet). Wave 50 at 80 was too weak: 40 levels short is 40 boosts short.
 */
const TIER_LEVEL: Record<number, number> = { 25: 42, 50: 110, 75: 140, 100: 165, 125: 200, 150: 240, 175: 280 };
export const tierLevel = (tier: number) => TIER_LEVEL[tier] ?? Math.round(1.6 * tier);
/** the types that put a foe in each state (the combos' first half) */
const STATE_BY: Record<(typeof COMBOS)[number]["on"], Elem[]> = { wet: ["water"], burn: ["fire"], poison: ["poison"], sleep: ["grass", "ice", "dark"], charm: ["fairy"] };
export const tierPicks = (tier: number) => tierLevel(tier) - 1;
/**
 * A start tier's ramp (Johan, 2026-10-18: dropped into wave 25 at its full rate, the crowd closed in at once): the foes
 * come slowly at first, at the wave's full rate after RAMP seconds, and the tier's boss after BOSS_LATE.
 */
const RAMP = 60;
const BOSS_LATE = 30;
/**
 * The shortest a move's cooldown gets, a share of its own (Quick Claw, PP Ups, the Pension): past it the screen is a
 * blur and the frame rate drops. 0.4 until 2026-10-18 (a friend: "past a point the moves stop speeding up"), and the PP
 * Ups kept coming once it was reached: they're no longer offered there.
 */
const HASTE_FLOOR = 0.3;
/**
 * The late game (Clément, 2026-10-18: past a point only Proteins, PP Ups and berries came up): a 5th move and a 5th item
 * once the 50th boss has fallen, titans among the foes from wave 50 (past 100 they come more often), bosses tougher as
 * the waves go (they fell in a few seconds late in a run).
 */
const SLOT5_WAVE = 50;
const TITANS_FROM = 50;
/** a boss's extra HP a wave past the 25th, up to 50 waves of it (x2.5: x4 at wave 100 left a start there stuck on it) */
const BOSS_LATE_HP = 0.03;
/** the most one blow takes, a share of the max HP */
const HIT_CAP = 0.3;
/** the daily challenge's Pokémon won with (dex of their first form), for "defi-week": per device */
export const DEFI_WINS_KEY = "nookdex:defi-wins";

/** what a run is played with: the Pension's levels (none in the daily), the daily's rule */
export interface RunSetup {
  mode: Mode;
  perm: Partial<Record<PensionId, number>>;
  daily?: { day: string; mod: DailyMod; starter: number; target: number };
  defi?: Defi;
  /** a start tier's wave (classic and coop), else from wave 1 */
  start?: number;
}

/** the day's challenge: the same starter and rule for everyone (UTC day) */
export function dailyOf(day: string) {
  let h = 2166136261;
  for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h >>>= 0;
  // the goal: a wave to reach, 8 to 12 (lower on the harder rules)
  const mod = DAILY_MODS[(h >>> 3) % DAILY_MODS.length];
  const hard = mod.id === "glass" || mod.id === "alone" || mod.id === "elite";
  return { day, starter: h % STARTERS.length, mod, seed: h, target: (hard ? 8 : 9) + ((h >>> 6) % 4) };
}
/** the daily's gold: a big bonus once its wave is reached, a little per wave anyway */
export const dailyReward = (wave: number, won: boolean) => (won ? 150 : 0) + 10 * wave;
export const today = () => new Date().toISOString().slice(0, 10);

/** a small seeded random (mulberry32): the daily's cards come in the same order for everyone */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ShopOffer {
  choice: Choice;
  price: number;
  sold: boolean;
}
export type FireMode = "auto" | "click" | "nearest";

export interface Input {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /** the pointer, in game pixels (null: outside the screen) */
  aim: { x: number; y: number } | null;
  /** mouse button or space held */
  firing: boolean;
}

export interface Choice {
  /** evolve: a move at its last level and its item make a stronger move; bonus: what's left once all is learnt; pack: a
   * start tier's build */
  kind: "move" | "item" | "heal" | "evolve" | "bonus" | "pack";
  id?: MoveId | ItemId | BonusId | PackId;
  rarity?: Rarity;
  /** the level it goes to (1 = new) */
  level: number;
}

export interface RunStats {
  mode: Mode;
  /** the daily's day */
  day?: string;
  /** gold left at the end: for the Pension (the daily's bonus included) */
  gold: number;
  dailyBonus: number;
  /** the daily's goal was reached */
  dailyWon?: boolean;
  /** the run was won: the daily challenge's giga boss, or the classic's 100th wave */
  won?: boolean;
  wave: number;
  kills: number;
  level: number;
  /** on the run's clock, which starts at a start tier's wave: the skipped waves count (the ladder's time check) */
  seconds: number;
  /** the start tier's wave, else 1 */
  start: number;
  starter: number;
  dex: number;
  /** the second player's Pokémon, in coop (and the starter it was) */
  dex2?: number;
  starter2?: number;
}

interface Enemy {
  w: Wild | null;
  boss: BossDef | null;
  dex: number;
  x: number;
  y: number;
  /** knockback */
  kx: number;
  ky: number;
  hp: number;
  max: number;
  speed: number;
  dmg: number;
  r: number;
  dir: number;
  t: number;
  hitT: number;
  slowT: number;
  /** asleep (Sleep Powder) or frozen (Blizzard): it doesn't move nor hurt */
  sleepT: number;
  /** wet (water), burnt and poisoned: they set up the combos; burns and poison hurt over time */
  wetT: number;
  burnT: number;
  burnDps: number;
  poisonT: number;
  poisonDps: number;
  /** charmed (Fairy): it goes for its neighbours, not for the player */
  charmT: number;
  dotT: number;
  state: string;
  stateT: number;
  /** a boss's next move */
  actT: number;
  elite: boolean;
  /** the daily challenge's big ones: drawn bigger, much tougher */
  titan?: boolean;
  /** the classic's last boss (wave 100): beating it wins */
  final?: boolean;
  /** height above the ground (a boss's slam) */
  z: number;
  alpha: number;
  aim: { x: number; y: number };
  /** continuous damage (aura, crystals) waits a little between two hits */
  touchT: number;
  /** shots left in a boss's volley */
  n: number;
  dead: boolean;
  deadT: number;
  seed: number;
}

interface Shot {
  kind: "ember" | "water" | "leaf" | "shadow" | "swift" | "flame" | "foe" | "blast" | "bubble" | "scald" | "bone" | "sludge" | "aura" | "psycut" | "gball" | "ice" | "psyorb" | "blade"
    | "rock" | "fairy" | "dragon";
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  pierce: number;
  life: number;
  elem: Elem;
  hit?: Set<Enemy>;
  target?: Enemy | null;
  t: number;
  /** a bone on its way back */
  back?: boolean;
  /** a blob of sludge: the puddle it leaves */
  pool?: { r: number; dps: number };
}

interface Pickup {
  kind: "candy" | "oran" | "rare" | "magnet" | "egg" | "coin";
  x: number;
  y: number;
  /** pop-out arc */
  z: number;
  vz: number;
  value: number;
  pull: boolean;
  t: number;
}

interface Fx {
  kind:
    | "whip" | "bolt" | "strike" | "ring" | "quake" | "boom" | "warn" | "beam" | "levelup" | "text" | "slashwarn" | "poof" | "cloud" | "hbeam" | "meteor"
    | "tornado" | "zone" | "mark" | "punch";
  x: number;
  y: number;
  t: number;
  life: number;
  a?: number;
  r?: number;
  pts?: [number, number][];
  elem?: Elem;
  text?: string;
  color?: ColorKey;
  /** a shockwave: whom it already hit, how far it went */
  hit?: Set<Enemy>;
  /** a wave that heals the player for each foe it hits (Hydro Pump), its total so far */
  heal?: number;
  /** a cloud's (or a tornado's) next tick */
  tick?: number;
  /** a beam's charging time */
  charge?: number;
  vx?: number;
  vy?: number;
  /** who cast it (a beam follows them while it charges; a level-up's light) */
  owner?: Player;
  done?: number;
  dmg?: number;
  foe?: boolean;
  x2?: number;
  y2?: number;
  /** Future Sight: the foe it follows */
  target?: Enemy | null;
}

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: ColorKey;
  size: number;
  grav: number;
  kind: "dot" | "puff" | "leaf" | "spark" | "rain" | "petal" | "firefly" | "hail" | "sand";
}

interface Num {
  x: number;
  y: number;
  t: number;
  text: string;
  color: ColorKey;
  big: boolean;
}

const STEP = 1 / 60;
const PLAYER_R = 7;
const VIEW_R = Math.hypot(SW, SH) / 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <X,>(xs: X[]) => xs[Math.floor(Math.random() * xs.length)];
const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;

/** a player: everything that's theirs (the Game reaches the current one through its accessors) */
export class Player {
  id: number;
  starter: Starter = STARTERS[0];
  dex: number = 1;
  stage: number = 0;
  x: number = 0;
  y: number = 0;
  dir: number = 0;
  moving: boolean = false;
  hurtT: number = 0;
  invuln: number = 0;
  shieldT: number = 0;
  hp: number = 100;
  maxHp: number = 100;
  level: number = 1;
  xp: number = 0;
  moves: { id: MoveId; level: number; cd: number; active: number }[] = [];
  items: { id: ItemId; level: number }[] = [];
  pendingLevels: number = 0;
  /** a start tier's build pack still to pick: the cards it takes out of the pending ones */
  pack: number = 0;
  choices: Choice[] = [];
  evo: { from: number; to: number; t: number; cancelled: boolean } | null = null;
  evoBlocked: number = 0;
  input: Input = { up: false, down: false, left: false, right: false, aim: null, firing: false };
  held: { key: boolean; mouse: boolean } = { key: false, mouse: false };
  choiceAt: number = 0;
  basicT: number = 0;
  rerolls: number = 0;
  revives: number = 0;
  bonusPower: number = 0;
  bonusHaste: number = 1;
  dashT: number = 0;
  dashV: { x: number; y: number } = { x: 0, y: 0 };
  dashHit: Set<Enemy> = new Set<Enemy>();
  trail: { x: number; y: number; dir: number; t: number }[] = [];
  rocks: { x: number; y: number; life: number; hits: number; seed: number }[] = [];
  hurtFlash: number = 0;
  cam: { x: number; y: number } = { x: 0, y: 0 };
  aimV: { x: number; y: number } = { x: 0, y: 1 };
  /** Mewtwo's Psystrike, Gengar's Phantom Force: its next one */
  sigT = 2;
  /** Gengar sunk into the shadows (Phantom Force): how long until it bursts out */
  phaseT = 0;
  /** the daily challenge's talents: Teleport's and Rest's wait, Rest's sleep, Extreme Speed's (and Rollout's) dash */
  sigCd = 0;
  restT = 0;
  dashDmg = 0;
  dashElem: Elem = "fire";
  dashSpeed = 340;
  /** Focus Sash: when it can save them again */
  sashCd = 0;
  /** knocked out in a coop run, waiting for a partner to get them up */
  down = false;
  reviveT = 0;
  constructor(id: number) {
    this.id = id;
  }
}

export class Game {
  gfx: Gfx;
  lang: Lang;
  phase: Phase = "title";
  fireMode: FireMode = "auto";
  manualMoves = false;
  /** told when the phase or the menus' data change */
  onChange: () => void = () => {};

  /** the players (1, or 2 in coop), and the one the Game is busy with right now */
  players: Player[] = [new Player(0)];
  cur: Player = this.players[0];
  get starter(): Starter {
    return this.cur.starter;
  }
  set starter(v: Starter) {
    this.cur.starter = v;
  }
  get dex(): number {
    return this.cur.dex;
  }
  set dex(v: number) {
    this.cur.dex = v;
  }
  get stage(): number {
    return this.cur.stage;
  }
  set stage(v: number) {
    this.cur.stage = v;
  }
  get x(): number {
    return this.cur.x;
  }
  set x(v: number) {
    this.cur.x = v;
  }
  get y(): number {
    return this.cur.y;
  }
  set y(v: number) {
    this.cur.y = v;
  }
  get dir(): number {
    return this.cur.dir;
  }
  set dir(v: number) {
    this.cur.dir = v;
  }
  get moving(): boolean {
    return this.cur.moving;
  }
  set moving(v: boolean) {
    this.cur.moving = v;
  }
  get hurtT(): number {
    return this.cur.hurtT;
  }
  set hurtT(v: number) {
    this.cur.hurtT = v;
  }
  get invuln(): number {
    return this.cur.invuln;
  }
  set invuln(v: number) {
    this.cur.invuln = v;
  }
  get shieldT(): number {
    return this.cur.shieldT;
  }
  set shieldT(v: number) {
    this.cur.shieldT = v;
  }
  get hp(): number {
    return this.cur.hp;
  }
  set hp(v: number) {
    this.cur.hp = v;
  }
  get maxHp(): number {
    return this.cur.maxHp;
  }
  set maxHp(v: number) {
    this.cur.maxHp = v;
  }
  get level(): number {
    return this.cur.level;
  }
  set level(v: number) {
    this.cur.level = v;
  }
  get xp(): number {
    return this.cur.xp;
  }
  set xp(v: number) {
    this.cur.xp = v;
  }
  get moves(): { id: MoveId; level: number; cd: number; active: number }[] {
    return this.cur.moves;
  }
  set moves(v: { id: MoveId; level: number; cd: number; active: number }[]) {
    this.cur.moves = v;
  }
  get items(): { id: ItemId; level: number }[] {
    return this.cur.items;
  }
  set items(v: { id: ItemId; level: number }[]) {
    this.cur.items = v;
  }
  get pendingLevels(): number {
    return this.cur.pendingLevels;
  }
  set pendingLevels(v: number) {
    this.cur.pendingLevels = v;
  }
  get choices(): Choice[] {
    return this.cur.choices;
  }
  set choices(v: Choice[]) {
    this.cur.choices = v;
  }
  get evo(): { from: number; to: number; t: number; cancelled: boolean } | null {
    return this.cur.evo;
  }
  set evo(v: { from: number; to: number; t: number; cancelled: boolean } | null) {
    this.cur.evo = v;
  }
  get evoBlocked(): number {
    return this.cur.evoBlocked;
  }
  set evoBlocked(v: number) {
    this.cur.evoBlocked = v;
  }
  get input(): Input {
    return this.cur.input;
  }
  set input(v: Input) {
    this.cur.input = v;
  }
  get held(): { key: boolean; mouse: boolean } {
    return this.cur.held;
  }
  set held(v: { key: boolean; mouse: boolean }) {
    this.cur.held = v;
  }
  get choiceAt(): number {
    return this.cur.choiceAt;
  }
  set choiceAt(v: number) {
    this.cur.choiceAt = v;
  }
  get basicT(): number {
    return this.cur.basicT;
  }
  set basicT(v: number) {
    this.cur.basicT = v;
  }
  get rerolls(): number {
    return this.cur.rerolls;
  }
  set rerolls(v: number) {
    this.cur.rerolls = v;
  }
  get revives(): number {
    return this.cur.revives;
  }
  set revives(v: number) {
    this.cur.revives = v;
  }
  get bonusPower(): number {
    return this.cur.bonusPower;
  }
  set bonusPower(v: number) {
    this.cur.bonusPower = v;
  }
  get bonusHaste(): number {
    return this.cur.bonusHaste;
  }
  set bonusHaste(v: number) {
    this.cur.bonusHaste = v;
  }
  get dashT(): number {
    return this.cur.dashT;
  }
  set dashT(v: number) {
    this.cur.dashT = v;
  }
  get dashV(): { x: number; y: number } {
    return this.cur.dashV;
  }
  set dashV(v: { x: number; y: number }) {
    this.cur.dashV = v;
  }
  get dashHit(): Set<Enemy> {
    return this.cur.dashHit;
  }
  set dashHit(v: Set<Enemy>) {
    this.cur.dashHit = v;
  }
  get trail(): { x: number; y: number; dir: number; t: number }[] {
    return this.cur.trail;
  }
  set trail(v: { x: number; y: number; dir: number; t: number }[]) {
    this.cur.trail = v;
  }
  get rocks(): { x: number; y: number; life: number; hits: number; seed: number }[] {
    return this.cur.rocks;
  }
  set rocks(v: { x: number; y: number; life: number; hits: number; seed: number }[]) {
    this.cur.rocks = v;
  }
  get hurtFlash(): number {
    return this.cur.hurtFlash;
  }
  set hurtFlash(v: number) {
    this.cur.hurtFlash = v;
  }
  get cam(): { x: number; y: number } {
    return this.cur.cam;
  }
  set cam(v: { x: number; y: number }) {
    this.cur.cam = v;
  }
  get aimV(): { x: number; y: number } {
    return this.cur.aimV;
  }
  set aimV(v: { x: number; y: number }) {
    this.cur.aimV = v;
  }

  /** runs fn as each player still standing (the current player put back after) */
  private eachAlive(fn: (p: Player) => void) {
    const keep = this.cur;
    for (const p of this.players) {
      if (p.down) continue;
      this.cur = p;
      fn(p);
      if (this.phase !== "play") return;
    }
    this.cur = keep;
  }
  private alive() {
    return this.players.filter((p) => !p.down);
  }
  /** the standing player closest to a point (a foe's target) */
  private nearestPlayer(x: number, y: number) {
    let best = this.players[0];
    let bd = Infinity;
    for (const p of this.players) {
      if (p.down) continue;
      const d = dist2(p.x, p.y, x, y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  // the run
  animT = 0;
  time = 0;
  kills = 0;
  wave = 1;
  lastStats: RunStats | null = null;

  /** the run's setup (mode, Pension, daily) */
  setup: RunSetup = { mode: "classic", perm: {} };
  gold = 0;
  /** Kecleon on the field, and its offers once you meet it */
  offers: ShopOffer[] = [];
  shopRerolls = 0;
  /**
   * Kecleon's swap (Johan, 2026-10-18): give up a move or an item ("give": what you have), then take one of 3 drawn of
   * the same kind ("take"), at the level of the one given. Drawn, never chosen from the whole list: a broken build
   * stays luck. Dearer each time at the same stall.
   */
  swapMode: "give" | "take" | null = null;
  swapList: Choice[] = [];
  private swapFrom: Choice | null = null;
  shopSwaps = 0;
  /** the break after a boss is on (Center, levels, shop, then the 3-2-1) */
  private inBreak = false;
  private shopDone = false;
  countT = 0;
  private cardRng: () => number = Math.random;
  private enemies: Enemy[] = [];
  private shots: Shot[] = [];
  private foes: Shot[] = [];
  private pickups: Pickup[] = [];
  private fx: Fx[] = [];
  private parts: Part[] = [];
  private nums: Num[] = [];
  private spawnAcc = 0;
  private treasureAt = -1;
  /** past wave 100: the next titan's wait, and the wave its banner was shown */
  private titanT = 0;
  /** foes charmed this run (the "Charmer" trophy) */
  private charmed = 0;
  /** the run's clock at its start: 0, or a start tier's (the draft's cards are picked then) */
  startAt = 0;
  /** the wave's weather (none in the daily challenge) */
  weather: WeatherId | null = null;
  /** a start tier's boss, on its way (the time it comes, 0: none) */
  private bossDue = 0;
  private titanWave = 0;
  /** the daily challenge: the wave's foes still to come, the next group's wait, the pause between two waves */
  private defiLeft = 0;
  private defiGroupT = 0;
  private defiGap = 0;
  private defiTitans = 0;
  /** won: the run ends a moment after (the last loot flying) */
  private endAt = 0;
  private bossAlive: Enemy | null = null;
  /** when the break starts: a moment after the boss falls, its loot bursting out first */
  private breakAt = 0;
  private shake = 0;
  private flash = 0;
  private grid = new Map<number, Enemy[]>();
  private stepT = 0;
  private dyingT = 0;
  private bannerT = 0;
  private banner = "";
  private bannerSub = "";
  private menuT = 0;
  private wanderers: { dex: number; x: number; y: number; vx: number; t: number }[] = [];
  selected = 0;
  /**
   * Who's on the starter screen: the four starters, Mewtwo or Gengar for the players given them (game_rewards), then the
   * four to unlock (a silhouette until they are: `unlocked`, their dex numbers)
   */
  roster: Starter[] = [...STARTERS, ...UNLOCK_STARTERS];
  private unlocked = new Set<number>();
  setRoster(rewards: string[], unlocked: number[]) {
    this.roster = [...STARTERS, ...REWARD_STARTERS.filter((s) => rewards.includes(s.reward!)), ...UNLOCK_STARTERS];
    this.unlocked = new Set(unlocked);
    if (this.selected >= this.roster.length) this.selected = 0;
  }
  locked(i: number) {
    const s = this.roster[i];
    return !!s?.unlock && !this.unlocked.has(s.dex);
  }

  constructor(gfx: Gfx, lang: Lang) {
    this.gfx = gfx;
    this.lang = lang;
  }

  /* ---------------- what the shell sets ---------------- */

  setLang(lang: Lang) {
    this.lang = lang;
  }
  configure(fire: FireMode, manual: boolean) {
    this.fireMode = fire;
    this.manualMoves = manual;
  }
  move(dir: "up" | "down" | "left" | "right", down: boolean, pid = 0) {
    const p = this.players[pid];
    if (p) p.input[dir] = down;
  }
  /** the pointer over a screen, in game pixels (null: it left) */
  aimAt(at: { x: number; y: number } | null, pid = 0) {
    const p = this.players[pid];
    if (!p) return;
    p.input.aim = at;
    if (!at) this.fire("mouse", false, pid);
  }
  /** space or the mouse button (or the A button) held */
  fire(by: "key" | "mouse", down: boolean, pid = 0) {
    const p = this.players[pid];
    if (!p) return;
    p.held[by] = down;
    p.input.firing = p.held.key || p.held.mouse;
  }
  release() {
    for (const p of this.players) {
      p.input = { up: false, down: false, left: false, right: false, aim: p.input.aim, firing: false };
      p.held = { key: false, mouse: false };
    }
  }
  select(i: number) {
    this.selected = (i + this.roster.length) % this.roster.length;
    this.onChange();
  }
  get canChoose() {
    return performance.now() - this.choiceAt > 450;
  }

  private tr(fr: string, en: string) {
    return this.lang === "fr" ? fr : en;
  }
  name(dex: number) {
    return NAMES[dex]?.[this.lang === "fr" ? 0 : 1] ?? "?";
  }

  /* ---------------- stats from held items and the evolution stage ---------------- */

  itemLevel(id: ItemId) {
    return this.items.find((i) => i.id === id)?.level ?? 0;
  }
  private perm(id: PensionId) {
    return this.setup.perm[id] ?? 0;
  }
  get power() {
    return (1 + 0.02 * this.perm("power")) * (this.setup.daily?.mod.playerDmg ?? 1) * (1 + this.stage * 0.18) * (1 + 0.12 * this.itemLevel("band")) * (1 + 0.1 * this.itemLevel("lifeorb")) * (1 + this.bonusPower) * (this.starter.power ?? 1) * (1 + (this.starter.growth ?? 0) * (this.level - 1)) * this.defiPower;
  }
  /** the daily challenge is quicker and stronger (x1.5); Eevee grows with each wave cleared, Machop when it hurts */
  private get defiPower() {
    if (!this.setup.defi) return 1;
    const sig = this.starter.sig;
    return 1.5 * (sig === "adapt" ? 1 + 0.1 * (this.wave - 1) : 1) * (sig === "counter" && this.hp < this.maxHp * 0.5 ? 1.3 : 1);
  }
  get speed() {
    return this.starter.speed * (1 + 0.08 * this.itemLevel("scarf")) * (1 + this.stage * 0.04) * (1 + 0.015 * this.perm("speed"));
  }
  get haste() {
    return Math.max(HASTE_FLOOR, (1 - 0.08 * this.itemLevel("claw")) * this.bonusHaste * (1 - 0.015 * this.perm("haste")));
  }
  /** the cooldowns can't get shorter: a PP Up would do nothing */
  get hasteMaxed() {
    return (1 - 0.08 * this.itemLevel("claw")) * this.bonusHaste * (1 - 0.015 * this.perm("haste")) <= HASTE_FLOOR;
  }
  get area() {
    return (1 + 0.1 * this.itemLevel("root")) * (1 + this.stage * 0.08);
  }
  /** moves and items held at most: a 5th of each past the 50th wave (classic and coop) */
  get moveSlots() {
    return MAX_MOVES + (!this.setup.defi && !this.setup.daily && this.wave > SLOT5_WAVE ? 1 : 0);
  }
  get itemSlots() {
    return MAX_ITEMS + (!this.setup.defi && !this.setup.daily && this.wave > SLOT5_WAVE ? 1 : 0);
  }
  /** the share of a blow that lands (Eviolite, the Pension's shell), before the HIT_CAP */
  get guard() {
    return (1 - 0.07 * this.itemLevel("eviolite")) * (1 - 0.025 * this.perm("armor"));
  }
  get crit() {
    return 0.05 + 0.07 * this.itemLevel("lens") + 0.015 * this.perm("crit");
  }
  get critMul() {
    return 1.8 + 0.25 * this.itemLevel("belt");
  }
  get magnet() {
    return 56 * (1 + 0.4 * this.itemLevel("magnet")) * (1 + 0.08 * this.perm("magnet"));
  }
  /** a short wave gives as much as a 30 s one (XP, gold): the levels a run has at a wave stay what they were */
  private get pace() {
    return this.setup.defi ? 1 : 30 / waveLength(this.wave);
  }
  get xpMul() {
    return this.pace * (1 + 0.12 * this.itemLevel("share")) * (1 + 0.03 * this.perm("xp")) * (this.setup.daily?.mod.xp ?? 1) * (this.setup.defi ? 1.8 : 1) * (this.dex === 129 ? 1.5 : 1);
  }
  get goldMul() {
    return this.pace * (1 + 0.06 * this.perm("gold")) * (this.setup.daily?.mod.gold ?? 1);
  }
  private computeMaxHp() {
    return Math.round(
      (this.starter.hp + this.stage * 30 + 20 * this.itemLevel("hpup") + (this.level - 1) * (this.starter.hpPerLevel ?? 2)) * (1 - 0.03 * this.itemLevel("lifeorb")) * (1 + 0.04 * this.perm("hp")),
    );
  }

  /* ---------------- phases ---------------- */

  set(phase: Phase) {
    this.phase = phase;
    this.onChange();
  }

  toSelect() {
    this.menuT = 0;
    this.set("select");
  }

  /** a run: i is the starter (and i2 the second player's, in coop) */
  start(i: number, setup: RunSetup = { mode: "classic", perm: {} }, i2?: number) {
    if (!setup.daily && !setup.defi && (this.locked(i) || (i2 != null && this.locked(i2)))) return;
    this.setup = setup;
    this.cardRng = setup.daily ? seeded(dailyOf(setup.daily.day).seed) : setup.defi ? seeded(setup.defi.seed) : Math.random;
    // a run's gold starts at 0 (Johan, 2026-10-17: a full purse bought Kecleon's whole stall early on), all of it goes to the purse
    this.gold = 0;
    this.offers = [];
    this.shopRerolls = 0;
    this.inBreak = false;
    Object.assign(this, {
      time: 0, kills: 0, wave: 1, enemies: [], shots: [], foes: [], pickups: [], fx: [], parts: [], nums: [], spawnAcc: 0, treasureAt: -1, titanT: 4, titanWave: 0,
      bossAlive: null, bossDue: 0, weather: null, breakAt: 0, shake: 0, flash: 0, dyingT: 0, defiLeft: setup.defi ? DEFI_QUOTA[0] : 0, defiGroupT: 1, defiGap: 0, defiTitans: 0, endAt: 0,
    });
    // a start tier: the run's clock starts at its wave (whose boss waits, frozen, while the draft is picked)
    const from = setup.daily || setup.defi ? 1 : (setup.start ?? 1);
    this.startAt = waveStart(from);
    if (from > 1) this.time = this.startAt;
    if (from > 1) unlock("game-tier");
    if (from >= 175) unlock("game-tier175");
    this.charmed = 0;
    // the daily is the same for all: its own starter, never a reward one
    const picks = setup.daily
      ? [STARTERS[setup.daily.starter]]
      : setup.defi
        ? [setup.defi.d.mon]
        : setup.mode === "coop" && i2 != null
          ? [this.roster[i], this.roster[i2]]
          : [this.roster[i]];
    this.players = picks.map((s, id) => {
      const p = new Player(id);
      Object.assign(p, { starter: s, dex: s.dex, x: id * 24, y: 0, cam: { x: id * 24, y: 0 }, invuln: 1 });
      this.cur = p;
      p.rerolls = this.perm("reroll");
      p.revives = this.perm("revive");
      // the Pension's backpack: cards to pick before the first foe
      p.pendingLevels = this.perm("pack");
      if (from > 1) {
        // a start tier: its level, evolved as far as that level goes, and its draft
        p.level = tierLevel(from);
        while (s.evolves[p.stage] && p.level >= s.evolves[p.stage][1]) p.dex = s.evolves[p.stage++][0];
        p.pendingLevels += tierPicks(from);
        p.pack = tierPicks(from);
        // a moment to get going before the first foes reach you
        p.invuln = 3;
      }
      p.maxHp = this.computeMaxHp();
      p.hp = p.maxHp;
      return p;
    });
    this.cur = this.players[0];
    music.boss(false);
    if (setup.defi) this.showBanner(this.tr(`VAGUE 1/${DEFI_WAVES}`, `WAVE 1/${DEFI_WAVES}`), this.tr(setup.defi.d.theme[0], setup.defi.d.theme[1]));
    // its boss and its music come with it
    else if (from > 1) this.newWave(from);
    else this.showBanner(this.tr("VAGUE 1", "WAVE 1"), this.tr("des Pokémon sauvages approchent", "wild Pokémon are coming"));
    gsfx.waveStart();
    this.set("play");
    if (this.cur.pendingLevels > 0) this.offerChoices();
  }

  pause(on: boolean) {
    if (on && this.phase === "play") {
      this.release();
      this.set("paused");
    }
    else if (!on && this.phase === "paused") this.set("play");
  }

  /** the player picked a level-up reward */
  choose(c: Choice | undefined) {
    if (this.phase !== "levelup" || !c || !this.canChoose) return;
    if (c.kind === "pack") {
      const def = PACKS.find((x) => x.id === c.id)!;
      this.applyPack(def, this.cur.pack);
      this.pendingLevels -= this.cur.pack;
      this.cur.pack = 0;
      if (def.rarity === "legendary") this.flash = 0.8;
      gsfx.evolveDone();
      return this.afterLevel();
    }
    this.apply(c);
    this.pendingLevels--;
    this.afterLevel();
  }

  /** "Pass" (Johan, 2026-10-20): no card for this level rather than a move or an item the build doesn't want. Not for a build pack. */
  skip() {
    if (this.phase !== "levelup" || !this.canChoose || this.choices[0]?.kind === "pack") return;
    this.pendingLevels--;
    gsfx.back();
    this.afterLevel();
  }

  /** a build pack: its moves and items learnt, the moves raised to the top and evolved, then the items, then boosts: n cards */
  private applyPack(def: PackDef, n: number) {
    const steps: Choice[] = [...def.moves.map((id) => ({ kind: "move" as const, id, level: 1 })), ...def.items.map((id) => ({ kind: "item" as const, id, level: 1 }))];
    for (let l = 2; l <= MAX_LEVEL; l++) for (const id of def.moves) steps.push({ kind: "move", id, level: l });
    for (const d of MOVES) if (d.evo && def.moves.includes(d.evo.from) && def.items.includes(d.evo.item)) steps.push({ kind: "evolve", id: d.id, level: MAX_LEVEL });
    for (let l = 2; l <= MAX_LEVEL; l++) for (const id of def.items) steps.push({ kind: "item", id, level: l });
    for (const c of steps) {
      if (n <= 0) break;
      // a card the Pension's backpack already gave: only what still fits
      if (c.kind === "move" && !this.moves.some((m) => m.id === c.id) && (c.level > 1 || this.moves.length >= this.moveSlots)) continue;
      if (c.kind === "move" && (this.moves.find((m) => m.id === c.id)?.level ?? 0) >= c.level) continue;
      if (c.kind === "item" && !this.items.some((x) => x.id === c.id) && (c.level > 1 || this.items.length >= this.itemSlots)) continue;
      if (c.kind === "item" && (this.items.find((x) => x.id === c.id)?.level ?? 0) >= c.level) continue;
      if (c.kind === "evolve" && !this.moves.some((m) => m.id === MOVES.find((d) => d.id === c.id)!.evo!.from && m.level >= MAX_LEVEL)) continue;
      this.apply(c);
      n--;
    }
    // the build full: what a run picks from then on
    for (let k = 0; n > 0; k++, n--) this.apply({ kind: "bonus", id: k % 3 === 2 && !this.hasteMaxed ? "ppup" : "protein", level: 0 });
  }

  /** 3 build packs, each rarity as likely as `PACK_ODDS` (the Pension's clover helps the rare ones) */
  private drawPacks(n: number): Choice[] {
    const pool = [...PACKS];
    const luck = (r: Rarity) => (r === "common" ? 1 : 1 + 0.1 * this.perm("luck"));
    const weight = (d: PackDef) => (PACK_ODDS[d.rarity] * luck(d.rarity)) / PACKS.filter((x) => x.rarity === d.rarity).length;
    const out: Choice[] = [];
    while (out.length < n && pool.length) {
      let r = this.cardRng() * pool.reduce((a, d) => a + weight(d), 0);
      let i = 0;
      while (i < pool.length - 1 && (r -= weight(pool[i])) > 0) i++;
      const d = pool.splice(i, 1)[0];
      out.push({ kind: "pack", id: d.id, rarity: d.rarity, level: 0 });
    }
    return out;
  }

  /** a card's effect, from a level-up or from the shop */
  private apply(c: Choice) {
    if (c.kind === "move") {
      const m = this.moves.find((x) => x.id === c.id);
      if (m) m.level++;
      else this.moves.push({ id: c.id as MoveId, level: 1, cd: 0.5, active: 0 });
      // the four types of 2026-10-17 in one run
      const types = new Set(this.moves.map((x) => MOVES.find((d) => d.id === x.id)!.type));
      if (["fairy", "steel", "dark", "bug"].every((t) => types.has(t as Elem))) unlock("game-types");
      gsfx.learn();
    } else if (c.kind === "item") {
      const it = this.items.find((x) => x.id === c.id);
      if (it) it.level++;
      else this.items.push({ id: c.id as ItemId, level: 1 });
      if (c.id === "hpup") this.hp += 20;
      gsfx.learn();
    } else if (c.kind === "evolve") {
      // the move turns into its evolution, ready at once
      const def = MOVES.find((d) => d.id === c.id)!;
      const m = this.moves.find((x) => x.id === def.evo!.from);
      if (m) Object.assign(m, { id: def.id, level: MAX_LEVEL, cd: 0.3, active: 0 });
      unlock("game-evomove");
      this.flash = 0.8;
      for (let i = 0; i < 30; i++) this.part(this.x, this.y - 10, rand(-1, 1) * 80, rand(-1, 1) * 80, "gold", 1, 2, 0, "spark");
      gsfx.evolveDone();
    } else if (c.kind === "bonus" && c.id === "protein") {
      this.bonusPower += 0.06;
      gsfx.learn();
    } else if (c.kind === "bonus" && c.id === "ppup") {
      this.bonusHaste *= 0.96;
      gsfx.learn();
    } else {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.4);
      gsfx.heal();
    }
    this.maxHp = this.computeMaxHp();
    this.hp = Math.min(this.hp, this.maxHp);
  }

  /** the Lucky die (the Pension): three new cards */
  reroll() {
    if (this.phase !== "levelup" || this.rerolls <= 0) return;
    this.rerolls--;
    gsfx.move();
    this.offerChoices();
  }

  /* ---------------- Kecleon's shop ---------------- */

  private openShop() {
    this.shopRerolls = 0;
    this.shopSwaps = 0;
    this.swapMode = null;
    this.offers = this.makeOffers();
    this.release();
    gsfx.coin();
    this.set("shop");
  }
  private makeOffers(): ShopOffer[] {
    const w = this.priceUp;
    const base: Record<Rarity, number> = { common: 30, rare: 55, epic: 90, legendary: 150 };
    return this.drawChoices(3).map((c) => ({ choice: c, price: Math.round(base[c.rarity ?? "common"] * w), sold: false }));
  }
  /** prices climb 12 % a wave after the first shop (wave 6); the Pension's loyalty card takes some off */
  private get priceUp() {
    return Math.pow(1.12, Math.max(0, this.wave - 6)) * (1 - 0.04 * this.perm("discount"));
  }
  get rerollPrice() {
    return Math.round((15 + 15 * this.shopRerolls) * this.priceUp);
  }
  get healPrice() {
    return Math.round(25 * this.priceUp);
  }
  /**
   * a card still takes: the stall's were drawn when it opened, and two new moves bought with one slot free made a fifth
   * (found by a check of 2026-10-18), a swap may take away the move an offer raises
   */
  canTake(c: Choice) {
    if (c.kind === "move") {
      const m = this.moves.find((x) => x.id === c.id);
      return m ? m.level < MAX_LEVEL : this.moves.length < this.moveSlots;
    }
    if (c.kind === "item") {
      const it = this.items.find((x) => x.id === c.id);
      return it ? it.level < MAX_LEVEL : this.items.length < this.itemSlots;
    }
    if (c.kind === "evolve") {
      const d = MOVES.find((x) => x.id === c.id)!;
      return this.moves.some((m) => m.id === d.evo!.from && m.level >= MAX_LEVEL) && this.itemLevel(d.evo!.item) > 0;
    }
    return true;
  }
  buy(i: number) {
    const o = this.offers[i];
    if (this.phase !== "shop" || !o || o.sold || this.gold < o.price || !this.canTake(o.choice)) return gsfx.back();
    this.gold -= o.price;
    o.sold = true;
    unlock("game-shop");
    this.apply(o.choice);
    this.onChange();
  }
  buyHeal() {
    if (this.phase !== "shop" || this.gold < this.healPrice || this.hp >= this.maxHp) return gsfx.back();
    this.gold -= this.healPrice;
    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.5);
    gsfx.heal();
    this.onChange();
  }
  shopReroll() {
    if (this.phase !== "shop" || this.gold < this.rerollPrice) return gsfx.back();
    this.gold -= this.rerollPrice;
    this.shopRerolls++;
    this.offers = this.makeOffers();
    gsfx.coin();
    this.onChange();
  }
  get swapPrice() {
    return Math.round(60 * (1 + this.shopSwaps) * this.priceUp);
  }
  /** the stall's swap: first what you'd give */
  swapOpen() {
    if (this.phase !== "shop" || this.swapMode || this.gold < this.swapPrice || !this.moves.length) return gsfx.back();
    const rarity = (id: string) => (MOVES.find((d) => d.id === id) ?? ITEMS.find((d) => d.id === id))!.rarity;
    this.swapList = [
      ...this.moves.map((m) => ({ kind: "move" as const, id: m.id, level: m.level, rarity: rarity(m.id) })),
      ...this.items.map((x) => ({ kind: "item" as const, id: x.id, level: x.level, rarity: rarity(x.id) })),
    ];
    this.swapMode = "give";
    gsfx.move();
    this.onChange();
  }
  /** back out before paying (once paid, one of the three must be taken) */
  swapCancel() {
    if (this.swapMode !== "give") return;
    this.swapMode = null;
    gsfx.back();
    this.onChange();
  }
  swapPick(i: number) {
    const c = this.swapList[i];
    if (this.phase !== "shop" || !c) return;
    if (this.swapMode === "give") {
      const list = this.drawSwap(c);
      if (!list.length || this.gold < this.swapPrice) return gsfx.back();
      this.gold -= this.swapPrice;
      this.shopSwaps++;
      this.swapFrom = c;
      this.swapList = list;
      this.swapMode = "take";
      gsfx.coin();
      return this.onChange();
    }
    if (this.swapMode !== "take" || !this.swapFrom) return;
    const from = this.swapFrom;
    if (from.kind === "move") {
      const k = this.moves.findIndex((m) => m.id === from.id);
      if (k >= 0) this.moves[k] = { id: c.id as MoveId, level: from.level, cd: 0.5, active: 0 };
    } else {
      const k = this.items.findIndex((x) => x.id === from.id);
      if (k >= 0) this.items[k] = { id: c.id as ItemId, level: from.level };
    }
    this.maxHp = this.computeMaxHp();
    this.hp = Math.min(this.hp, this.maxHp);
    this.swapMode = null;
    this.swapFrom = null;
    unlock("game-shop");
    gsfx.learn();
    this.onChange();
  }
  /** 3 moves (or items) not had, by rarity like the level-up cards; an evolved move is given for a plain one */
  private drawSwap(from: Choice): Choice[] {
    const luck = (r: Rarity) => (r === "common" ? 1 : 1 + 0.1 * this.perm("luck"));
    const pool: Choice[] =
      from.kind === "move"
        ? MOVES.filter((d) => !d.evo && !this.moves.some((m) => m.id === d.id)).map((d) => ({ kind: "move", id: d.id, level: from.level, rarity: d.rarity }))
        : ITEMS.filter((d) => !this.items.some((x) => x.id === d.id)).map((d) => ({ kind: "item", id: d.id, level: from.level, rarity: d.rarity }));
    const out: Choice[] = [];
    while (out.length < 3 && pool.length) {
      const w = pool.map((c) => RARITY[c.rarity!].weight * luck(c.rarity!));
      let r = this.cardRng() * w.reduce((a, b) => a + b, 0);
      let i = 0;
      while (i < pool.length - 1 && (r -= w[i]) > 0) i++;
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }
  leaveShop() {
    if (this.phase !== "shop" || this.swapMode === "take") return;
    this.swapMode = null;
    gsfx.ok();
    // in coop, the second player's turn at the stall (the gold is shared)
    const next = this.players[this.cur.id + 1];
    if (next) {
      this.cur = next;
      this.shopRerolls = 0;
      this.shopSwaps = 0;
      this.swapMode = null;
      this.offers = this.makeOffers();
      return this.onChange();
    }
    this.shopDone = true;
    this.resume();
  }

  /** giving up ends the run like a K.O.: the score and the Pension still count */
  giveUp() {
    if (this.phase !== "paused") return;
    for (const p of this.players) {
      p.revives = 0;
      p.hp = 0;
      p.down = true;
    }
    this.dyingT = 0;
    gsfx.gameOver();
    music.stop();
    this.set("dying");
  }

  private afterLevel() {
    const evo = this.starter.evolves[this.stage];
    if (evo && this.level >= evo[1] && this.level > this.evoBlocked) {
      this.evo = { from: this.dex, to: evo[0], t: 0, cancelled: false };
      gsfx.evolveStart();
      this.set("evolve");
      return;
    }
    this.resume();
  }

  /** what comes next: a player's levels (the current one first), the break's shop and 3-2-1, else the game */
  private resume() {
    const next = this.cur.pendingLevels > 0 && !this.cur.down ? this.cur : this.players.find((p) => p.pendingLevels > 0 && !p.down);
    if (next) {
      this.cur = next;
      return this.offerChoices();
    }
    if (this.inBreak && !this.shopDone) {
      this.cur = this.players[0];
      return this.openShop();
    }
    if (this.inBreak) {
      this.inBreak = false;
      this.countT = 3;
      this.bannerT = 0;
      this.cur = this.players[0];
      return this.set("countdown");
    }
    this.set("play");
  }

  /** B during the evolution: it stops, like in the games */
  cancelEvolution() {
    if (this.phase !== "evolve" || !this.evo || this.evo.t > 3.2 || this.evo.cancelled) return;
    this.evo.cancelled = true;
    this.evo.t = 3.2;
    this.evoBlocked = this.level;
    gsfx.back();
    this.onChange();
  }

  private offerChoices() {
    this.choices = this.cur.pack ? this.drawPacks(3) : this.drawChoices(3);
    this.choiceAt = performance.now();
    this.release();
    this.set("levelup");
  }

  /** how much more often a move of this type comes up for this starter: its own type, then the types it combos with */
  private affinity(type: Elem, rarity: Rarity) {
    const own = this.starter.type;
    // its own type twice as likely, a rare or epic one as likely as a rare (fire and electric moves are rare or epic)
    if (type === own) return 2 * Math.max(1, 0.6 / RARITY[rarity].weight);
    // a combo of the two: one puts the state, the other hits it
    const sets = (e: Elem) => (Object.keys(STATE_BY) as (keyof typeof STATE_BY)[]).filter((s) => STATE_BY[s].includes(e));
    const pairs = COMBOS.some((c) => (c.by === type && sets(own).includes(c.on)) || (c.by === own && sets(type).includes(c.on)));
    return pairs ? 1.35 : 1;
  }

  /** n cards: the evolutions ready first, then by rarity; boosts once everything is learnt */
  private drawChoices(n: number): Choice[] {
    const pool: Choice[] = [];
    // an evolution ready: it always comes first
    const evolutions: Choice[] = MOVES.filter(
      (d) => d.evo && this.moves.some((m) => m.id === d.evo!.from && m.level >= MAX_LEVEL) && this.itemLevel(d.evo.item) > 0,
    ).map((d) => ({ kind: "evolve", id: d.id, level: MAX_LEVEL }));
    const weights: number[] = [];
    // the Pension's clover: whatever isn't common comes up more often
    const luck = (r: Rarity) => (r === "common" ? 1 : 1 + 0.1 * this.perm("luck"));
    for (const m of MOVES) {
      if (m.evo) continue;
      const has = this.moves.find((x) => x.id === m.id);
      if (!(has ? has.level < MAX_LEVEL : this.moves.length < this.moveSlots)) continue;
      pool.push({ kind: "move", id: m.id, level: (has?.level ?? 0) + 1, rarity: m.rarity });
      // what you have comes back more; new moves too while the four slots aren't full; the starter's own type and the
      // types that combo with it come up more (Clément, 2026-10-18: a Charmander run should lean on fire)
      weights.push(RARITY[m.rarity].weight * luck(m.rarity) * (has ? 1.6 : this.moves.length < 2 ? 2.5 : 1) * this.affinity(m.type, m.rarity));
    }
    for (const it of ITEMS) {
      const has = this.items.find((x) => x.id === it.id);
      if (!(has ? has.level < MAX_LEVEL : this.items.length < this.itemSlots)) continue;
      pool.push({ kind: "item", id: it.id, level: (has?.level ?? 0) + 1, rarity: it.rarity });
      weights.push(RARITY[it.rarity].weight * luck(it.rarity) * (has ? 1.6 : 1));
    }
    const out: Choice[] = evolutions.slice(0, Math.min(2, n)).map((c) => ({ ...c, rarity: "legendary" as const }));
    while (out.length < n && pool.length) {
      let r = this.cardRng() * weights.reduce((a, b) => a + b, 0);
      let i = 0;
      while (i < pool.length - 1 && (r -= weights[i]) > 0) i++;
      out.push(pool.splice(i, 1)[0]);
      weights.splice(i, 1);
    }
    // everything learnt and raised: boosts that stack, and a berry
    for (const b of BONUSES) if (out.length < n && !(b.id === "ppup" && this.hasteMaxed)) out.push({ kind: "bonus", id: b.id, level: 0, rarity: "common" });
    return out;
  }

  /* ---------------- the loop ---------------- */

  /** advances the game by dt seconds (fixed steps) */
  tick(dt: number) {
    this.stepT += Math.min(dt, 0.1);
    while (this.stepT >= STEP) {
      this.stepT -= STEP;
      this.step();
    }
  }

  private step() {
    this.menuT += STEP;
    this.animT += STEP;
    if (this.phase === "title" || this.phase === "select") return this.stepMenu();
    if (this.phase === "evolve") return this.stepEvolve();
    if (this.phase === "dying") {
      this.dyingT += STEP;
      this.stepParts(STEP * 0.4);
      if (this.dyingT > 2.2) this.finish(false);
      return;
    }
    if (this.phase === "countdown") {
      const before = Math.ceil(this.countT);
      this.countT -= STEP;
      this.stepParts(STEP);
      if (Math.ceil(this.countT) !== before && this.countT > 0) gsfx.move();
      if (this.countT <= 0) {
        gsfx.waveStart();
        this.set("play");
      }
      return;
    }
    if (this.phase !== "play") return;
    const dt = STEP;
    this.time += dt;

    if (this.endAt && this.time >= this.endAt) return this.finish(true);
    // a new wave every 30 s, every fifth one brings a boss (up to the 100th); the daily challenge's when the last foe falls
    if (this.setup.defi) this.stepDefi(dt);
    else {
      const wave = Math.min(MAX_WAVE, waveAt(this.time));
      if (wave !== this.wave) this.newWave(wave);
      if (this.bossDue && this.time >= this.bossDue) {
        this.bossDue = 0;
        this.spawnBoss(this.wave - (this.wave % 5));
      }
    }
    if (this.breakAt && this.time >= this.breakAt) {
      this.breakAt = 0;
      return this.startBreak();
    }

    this.eachAlive((p) => {
      p.sigCd = Math.max(0, p.sigCd - dt);
      // Rest: asleep where it lies, healing
      if (p.restT > 0) {
        p.restT -= dt;
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * dt / 2);
        p.invuln = Math.max(p.invuln, 0.2);
        return;
      }
      this.movePlayer(p.input, dt);
    });
    this.buildGrid();
    this.eachAlive((p) => {
      p.sashCd = Math.max(0, p.sashCd - dt);
      this.stepDash(dt);
      this.stepRocks(dt);
      this.attack(p.input, dt);
      this.castMoves(dt);
      this.stepSig(dt);
    });
    // a downed partner: the other stands by them to get them up
    for (const p of this.players) {
      if (!p.down) continue;
      const helper = this.alive().find((q) => dist2(q.x, q.y, p.x, p.y) < 22 * 22);
      p.reviveT = helper ? p.reviveT + dt : Math.max(0, p.reviveT - dt);
      if (p.reviveT >= 3) {
        p.down = false;
        p.reviveT = 0;
        unlock("game-revive");
        p.hp = p.maxHp * 0.4;
        p.invuln = 2;
        this.flash = 0.6;
        gsfx.heal();
        this.showBanner(this.tr("RELEVÉ !", "BACK UP!"), "");
      }
    }
    this.cur = this.alive()[0] ?? this.players[0];
    this.spawn(dt);
    this.stepEnemies(dt);
    this.stepShots(dt);
    this.stepFoes(dt);
    this.stepFx(dt);
    this.stepPickups(dt);
    this.stepParts(dt);

    this.shake = Math.max(0, this.shake - dt * 18);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.bannerT = Math.max(0, this.bannerT - dt);
    const keep = this.cur;
    for (const p of this.players) {
      this.cur = p;
      const regen = 0.3 * this.itemLevel("leftovers") + 0.25 * this.perm("regen");
      if (regen && !p.down) p.hp = Math.min(p.maxHp, p.hp + regen * dt);
      p.hurtFlash = Math.max(0, p.hurtFlash - dt * 4);
      // the camera trails the player a little
      p.cam.x += (p.x - p.cam.x) * 0.15;
      p.cam.y += (p.y - p.cam.y) * 0.15;
      if (p.down || p.hp > 0) continue;
      if (p.revives > 0) {
        // the Pension's Revive: up again, once
        p.revives--;
        unlock("game-revive");
        p.hp = p.maxHp * 0.5;
        p.invuln = 2.5;
        this.flash = 1;
        this.showBanner(this.tr("RAPPEL !", "REVIVE!"), this.tr("ton Pokémon se relève", "your Pokémon gets back up"));
        for (const e of this.around(p.x, p.y, 70)) this.damage(e, 9999, (e.x - p.x) * 3, (e.y - p.y) * 3, "normal", true);
        gsfx.evolveDone();
      } else {
        p.hp = 0;
        p.down = true;
        p.reviveT = 0;
        if (this.players.length > 1 && this.alive().length) {
          gsfx.hurt();
          this.showBanner(this.tr(`J${p.id + 1} EST K.O.`, `P${p.id + 1} IS DOWN`), this.tr("reste à côté pour le relever", "stand by them to get them up"));
        }
      }
    }
    this.cur = keep;
    if (!this.alive().length) {
      this.dyingT = 0;
      gsfx.gameOver();
      music.stop();
      this.set("dying");
    }
  }

  /** the run's end: its numbers for the game over (a won daily challenge counts as wave 11, the ladder's "done") */
  private finish(won: boolean) {
    const daily = this.setup.daily;
    if (this.setup.mode === "coop") unlock("game-coop");
    if (won && !this.setup.defi) {
      unlock("game-wave100");
      unlock("game-wave200");
    }
    if (won && this.setup.defi) this.defiWon(this.players[0].starter.dex, Math.floor(this.time));
    const met = !!daily && this.wave >= daily.target;
    this.lastStats = {
      mode: this.setup.mode, day: daily?.day ?? this.setup.defi?.day, gold: this.gold, dailyBonus: daily ? dailyReward(this.wave, met) : 0, dailyWon: met, won,
      wave: this.setup.defi && won ? DEFI_WAVES + 1 : this.wave, kills: this.kills, level: Math.max(...this.players.map((p) => p.level)), seconds: Math.floor(this.time), start: (this.setup.start ?? 1) > 1 && !this.setup.daily && !this.setup.defi ? this.setup.start! : 1,
      starter: this.players[0].starter.dex, dex: this.players[0].dex, dex2: this.players[1]?.dex, starter2: this.players[1]?.starter.dex,
    };
    music.stop();
    this.set("over");
  }

  /** a daily challenge won: its trophies (the week's Pokémon won with are kept on this device) */
  private defiWon(dex: number, seconds: number) {
    unlock("defi-first");
    if (seconds < 300) unlock("defi-fast");
    if (seconds < 210) unlock("defi-blitz");
    if (dex === 129) unlock("defi-karp");
    try {
      const wins: number[] = JSON.parse(localStorage.getItem(DEFI_WINS_KEY) ?? "[]");
      if (!wins.includes(dex)) wins.push(dex);
      localStorage.setItem(DEFI_WINS_KEY, JSON.stringify(wins));
      if (DEFI_MONS.every((m) => wins.includes(m.dex))) unlock("defi-week");
    } catch {}
  }

  private stepMenu() {
    // wild Pokémon wandering across the title screen
    if (this.wanderers.length < 5 && Math.random() < 0.01) {
      const left = Math.random() < 0.5;
      this.wanderers.push({ dex: pick([10, 13, 16, 19, 25, 29, 41, 43, 52, 54, 129, 133].filter((d) => mon(d))), x: left ? -20 : SW + 20, y: rand(150, 270), vx: (left ? 1 : -1) * rand(14, 26), t: 0 });
    }
    for (const w of this.wanderers) {
      w.x += w.vx * STEP;
      w.t += STEP;
    }
    this.wanderers = this.wanderers.filter((w) => w.x > -40 && w.x < SW + 40);
    this.stepParts(STEP);
    if (Math.random() < 0.08) this.ambient(true);
  }

  private stepEvolve() {
    const e = this.evo!;
    e.t += STEP;
    this.stepParts(STEP);
    if (e.t > 3.2 && e.t - STEP <= 3.2 && !e.cancelled) {
      this.dex = e.to;
      this.stage++;
      unlock("game-evolve");
      this.maxHp = this.computeMaxHp();
      this.hp = this.maxHp;
      this.flash = 1;
      gsfx.evolveDone();
      for (let i = 0; i < 40; i++) this.part(this.x, this.y - 10, rand(-1, 1) * 90, rand(-1, 1) * 90, "gold", 1.2, 2, 0, "spark");
      this.onChange();
    }
    if (e.t > 5) {
      this.evo = null;
      // what comes next as after any card: the levels left, else the break's shop and 3-2-1, else the game (an evolution
      // in a break used to drop straight into play with the break still on: no card was offered until the next boss,
      // then all of them at once)
      this.resume();
    }
  }

  private newWave(wave: number) {
    this.wave = wave;
    if (this.setup.defi) return this.defiWave(wave);
    const daily = this.setup.daily;
    if (daily && wave === daily.target) {
      // the daily's goal reached: the rest is for the ladder
      unlock("game-daily");
      gsfx.evolveDone();
      this.flash = 0.6;
    }
    if (wave >= 10) unlock("game-wave10");
    if (wave >= 20) unlock("game-wave20");
    if (wave >= 30) unlock("game-wave30");
    if (wave >= 150) unlock("game-wave150");
    gsfx.waveStart();
    if (wave % 5 === 0 && this.startAt > 0 && this.time === this.startAt) {
      // a start tier: its boss comes once the ramp is under way
      this.bossDue = this.time + BOSS_LATE;
      this.showBanner(this.tr(`VAGUE ${wave}`, `WAVE ${wave}`), this.tr(`le boss arrive dans ${BOSS_LATE} s`, `the boss comes in ${BOSS_LATE} s`));
    } else if (wave % 5 === 0) this.spawnBoss(wave);
    else if (wave === 11) {
      // a joke wave: a shoal of Magikarp splashing about
      for (let i = 0; i < 40; i++) this.spawnOne(129, i / 40);
      this.showBanner(this.tr("VAGUE 11", "WAVE 11"), this.tr("une horde de Magicarpe ?!", "a shoal of Magikarp?!"));
    } else if (wave === SLOT5_WAVE + 1 && this.startAt < waveStart(SLOT5_WAVE + 1)) {
      this.showBanner(this.tr("5E CAPACITE !", "5TH MOVE!"), this.tr("et un 5e objet : de quoi aller plus loin", "and a 5th item: room to go further"));
      gsfx.evolveDone();
      this.flash = 0.5;
    } else if (wave === BEYOND + 1) this.showBanner(this.tr(`VAGUE ${wave}`, `WAVE ${wave}`), this.tr("au-delà : les titans arrivent", "beyond: the titans are coming"));
    else this.showBanner(this.tr(`VAGUE ${wave}`, `WAVE ${wave}`), "");
    // the daily met: its banner wins over the others
    if (daily && wave === daily.target)
      this.showBanner(this.tr("DEFI REUSSI !", "CHALLENGE MET!"), this.tr(`+${dailyReward(wave, true)} or, et plus si tu tiens`, `+${dailyReward(wave, true)} gold, more if you hold on`));
    // a Chansey runs by sometimes: catch it if you can
    this.treasureAt = wave >= 3 && Math.random() < 0.45 ? this.time + rand(5, 25) : -1;
    // the weather; a new field says its name (unless a boss or another banner has the wave)
    this.rollWeather();
    const fresh = wave > 1 && (wave - 1) % BIOME_WAVES === 0 && wave % 5 !== 0 && wave !== SLOT5_WAVE + 1 && wave !== BEYOND + 1;
    const w = this.weather ? WEATHERS[this.weather] : null;
    if (fresh) this.showBanner(this.tr(this.biome.name[0], this.biome.name[1]).toUpperCase(), w ? this.tr(`${w.name[0]} : ${w.does[0]}`, `${w.name[1]}: ${w.does[1]}`) : this.tr(`vague ${wave}`, `wave ${wave}`));
    else if (w && !this.bannerSub) this.bannerSub = this.tr(`${w.name[0]} : ${w.does[0]}`, `${w.name[1]}: ${w.does[1]}`);
  }

  /** a fifth wave's boss: past wave 100, every 10th is a giga boss of the daily challenge's (Mega Mewtwo Y for the 200th) */
  private spawnBoss(wave: number) {
    const round = Math.floor((wave / 5 - 1) / BOSSES.length);
    // past wave 100, every 10th: a giga boss of the daily challenge's (Mega Mewtwo Y for the 200th, the last)
    const giga = wave > BEYOND && wave % 10 === 0;
    const b = giga ? DEFI_DAYS[wave >= MAX_WAVE ? 0 : ((wave / 10 - 11) % (DEFI_DAYS.length - 1)) + 1].giga : BOSSES[(wave / 5 - 1) % BOSSES.length];
    // past wave 25 they grow tougher still: late in a run they fell in a few seconds
    const mult = (1 + round * 2) * (1 + wave * 0.02) * (1 + Math.min(50, Math.max(0, wave - 25)) * BOSS_LATE_HP);
    const hp = giga ? GIGA_HP * mult * (wave >= MAX_WAVE ? 1.25 : 1) : b.hp * mult;
    const a = Math.random() * Math.PI * 2;
    const e = this.makeEnemy(b.dex, this.x + Math.cos(a) * 170, this.y + Math.sin(a) * 150);
    Object.assign(e, { boss: b, hp, max: hp, speed: b.speed, dmg: b.dmg * (1 + round * 0.5) * (1 + wave * 0.04), r: b.r, actT: 3, n: 0, final: wave >= MAX_WAVE });
    this.enemies.push(e);
    this.bossAlive = e;
    this.showBanner(`${this.name(b.dex)}`, giga ? this.tr(`GIGA BOSS · ${b.title[0]}`, `GIGA BOSS · ${b.title[1]}`) : this.tr(b.title[0], b.title[1]));
    if (giga) this.shake = 12;
    gsfx.boss();
    music.boss(true);
  }

  /* ---------------- the daily challenge's waves (lib/game/defi) ---------------- */

  /** the wave is over when its last foe falls (and its boss): a breath, then the next one */
  private stepDefi(dt: number) {
    if (this.endAt) return;
    if (this.defiGap > 0) {
      this.defiGap -= dt;
      if (this.defiGap <= 0) this.newWave(this.wave + 1);
      return;
    }
    if (this.defiLeft > 0 || this.bossAlive) return;
    if (this.enemies.some((e) => !e.dead && e.w?.act !== "treasure")) return;
    if (this.wave >= DEFI_WAVES) return;
    this.defiGap = 1.6;
    gsfx.rare();
    this.showBanner(this.tr(`VAGUE ${this.wave} NETTOYÉE`, `WAVE ${this.wave} CLEARED`), this.tr("la suivante arrive…", "the next one is coming…"));
  }

  private defiWave(wave: number) {
    const d = this.setup.defi!.d;
    this.defiLeft = DEFI_QUOTA[wave - 1] ?? 40;
    this.defiGroupT = 0.6;
    // a titan or two among the foes, from wave 3 (none with the bosses)
    this.defiTitans = wave < 3 || wave === 5 || wave === 10 ? 0 : wave >= 7 ? 2 : 1;
    gsfx.waveStart();
    if (wave === 5 || wave === 10) {
      const b = wave === 5 ? d.boss : d.giga;
      const a = Math.random() * Math.PI * 2;
      const e = this.makeEnemy(b.dex, this.x + Math.cos(a) * 140, this.y + Math.sin(a) * 110);
      Object.assign(e, { boss: b, hp: b.hp, max: b.hp, speed: b.speed, dmg: b.dmg, r: b.r, actT: 2.5, n: 0 });
      this.enemies.push(e);
      this.bossAlive = e;
      this.showBanner(this.name(b.dex), b.giga ? this.tr(`GIGA BOSS · ${b.title[0]}`, `GIGA BOSS · ${b.title[1]}`) : this.tr(b.title[0], b.title[1]));
      gsfx.boss();
      music.boss(true);
      if (b.giga) this.shake = 12;
    } else this.showBanner(this.tr(`VAGUE ${wave}/${DEFI_WAVES}`, `WAVE ${wave}/${DEFI_WAVES}`), wave === DEFI_WAVES - 1 ? this.tr("la dernière avant le boss", "the last one before the boss") : "");
  }

  /** the wave's foes come in groups, a crowd at a time; from wave 3 a titan or two among them */
  private spawnDefi(dt: number) {
    const d = this.setup.defi!.d;
    const w = this.wave;
    this.defiGroupT -= dt;
    if (this.defiLeft <= 0 || this.defiGroupT > 0) return;
    const alive = this.enemies.filter((e) => !e.dead).length;
    // the boss's guards come slower
    this.defiGroupT = this.bossAlive ? 2.6 : 1.1;
    if (alive > 80) return;
    const pool = [...(w < 7 ? d.early : []), ...(w >= 3 ? d.mid : []), ...(w >= 6 ? d.late : [])];
    const n = Math.min(this.defiLeft, this.bossAlive ? 3 : 4 + Math.floor(w / 2) + Math.floor(Math.random() * 3));
    const dex = pick(pool), f = Math.random();
    for (let i = 0; i < n; i++) this.spawnOne(i % 2 ? pick(pool) : dex, f + rand(-0.05, 0.05));
    this.defiLeft -= n;
    // the titans come with the next groups
    if (this.defiTitans > 0 && this.defiLeft < (DEFI_QUOTA[w - 1] ?? 0) - n) {
      this.defiTitans--;
      const a = Math.random() * Math.PI * 2, dd = VIEW_R + 20;
      const p = pick(this.alive().length ? this.alive() : this.players);
      this.enemies.push(this.makeEnemy(pick(d.late), p.x + Math.cos(a) * dd, p.y + Math.sin(a) * dd, true));
      this.showBanner(this.tr("UN TITAN !", "A TITAN!"), this.tr("un ennemi géant", "a giant foe"));
    }
  }

  /**
   * A moment after a boss falls: a break (Johan, 2026-10-13). The field is cleared (the foes vanish, what lay on the ground comes to the
   * players), then the Pokémon Center, the levels won, Kecleon's shop, and a 3-2-1 before it starts again.
   */
  private startBreak() {
    for (const e of this.enemies)
      if (!e.dead) for (let i = 0; i < 3; i++) this.part(e.x + rand(-4, 4), e.y - 6, rand(-20, 20), rand(-30, 0), "white", 0.5, 3, -10, "puff");
    this.enemies = [];
    this.foes = [];
    this.bossAlive = null;
    music.boss(false);
    this.inBreak = true;
    this.shopDone = false;
    const keep = this.cur;
    for (const p of this.pickups) {
      this.cur = this.nearestPlayer(p.x, p.y);
      this.collect(p);
    }
    this.pickups = [];
    this.cur = keep;
    const noCenter = this.setup.daily?.mod.noCenter;
    for (const p of this.players) {
      p.down = false;
      if (!noCenter) p.hp = p.maxHp;
      else p.hp = Math.max(p.hp, 1);
    }
    this.cur = this.players[0];
    this.release();
    if (!noCenter) {
      // the Pokémon Center's care, without a stop (Johan, 2026-10-13: forgetting moves had no use)
      gsfx.heal();
      for (const p of this.players) for (let i = 0; i < 10; i++) this.part(p.x + rand(-10, 10), p.y - rand(0, 20), 0, -rand(20, 40), "heal", 0.7, 2, 0, "spark");
    }
    this.resume();
  }

  private showBanner(title: string, sub: string) {
    this.banner = title;
    this.bannerSub = sub;
    this.bannerT = 2.6;
  }

  /* ---------------- the player ---------------- */

  private movePlayer(input: Input, dt: number) {
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    this.moving = len > 0;
    if (len) {
      mx /= len;
      my /= len;
      this.x += mx * this.speed * dt;
      this.y += my * this.speed * dt;
      // a puff of dust now and then
      if (Math.random() < 0.08) this.part(this.x + rand(-3, 3), this.y + 2, -mx * 10, -2, "pebble", 0.4, 1, -10, "puff");
    }
    // where the attacks go: the mouse, or the closest foe
    const target = this.fireMode === "nearest" || !input.aim ? this.nearest(this.x, this.y, 200) : null;
    if (target) {
      const d = Math.hypot(target.x - this.x, target.y - this.y) || 1;
      this.aimV = { x: (target.x - this.x) / d, y: (target.y - this.y) / d };
    } else if (input.aim && this.fireMode !== "nearest") {
      const px = this.x - this.cam.x + SW / 2;
      const py = this.y - this.cam.y + SH / 2 - 8;
      const dx = input.aim.x - px, dy = input.aim.y - py;
      const d = Math.hypot(dx, dy);
      if (d > 2) this.aimV = { x: dx / d, y: dy / d };
    } else if (len) this.aimV = { x: mx, y: my };
    // facing where it attacks; in click mode, where it walks between two shots
    this.dir = this.firingNow(input) || !len ? dirOf(this.aimV.x, this.aimV.y) : dirOf(mx, my);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.shieldT = Math.max(0, this.shieldT - dt);
  }

  private firingNow(input: Input) {
    return this.fireMode === "click" && this.cur.id === 0 ? input.firing : true;
  }

  /** the basic attack, the evolution's when it has its own (Eevee's, Gyarados's) */
  private get basic() {
    return this.starter.evoBasic?.[this.dex] ?? this.starter.basic;
  }

  private attack(input: Input, dt: number) {
    this.basicT -= dt;
    if (this.basicT > 0 || !this.firingNow(input)) return;
    const b = this.basic;
    this.basicT = b.every * (this.stage === 2 ? 0.85 : 1);
    if (this.cur.restT > 0) return;
    const dmg = b.dmg * this.power;
    const { x: ax, y: ay } = this.aimV;
    const ox = this.x + ax * 6, oy = this.y - 8 + ay * 6;
    if (b.kind === "whip") {
      // a lash in an arc: everything inside it takes the hit
      const reach = (38 + this.stage * 6) * this.area;
      const half = (0.75 + this.stage * 0.2);
      const angle = Math.atan2(ay, ax);
      this.fx.push({ kind: "whip", x: this.x, y: this.y - 8, t: 0, life: 0.22, a: angle, r: reach, elem: "grass" });
      for (const e of this.around(this.x, this.y, reach + 12)) {
        const da = Math.abs(((Math.atan2(e.y - this.y, e.x - this.x) - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (da < half && dist2(e.x, e.y, this.x, this.y) < (reach + e.r) ** 2) this.damage(e, dmg, ax * 70, ay * 70, "grass");
      }
      if (this.stage === 2) this.shoot("leaf", ox, oy, ax, ay, 150, 4, dmg * 0.7, 0, 1.2, "grass");
      gsfx.shoot("whip");
    } else if (b.kind === "ember") {
      const n = 1 + this.stage;
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(ay, ax) + (i - (n - 1) / 2) * 0.22;
        this.shoot("ember", ox, oy, Math.cos(a), Math.sin(a), 160, 3 + this.stage, dmg, 0, 1.1, "fire");
      }
      gsfx.shoot("ember");
    } else if (b.kind === "water") {
      const n = 2 + this.stage;
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(ay, ax) + (i - (n - 1) / 2) * 0.13 + rand(-0.04, 0.04);
        this.shoot("water", ox, oy, Math.cos(a), Math.sin(a), 230, 2, dmg, 1 + this.stage, 0.7, "water");
      }
      gsfx.shoot("water");
    } else if (b.kind === "psycut") {
      // Psycho Cut: psychic blades that go through several foes
      const n = 2 + this.stage;
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(ay, ax) + (i - (n - 1) / 2) * 0.2;
        this.shoot("psycut", ox, oy, Math.cos(a), Math.sin(a), 220, 4, dmg, 2 + this.stage, 0.75, "psy");
      }
      gsfx.shoot("bolt");
    } else if (b.kind === "swift") {
      // Swift: stars that pick the closest foes and follow them
      const targets = this.nearestN(this.x, this.y, 2, 190);
      for (let i = 0; i < 2; i++) {
        const a = Math.atan2(ay, ax) + (i ? 0.45 : -0.45);
        this.shoot("swift", ox, oy, Math.cos(a), Math.sin(a), 180, 3, dmg, 0, 1.6, "normal", targets[i] ?? targets[0] ?? null);
      }
      gsfx.shoot("bolt");
    } else if (b.kind === "icy") {
      // Ice Shard: a fan of shards that freeze what's wet
      for (let i = 0; i < 3; i++) {
        const a = Math.atan2(ay, ax) + (i - 1) * 0.22;
        this.shoot("ice", ox, oy, Math.cos(a), Math.sin(a), 210, 3, dmg, 1, 0.8, "ice");
      }
      gsfx.shoot("water");
    } else if (b.kind === "splash") {
      // Splash: a hop and a splash around it, hardly anything
      this.fx.push({ kind: "ring", x: this.x, y: this.y, t: 0, life: 0.3, r: 38 * this.area, elem: "water", hit: new Set(), dmg });
      gsfx.shoot("water");
    } else if (b.kind === "punch") {
      // Karate Chop: blows fanned out in front, one more with each evolution
      const reach = (32 + this.stage * 6) * this.area;
      const angle = Math.atan2(ay, ax);
      for (let k = 0; k <= this.stage; k++) {
        const a = angle + (k - this.stage / 2) * 0.5;
        this.fx.push({ kind: "punch", x: this.x, y: this.y - 8, t: -k * 0.06, life: 0.2, a, r: reach, elem: "fight" });
        for (const e of this.around(this.x, this.y, reach + 10)) {
          const da = Math.abs(((Math.atan2(e.y - this.y, e.x - this.x) - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (da < 0.6 && dist2(e.x, e.y, this.x, this.y) < (reach + e.r) ** 2) this.damage(e, dmg, Math.cos(a) * 90, Math.sin(a) * 90, "fight");
        }
      }
      gsfx.shoot("whip");
    } else if (b.kind === "slam") {
      // Body Slam: it lands on everything around it
      this.fx.push({ kind: "ring", x: this.x, y: this.y, t: 0, life: 0.35, r: 52 * this.area, elem: "normal", hit: new Set(), dmg });
      this.shake = Math.max(this.shake, 2);
      gsfx.quake();
    } else if (b.kind === "psyorb") {
      // Confusion: psychic orbs that follow the closest foes, one more with each evolution
      const n = 1 + this.stage;
      const targets = this.nearestN(this.x, this.y, n, 190);
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(ay, ax) + (i - (n - 1) / 2) * 0.4;
        this.shoot("psyorb", ox, oy, Math.cos(a), Math.sin(a), 160, 4, dmg, 1, 1.6, "psy", targets[i] ?? targets[0] ?? null);
      }
      gsfx.shoot("bolt");
    } else if (b.kind === "shadowball") {
      // Shadow Ball: ghostly orbs that home in on the closest foe and go through
      const n = 2 + this.stage;
      const target = this.nearest(this.x, this.y, 170);
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(ay, ax) + (i - (n - 1) / 2) * 0.35;
        this.shoot("gball", ox, oy, Math.cos(a), Math.sin(a), 170, 4, dmg, 1 + this.stage, 1.3, "ghost", target);
      }
      gsfx.shoot("shadow");
    } else if (b.kind === "jab") {
      // Poison Jab: a thrust in front that poisons, wider with each evolution
      const reach = (34 + this.stage * 7) * this.area;
      const angle = Math.atan2(ay, ax);
      const half = 0.5 + this.stage * 0.15;
      this.fx.push({ kind: "punch", x: this.x, y: this.y - 8, t: 0, life: 0.2, a: angle, r: reach, elem: "poison" });
      if (this.stage) this.fx.push({ kind: "punch", x: this.x, y: this.y - 8, t: -0.07, life: 0.2, a: angle, r: reach * 0.75, elem: "poison" });
      for (const e of this.around(this.x, this.y, reach + 12)) {
        const da = Math.abs(((Math.atan2(e.y - this.y, e.x - this.x) - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (da >= half || dist2(e.x, e.y, this.x, this.y) >= (reach + e.r) ** 2) continue;
        this.damage(e, dmg, ax * 80, ay * 80, "poison");
        this.poisonFoe(e, dmg * 0.3, 3);
      }
      gsfx.shoot("whip");
    } else if (b.kind === "rock") {
      // Rock Throw: heavy stones that burst where they land, one more with each evolution
      const n = 1 + this.stage;
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(ay, ax) + (i - (n - 1) / 2) * 0.3;
        this.shoot("rock", ox, oy, Math.cos(a), Math.sin(a), 140, 4 + this.stage, dmg, 0, 1, "ground");
      }
      gsfx.shoot("whip");
    } else if (b.kind === "fairy") {
      // Fairy Wind: sparkles that seek the closest foes and charm them (Fairy), one more with each evolution
      const n = 1 + this.stage;
      const targets = this.nearestN(this.x, this.y, n, 190);
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(ay, ax) + (i - (n - 1) / 2) * 0.5;
        this.shoot("fairy", ox, oy, Math.cos(a), Math.sin(a), 170, 3, dmg, 0, 1.5, "fairy", targets[i] ?? targets[0] ?? null);
      }
      gsfx.shoot("bolt");
    } else if (b.kind === "dragon") {
      // Dragon Rage: a dragon's breath that goes through the line, two of them once Dragonite
      const n = this.stage === 2 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(ay, ax) + (i - (n - 1) / 2) * 0.16;
        this.shoot("dragon", ox, oy, Math.cos(a), Math.sin(a), 200, 4 + this.stage, dmg, 1 + this.stage, 1, "dragon");
      }
      gsfx.shoot("shadow");
    } else {
      // a bolt to the foe closest to the aim, then it jumps from foe to foe
      const reach = 125 * this.area;
      let best: Enemy | null = null;
      let bestScore = Infinity;
      for (const e of this.around(this.x, this.y, reach)) {
        const dx = e.x - this.x, dy = e.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        const cos = (dx * ax + dy * ay) / d;
        if (cos < 0.55 || e.alpha < 0.5) continue;
        const score = d * (2 - cos);
        if (score < bestScore) {
          bestScore = score;
          best = e;
        }
      }
      if (!best) {
        this.basicT = 0.1;
        return;
      }
      const jumps = 2 + this.stage * 2;
      const pts: [number, number][] = [[ox, oy]];
      const hit = new Set<Enemy>();
      let cur: Enemy | null = best;
      let d0 = dmg;
      for (let i = 0; i <= jumps && cur; i++) {
        hit.add(cur);
        pts.push([cur.x, cur.y - 8]);
        this.damage(cur, d0, 0, 0, "elec");
        d0 *= 0.8;
        let next: Enemy | null = null;
        let nd = (55 * this.area) ** 2;
        for (const e of this.around(cur.x, cur.y, 55 * this.area)) {
          const dd = dist2(e.x, e.y, cur.x, cur.y);
          if (!hit.has(e) && dd < nd) {
            nd = dd;
            next = e;
          }
        }
        cur = next;
      }
      this.fx.push({ kind: "bolt", x: 0, y: 0, t: 0, life: 0.14, pts: jag(pts) });
      gsfx.shoot("bolt");
    }
  }

  private shoot(kind: Shot["kind"], x: number, y: number, dx: number, dy: number, speed: number, r: number, dmg: number, pierce: number, life: number, elem: Elem, target?: Enemy | null) {
    this.shots.push({ kind, x, y, vx: dx * speed, vy: dy * speed, r, dmg, pierce, life, elem, target, t: 0, hit: new Set() });
  }

  /* ---------------- moves ---------------- */

  /** key 1-4 in manual mode */
  castKey(i: number) {
    const m = this.moves[i];
    if (this.phase === "play" && m && m.cd <= 0 && !["psychic", "protect", "petal", "blizzard"].includes(m.id)) this.cast(m);
  }

  private castMoves(dt: number) {
    for (const m of this.moves) {
      m.cd -= dt;
      if (m.active > 0) {
        m.active -= dt;
        if (m.id === "flamethrower") this.flameTick(m.level);
      }
      // auras and orbits work on their own, even with the keys
      if ((m.id === "psychic" || m.id === "petal" || m.id === "blizzard") && m.cd <= 0) this.cast(m);
      else if ((!this.manualMoves || this.cur.id > 0) && m.cd <= 0 && m.id !== "protect") this.cast(m);
    }
  }

  private cast(m: { id: MoveId; level: number; cd: number; active: number }) {
    const def = MOVES.find((d) => d.id === m.id)!;
    const L = m.level;
    m.cd = def.cd[L - 1] * this.haste;
    const pw = this.power;
    switch (m.id) {
      case "thunder": {
        const n = [1, 2, 2, 3, 4][L - 1];
        const onScreen = this.enemies.filter((e) => !e.dead && Math.abs(e.x - this.cam.x) < SW / 2 && Math.abs(e.y - this.cam.y) < SH / 2);
        if (!onScreen.length) {
          m.cd = 0.3;
          return;
        }
        for (let i = 0; i < n && onScreen.length; i++) {
          const e = onScreen.splice(Math.floor(Math.random() * onScreen.length), 1)[0];
          this.fx.push({ kind: "strike", x: e.x, y: e.y, t: 0, life: 0.3, pts: jag([[e.x + rand(-20, 20), e.y - 200], [e.x, e.y - 4]], 10), elem: "elec" });
          for (const o of this.around(e.x, e.y, 14 * this.area)) this.damage(o, (28 + 12 * (L - 1)) * pw * (o === e ? 1 : 0.5), 0, 0, "elec");
        }
        this.flash = 0.25;
        gsfx.thunder();
        break;
      }
      case "flamethrower":
        m.active = 1.1;
        gsfx.fire();
        break;
      case "surf":
        this.fx.push({ kind: "ring", x: this.x, y: this.y, t: 0, life: 0.65, r: (70 + 12 * L) * this.area, elem: "water", hit: new Set(), dmg: (22 + 10 * L) * pw });
        gsfx.wave();
        break;
      case "leaf": {
        const n = 2 + L;
        const targets = this.nearestN(this.x, this.y, n, 220);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          this.shoot("leaf", this.x + Math.cos(a) * 8, this.y - 8 + Math.sin(a) * 8, Math.cos(a), Math.sin(a), 120, 3, (14 + 5 * L) * pw, 0, 2.2, "grass", targets[i % Math.max(1, targets.length)] ?? null);
        }
        gsfx.shoot("leaf");
        break;
      }
      case "ice":
        m.active = 3.5 + 0.3 * L;
        gsfx.shield();
        break;
      case "quake": {
        const R = (80 + 12 * L) * this.area;
        for (const e of this.around(this.x, this.y, R)) {
          const d = Math.hypot(e.x - this.x, e.y - this.y) || 1;
          this.damage(e, (35 + 16 * L) * pw, ((e.x - this.x) / d) * 90, ((e.y - this.y) / d) * 90, "ground");
        }
        this.fx.push({ kind: "quake", x: this.x, y: this.y, t: 0, life: 0.6, r: R });
        this.shake = 7;
        for (let i = 0; i < 24; i++) {
          const a = Math.random() * Math.PI * 2;
          this.part(this.x + Math.cos(a) * R * 0.6, this.y + Math.sin(a) * R * 0.5, Math.cos(a) * 30, -rand(10, 40), "ground2", 0.7, 2, 60, "puff");
        }
        gsfx.quake();
        break;
      }
      case "shadow": {
        const n = L >= 5 ? 3 : L >= 3 ? 2 : 1;
        const base = Math.atan2(this.aimV.y, this.aimV.x);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.35;
          this.shoot("shadow", this.x, this.y - 8, Math.cos(a), Math.sin(a), 70, 5 + L, (20 + 8 * L) * pw, 999, 3.2, "ghost");
        }
        gsfx.shoot("shadow");
        break;
      }
      case "swift": {
        const n = 2 + L;
        const targets = this.nearestN(this.x, this.y, n, 200);
        if (!targets.length) {
          m.cd = 0.3;
          return;
        }
        targets.forEach((t, i) => {
          const a = Math.atan2(t.y - this.y, t.x - this.x) + (i % 2 ? 0.5 : -0.5);
          this.shoot("swift", this.x, this.y - 8, Math.cos(a), Math.sin(a), 170, 3, (9 + 3 * L) * pw, 0, 2, "normal", t);
        });
        gsfx.zap();
        break;
      }
      case "psychic": {
        const R = (24 + 5 * L) * this.area;
        for (const e of this.around(this.x, this.y, R)) this.damage(e, (3 + 2 * L) * pw, 0, 0, "psy", true);
        break;
      }
      case "protect":
        break;
      case "quick": {
        // a dash where it aims, through the foes, untouchable meanwhile
        this.dashT = 0.2;
        this.dashV = { ...this.aimV };
        this.dashHit = new Set();
        this.invuln = Math.max(this.invuln, 0.3);
        gsfx.shoot("water");
        break;
      }
      case "sleep": {
        const n = 1 + Math.floor(L / 2);
        const targets = this.nearestN(this.x, this.y, 12, 140);
        for (let i = 0; i < n; i++) {
          const t = targets[Math.floor(Math.random() * Math.max(1, targets.length))];
          const x = t ? t.x : this.x + rand(-60, 60), y = t ? t.y : this.y + rand(-50, 50);
          this.fx.push({ kind: "cloud", x, y, t: 0, life: 2.6, r: (18 + 3 * L) * this.area, dmg: (3 + L) * pw, tick: 0 });
        }
        gsfx.wave();
        break;
      }
      case "hyper": {
        const len = 260;
        this.fx.push({
          kind: "hbeam", x: this.x, y: this.y - 8, x2: this.x + this.aimV.x * len, y2: this.y - 8 + this.aimV.y * len, owner: this.cur,
          t: 0, life: 0.6, r: (10 + 2 * L) * this.area, dmg: (40 + 18 * L) * pw, elem: "normal",
        });
        break;
      }
      case "rocks": {
        const n = 2 + L;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + Math.random();
          const d = rand(24, 60) * this.area;
          this.rocks.push({ x: this.x + Math.cos(a) * d, y: this.y + Math.sin(a) * d * 0.8, life: 8, hits: 3, seed: Math.random() });
        }
        if (this.rocks.length > 40) this.rocks.splice(0, this.rocks.length - 40);
        gsfx.shoot("whip");
        break;
      }
      case "toxic": {
        const n = 4 + L;
        for (const e of this.nearestN(this.x, this.y, n, 120 * this.area)) {
          this.poisonFoe(e, (4 + 2 * L) * pw, 5);
          for (let i = 0; i < 4; i++) this.part(e.x + rand(-6, 6), e.y - rand(4, 16), 0, -16, "poison", 0.6, 2, 0, "puff");
        }
        gsfx.shoot("water");
        break;
      }
      case "solar": {
        // the sun gathers, then the beam
        const len = 260;
        this.fx.push({
          kind: "hbeam", x: this.x, y: this.y - 8, x2: this.x + this.aimV.x * len, y2: this.y - 8 + this.aimV.y * len, owner: this.cur,
          t: 0, life: 1.25, charge: 0.8, r: (14 + 2 * L) * this.area, dmg: (70 + 25 * L) * pw, elem: "grass",
        });
        gsfx.levelUp();
        break;
      }
      case "twister":
        this.fx.push({
          kind: "tornado", x: this.x + this.aimV.x * 20, y: this.y + this.aimV.y * 20, vx: this.aimV.x * 40, vy: this.aimV.y * 40,
          t: 0, life: 4 + 0.3 * L, r: 34 * this.area, dmg: (6 + 3 * L) * pw, tick: 0, elem: "fly",
        });
        gsfx.wave();
        break;
      case "bubble": {
        const n = 3 + L;
        const base = Math.atan2(this.aimV.y, this.aimV.x);
        for (let i = 0; i < n; i++) {
          const a = base + rand(-0.7, 0.7);
          this.shoot("bubble", this.x, this.y - 8, Math.cos(a), Math.sin(a), rand(60, 110), 4, (10 + 4 * L) * pw, 0, 2.4, "water");
        }
        gsfx.shoot("water");
        break;
      }
      case "discharge":
        this.shockwave((60 + 8 * L) * this.area, (20 + 9 * L) * pw, 0.5 + 0.1 * L, 6);
        break;
      case "bone": {
        const n = L >= 4 ? 2 : 1;
        const base = Math.atan2(this.aimV.y, this.aimV.x);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.5;
          this.shoot("bone", this.x, this.y - 8, Math.cos(a), Math.sin(a), 180, 5, (16 + 6 * L) * pw, 999, 2, "ground");
        }
        gsfx.shoot("whip");
        break;
      }
      case "firespin":
        this.fx.push({ kind: "zone", x: this.x, y: this.y, t: 0, life: 2.5 + 0.3 * L, r: (40 + 5 * L) * this.area, dmg: (6 + 3 * L) * pw, tick: 0, elem: "fire", owner: this.cur });
        gsfx.fire();
        break;
      case "sludge": {
        const targets = this.nearestN(this.x, this.y, 1 + Math.floor(L / 2), 160);
        if (!targets.length) {
          m.cd = 0.3;
          return;
        }
        for (const t of targets) this.lob(t.x, t.y, 5, (14 + 5 * L) * pw, { r: (22 + 3 * L) * this.area, dps: (4 + 2 * L) * pw });
        gsfx.shoot("water");
        break;
      }
      case "icebeam": {
        const len = 220;
        this.fx.push({
          kind: "hbeam", x: this.x, y: this.y - 8, x2: this.x + this.aimV.x * len, y2: this.y - 8 + this.aimV.y * len, owner: this.cur,
          t: 0, life: 0.45, charge: 0.12, r: (8 + L) * this.area, dmg: (30 + 14 * L) * pw, elem: "ice",
        });
        gsfx.zap();
        break;
      }
      case "gigadrain": {
        const targets = this.nearestN(this.x, this.y, 3 + L, 130 * this.area);
        if (!targets.length) {
          m.cd = 0.3;
          return;
        }
        for (const e of targets) {
          this.damage(e, (14 + 6 * L) * pw, 0, 0, "grass", true);
          // the life flows back to the player
          for (let i = 0; i < 4; i++) this.part(e.x, e.y - 8, (this.x - e.x) * rand(1.6, 2.4), (this.y - 8 - e.y) * rand(1.6, 2.4), "grassFx", 0.45, 2, 0, "spark");
        }
        this.hp = Math.min(this.maxHp, this.hp + (0.6 + 0.3 * L) * targets.length);
        gsfx.heal();
        break;
      }
      case "hex":
        if (!this.hexAll((30 + 14 * L) * pw, 0)) m.cd = 0.4;
        break;
      case "aura": {
        const n = L >= 3 ? 2 : 1;
        const targets = this.nearestN(this.x, this.y, n, 220);
        if (!targets.length) {
          m.cd = 0.3;
          return;
        }
        for (let i = 0; i < n; i++) {
          const t = targets[i % targets.length];
          const a = Math.atan2(t.y - this.y, t.x - this.x) + (n > 1 ? (i ? 0.6 : -0.6) : 0);
          this.shoot("aura", this.x, this.y - 8, Math.cos(a), Math.sin(a), 130, 5, (26 + 10 * L) * pw, 0, 3, "fight", t);
        }
        gsfx.shoot("shadow");
        break;
      }
      case "future":
        if (!this.foresee(2 + Math.floor(L / 2), (60 + 25 * L) * pw, 30 * this.area)) m.cd = 0.4;
        break;
      case "dazzle": {
        // all around: the foes it reaches are charmed (in damage)
        const R = (55 + 8 * L) * this.area;
        for (const e of this.around(this.x, this.y, R)) this.damage(e, (8 + 4 * L) * pw, 0, 0, "fairy", true);
        this.fx.push({ kind: "ring", x: this.x, y: this.y, t: 0, life: 0.45, r: R, elem: "fairy" });
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2;
          this.part(this.x + Math.cos(a) * R * 0.5, this.y - 8 + Math.sin(a) * R * 0.4, Math.cos(a) * 40, Math.sin(a) * 30 - 20, "fairy2", 0.6, 2, 0, "spark");
        }
        gsfx.levelUp();
        break;
      }
      case "flashcannon": {
        const len = 240;
        this.fx.push({
          kind: "hbeam", x: this.x, y: this.y - 8, x2: this.x + this.aimV.x * len, y2: this.y - 8 + this.aimV.y * len, owner: this.cur,
          t: 0, life: 0.5, charge: 0.15, r: (9 + 1.5 * L) * this.area, dmg: (34 + 15 * L) * pw, elem: "steel",
        });
        gsfx.zap();
        break;
      }
      case "darkpulse":
        this.fx.push({ kind: "ring", x: this.x, y: this.y, t: 0, life: 0.55, r: (65 + 10 * L) * this.area, elem: "dark", hit: new Set(), dmg: (18 + 8 * L) * pw });
        gsfx.shoot("shadow");
        break;
      case "xscissor": {
        // two blades crossing on each of the closest foes
        const targets = this.nearestN(this.x, this.y, 1 + Math.floor(L / 2), 200);
        if (!targets.length) {
          m.cd = 0.3;
          return;
        }
        for (const t of targets) {
          const a = Math.atan2(t.y - this.y, t.x - this.x);
          for (const da of [-0.35, 0.35]) this.shoot("blade", this.x, this.y - 8, Math.cos(a + da), Math.sin(a + da), 190, 4, (8 + 3 * L) * pw, 1, 1.4, "bug", t);
        }
        gsfx.shoot("whip");
        break;
      }
      // ---- the evolved moves ----
      case "moonblast": {
        // the moon falls where the foes are thickest; it heals a little
        const near = this.nearestN(this.x, this.y, 12, 200);
        let at = near[0] ?? null, most = -1;
        for (const e of near) {
          const n = this.around(e.x, e.y, 46 * this.area).length;
          if (n > most) {
            most = n;
            at = e;
          }
        }
        this.fx.push({ kind: "meteor", x: at ? at.x : this.x + rand(-60, 60), y: at ? at.y : this.y + rand(-50, 50), t: 0, life: 0.6, r: 46 * this.area, dmg: 70 * pw, elem: "fairy" });
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.02);
        gsfx.levelUp();
        break;
      }
      case "steelbeam": {
        // four beams in a cross, a little further round each time
        const a0 = this.time * 1.3;
        for (let i = 0; i < 4; i++) {
          const a = a0 + (i * Math.PI) / 2;
          this.fx.push({
            kind: "hbeam", x: this.x, y: this.y - 8, x2: this.x + Math.cos(a) * 200, y2: this.y - 8 + Math.sin(a) * 200, owner: this.cur,
            t: 0, life: 0.4, charge: 0.1, r: 10 * this.area, dmg: 75 * pw, elem: "steel",
          });
        }
        gsfx.zap();
        break;
      }
      case "scald":
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + this.time;
          this.shoot("scald", this.x, this.y - 8, Math.cos(a), Math.sin(a), 95, 5, 40 * pw, 2, 2.2, "water");
        }
        gsfx.wave();
        break;
      case "zapcannon":
        this.shockwave(140 * this.area, 110 * pw, 1.8, 12);
        this.flash = 0.35;
        break;
      case "poltergeist":
        this.hexAll(140 * pw, 50 * pw);
        break;
      case "sacredfire":
        this.fx.push({ kind: "zone", x: this.x, y: this.y, t: 0, life: 4, r: 80 * this.area, dmg: 30 * pw, tick: 0, elem: "fire", owner: this.cur, heal: 1 });
        gsfx.fire();
        break;
      case "closecombat":
        this.flurry(70 * pw);
        break;
      case "doomdesire":
        if (!this.foresee(6, 220 * pw, 40 * this.area)) m.cd = 0.4;
        break;
      case "gunk": {
        const targets = this.nearestN(this.x, this.y, 8, 180);
        for (let i = 0; i < 3; i++) {
          const t = targets.length ? targets[Math.floor(Math.random() * targets.length)] : null;
          this.lob(t ? t.x : this.x + rand(-80, 80), t ? t.y : this.y + rand(-60, 60), 8, 60 * pw, { r: 50 * this.area, dps: 18 * pw });
        }
        gsfx.shoot("water");
        break;
      }
      case "fulgur": {
        const onScreen = this.enemies.filter((e) => !e.dead && Math.abs(e.x - this.cam.x) < SW / 2 && Math.abs(e.y - this.cam.y) < SH / 2);
        if (!onScreen.length) {
          m.cd = 0.3;
          return;
        }
        for (let i = 0; i < 7 && onScreen.length; i++) {
          const e = onScreen.splice(Math.floor(Math.random() * onScreen.length), 1)[0];
          this.fx.push({ kind: "strike", x: e.x, y: e.y, t: 0, life: 0.3, pts: jag([[e.x + rand(-20, 20), e.y - 200], [e.x, e.y - 4]], 10), elem: "elec" });
          for (const o of this.around(e.x, e.y, 18 * this.area)) this.damage(o, 110 * pw * (o === e ? 1 : 0.5), 0, 0, "elec", true);
          // and it bounces to two more
          const pts: [number, number][] = [[e.x, e.y - 8]];
          for (const o of this.nearestN(e.x, e.y, 3, 60).filter((o) => o !== e).slice(0, 2)) {
            pts.push([o.x, o.y - 8]);
            this.damage(o, 60 * pw, 0, 0, "elec", true);
          }
          if (pts.length > 1) this.fx.push({ kind: "bolt", x: 0, y: 0, t: 0, life: 0.14, pts: jag(pts) });
        }
        this.flash = 0.3;
        this.shake = Math.max(this.shake, 3);
        gsfx.thunder();
        break;
      }
      case "blast": {
        const a = Math.atan2(this.aimV.y, this.aimV.x);
        this.shoot("blast", this.x, this.y - 8, Math.cos(a), Math.sin(a), 130, 6, 90 * pw, 0, 0.9, "fire");
        gsfx.fire();
        break;
      }
      case "hydro":
        for (const [delay, r] of [[0, 1], [0.35, 1.25]])
          this.fx.push({ kind: "ring", x: this.x, y: this.y, t: -delay, life: 0.75, r: 150 * r * this.area, elem: "water", hit: new Set(), dmg: 70 * pw, heal: 0 });
        gsfx.wave();
        break;
      case "petal": {
        // the petals circle by themselves (orbits); now and then they shoot off at the closest foes
        const targets = this.nearestN(this.x, this.y, 3, 200);
        targets.forEach((t, i) => {
          const a = this.time * 3 + (i / 3) * Math.PI * 2;
          this.shoot("leaf", this.x + Math.cos(a) * 40, this.y - 8 + Math.sin(a) * 32, Math.cos(a), Math.sin(a), 150, 3, 32 * pw, 1, 1.6, "grass", t);
        });
        break;
      }
      case "blizzard":
        break;
      case "draco": {
        const targets = this.nearestN(this.x, this.y, 12, 200);
        for (let i = 0; i < 5; i++) {
          const t = targets.length ? targets[Math.floor(Math.random() * targets.length)] : null;
          const x = t ? t.x + rand(-8, 8) : this.x + rand(-90, 90), y = t ? t.y + rand(-8, 8) : this.y + rand(-80, 80);
          this.fx.push({ kind: "meteor", x, y, t: -i * 0.12, life: 0.55, r: 26 * this.area, dmg: 85 * pw, elem: "dragon" });
        }
        break;
      }
      case "fissure": {
        const R = 170 * this.area;
        for (const e of this.around(this.x, this.y, R)) {
          const d = Math.hypot(e.x - this.x, e.y - this.y) || 1;
          // the abyss: a few never get up (never a boss nor a golden one)
          if (!e.boss && !e.elite && Math.random() < 0.08) this.damage(e, e.hp + 1, 0, 0, "ground", true);
          else this.damage(e, 140 * pw, ((e.x - this.x) / d) * 110, ((e.y - this.y) / d) * 110, "ground", true);
        }
        this.fx.push({ kind: "quake", x: this.x, y: this.y, t: 0, life: 0.8, r: R });
        this.shake = 10;
        for (let i = 0; i < 40; i++) {
          const a = Math.random() * Math.PI * 2;
          this.part(this.x + Math.cos(a) * R * 0.6, this.y + Math.sin(a) * R * 0.5, Math.cos(a) * 30, -rand(10, 50), "ground2", 0.8, 2, 60, "puff");
        }
        gsfx.quake();
        break;
      }
    }
  }

  /** the foes on the current player's screen */
  private onScreen() {
    return this.enemies.filter((e) => !e.dead && Math.abs(e.x - this.cam.x) < SW / 2 && Math.abs(e.y - this.cam.y) < SH / 2);
  }

  /** a move of its own, outside the 4 slots (Mewtwo, Gengar) */
  private stepSig(dt: number) {
    const sig = this.starter.sig;
    if (sig === "psystrike") this.stepPsystrike(dt);
    else if (sig === "phantom") this.stepPhantom(dt);
    else if (sig === "speed" || sig === "ere" || sig === "rollout" || sig === "wish" || (sig === "rage" && this.dex === 130)) this.stepTalent(dt);
  }

  /** the talents that come back on their own: Extreme Speed, Icy Surf, Gyarados's Hyper Beam, Rollout, Wish */
  private stepTalent(dt: number) {
    const p = this.cur;
    p.sigT -= dt;
    if (p.sigT > 0) return;
    const sig = this.starter.sig;
    if (!this.nearest(this.x, this.y, sig === "speed" || sig === "rollout" ? 150 : 200) && !(sig === "wish" && this.hp < this.maxHp)) {
      p.sigT = 0.3;
      return;
    }
    if (sig === "speed" || sig === "rollout") {
      // a dash through the pack where it aims: Extreme Speed burns what it crosses; Rollout, longer and slower, crushes it
      const roll = sig === "rollout";
      p.sigT = (roll ? (this.stage === 2 ? 3.5 : this.stage ? 4.2 : 5) : this.stage ? 2.4 : 3.5) * this.haste;
      this.dashT = roll ? 0.5 : 0.26;
      p.dashSpeed = roll ? 240 : 340;
      p.dashElem = roll ? "ground" : "fire";
      this.dashV = { ...this.aimV };
      this.dashHit = new Set();
      p.dashDmg = (roll ? 30 + 6 * this.level : 24 + 5 * this.level) * this.power;
      this.invuln = Math.max(this.invuln, roll ? 0.65 : 0.4);
      if (roll) gsfx.quake();
      else gsfx.shoot("ember");
    } else if (sig === "wish") {
      // Wish: a part of its HP back, and a pink flash that charms all around it (Clefable: more often)
      p.sigT = (this.stage === 2 ? 7 : this.stage ? 8.5 : 10) * this.haste;
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.2);
      this.fx.push({ kind: "ring", x: this.x, y: this.y, t: 0, life: 0.5, r: 90 * this.area, elem: "fairy", hit: new Set(), dmg: (10 + 2 * this.level) * this.power });
      for (let i = 0; i < 10; i++) this.part(this.x + rand(-8, 8), this.y - rand(0, 18), rand(-20, 20), -rand(20, 50), "fairy2", 0.6, 2, 0, "spark");
      gsfx.heal();
    } else if (sig === "ere") {
      // a wave that soaks everything around, then a cold one that freezes the wet
      p.sigT = 6.5 * this.haste;
      const R = 115 * this.area, dmg = (14 + 3 * this.level) * this.power;
      this.fx.push({ kind: "ring", x: this.x, y: this.y, t: 0, life: 0.6, r: R, elem: "water", hit: new Set(), dmg });
      this.fx.push({ kind: "ring", x: this.x, y: this.y, t: -0.55, life: 0.6, r: R, elem: "ice", hit: new Set(), dmg });
      gsfx.wave();
    } else {
      // Gyarados's Hyper Beam where it aims
      p.sigT = 3.6 * this.haste;
      this.fx.push({
        kind: "hbeam", x: this.x, y: this.y - 8, x2: this.x + this.aimV.x * 280, y2: this.y - 8 + this.aimV.y * 280, owner: this.cur,
        t: 0, life: 0.6, r: 18 * this.area, dmg: (50 + 10 * this.level) * this.power, elem: "normal",
      });
      gsfx.wave();
    }
  }

  /** Mewtwo's Psystrike: every few seconds, a psychic blast on every foe on screen (Mega Mewtwo: sooner) */
  private stepPsystrike(dt: number) {
    const p = this.cur;
    p.sigT -= dt;
    if (p.sigT > 0) return;
    const foes = this.onScreen();
    if (!foes.length) {
      p.sigT = 0.3;
      return;
    }
    p.sigT = (this.stage ? 4 : 5.5) * this.haste;
    const dmg = (45 + 9 * this.level) * this.power;
    for (const e of foes) {
      this.damage(e, dmg, (e.x - this.x) * 1.5, (e.y - this.y) * 1.5, "psy", true);
      if (!e.boss) e.slowT = Math.max(e.slowT, 1.2);
      for (let i = 0; i < 3; i++) this.part(e.x + rand(-6, 6), e.y - rand(4, 16), rand(-20, 20), -rand(20, 50), "psy2", 0.5, 2, 0, "spark");
    }
    this.fx.push({ kind: "ring", x: this.x, y: this.y, t: 0, life: 0.5, r: 230, elem: "psy" });
    this.flash = 0.35;
    this.shake = Math.max(this.shake, 5);
    gsfx.thunder();
  }

  /**
   * Gengar's Phantom Force: every few seconds it sinks into the shadows, untouchable, then bursts out; the foes around it
   * that hold on fall asleep (Hypnosis), which the nightmare combo turns into double Ghost damage. Mega Gengar: sooner,
   * wider, and its Shadow Tag slows every foe close to it.
   */
  private stepPhantom(dt: number) {
    const p = this.cur;
    if (this.stage) for (const e of this.around(this.x, this.y, 70 * this.area)) if (!e.boss) e.slowT = Math.max(e.slowT, 0.3);
    if (p.phaseT > 0) {
      p.phaseT -= dt;
      p.invuln = Math.max(p.invuln, p.phaseT + 0.1);
      if (Math.random() < 0.6) this.part(this.x + rand(-10, 10), this.y - rand(0, 6), rand(-10, 10), -rand(10, 30), "ghost2", 0.5, 2, 0, "puff");
      if (p.phaseT <= 0) this.phantomBurst();
      return;
    }
    p.sigT -= dt;
    if (p.sigT > 0) return;
    if (!this.around(this.x, this.y, 130).length) {
      p.sigT = 0.3;
      return;
    }
    p.sigT = (this.stage ? 4.5 : 6) * this.haste;
    p.phaseT = 0.7;
    for (let i = 0; i < 10; i++) this.part(this.x + rand(-8, 8), this.y - rand(0, 16), rand(-30, 30), rand(-20, 10), "ghost", 0.5, 3, 0, "puff");
    gsfx.shoot("shadow");
  }

  private phantomBurst() {
    const R = (this.stage ? 110 : 90) * this.area;
    const dmg = (40 + 8 * this.level) * this.power;
    for (const e of this.around(this.x, this.y, R)) {
      this.damage(e, dmg, (e.x - this.x) * 2, (e.y - this.y) * 2, "ghost", true);
      if (!e.boss && !e.dead) e.sleepT = Math.max(e.sleepT, 1.6);
    }
    this.fx.push({ kind: "ring", x: this.x, y: this.y, t: 0, life: 0.45, r: R, elem: "ghost" });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.part(this.x + Math.cos(a) * 8, this.y - 6 + Math.sin(a) * 6, Math.cos(a) * R * 1.6, Math.sin(a) * R * 1.2, i % 2 ? "ghost" : "ghost2", 0.45, 3, 0, "puff");
    }
    this.flash = 0.25;
    this.shake = Math.max(this.shake, 6);
    gsfx.boom();
  }

  /** a poison that holds (Twisted Spoon: stronger) */
  private poisonFoe(e: Enemy, dps: number, t: number) {
    e.poisonT = Math.max(e.poisonT, t);
    e.poisonDps = Math.max(e.poisonDps, dps * (1 + 0.3 * this.itemLevel("spoon")));
  }

  /** a blob lobbed at a spot: it bursts there, and leaves a toxic puddle */
  private lob(tx: number, ty: number, r: number, dmg: number, pool: { r: number; dps: number }) {
    const dx = tx - this.x, dy = ty - 8 - (this.y - 8), d = Math.hypot(dx, dy) || 1;
    this.shoot("sludge", this.x, this.y - 8, dx / d, dy / d, 130, r, dmg, 0, Math.min(1.4, d / 130 + 0.05), "poison");
    this.shots[this.shots.length - 1].pool = pool;
  }

  /** Discharge, Zap Cannon: a shock all around, paralysing a moment (the bosses only slowed) */
  private shockwave(R: number, dmg: number, stun: number, bolts: number) {
    const hit = this.around(this.x, this.y, R);
    for (const e of hit) {
      this.damage(e, dmg, 0, 0, "elec", true);
      if (!e.boss) e.sleepT = Math.max(e.sleepT, stun);
      e.slowT = Math.max(e.slowT, stun + 1);
    }
    for (const e of hit.slice(0, bolts)) this.fx.push({ kind: "bolt", x: 0, y: 0, t: 0, life: 0.16, pts: jag([[this.x, this.y - 8], [e.x, e.y - 8]]) });
    this.fx.push({ kind: "ring", x: this.x, y: this.y, t: 0, life: 0.35, r: R, elem: "elec" });
    gsfx.thunder();
  }

  /** Hex, Poltergeist: every foe on screen with a status takes a heavy hit (Poltergeist: the others a lighter one) */
  private hexAll(hard: number, soft: number) {
    let n = 0;
    for (const e of this.onScreen()) {
      const marked = e.wetT > 0 || e.burnT > 0 || e.poisonT > 0 || e.sleepT > 0 || e.slowT > 0 || e.charmT > 0;
      if (!marked && !soft) continue;
      n++;
      this.damage(e, marked ? hard : soft, 0, 0, "ghost", true);
      if (marked && n <= 14) this.fx.push({ kind: "strike", x: e.x, y: e.y, t: 0, life: 0.3, pts: jag([[e.x + rand(-10, 10), e.y - 60], [e.x, e.y - 4]], 6), elem: "ghost" });
    }
    if (n) gsfx.shoot("shadow");
    return n > 0;
  }

  /** Future Sight, Doom Desire: the toughest foes on screen marked; they blow up a moment later */
  private foresee(n: number, dmg: number, r: number) {
    const foes = this.onScreen().sort((a, b) => b.hp - a.hp).slice(0, n);
    for (const e of foes) this.fx.push({ kind: "mark", x: e.x, y: e.y, t: 0, life: 1.3, r, dmg, elem: "psy", target: e, owner: this.cur });
    if (foes.length) gsfx.zap();
    return foes.length > 0;
  }

  /** Close Combat: three blows in a row, in front */
  private flurry(dmg: number) {
    const reach = 58 * this.area;
    const angle = Math.atan2(this.aimV.y, this.aimV.x);
    for (let k = 0; k < 3; k++) this.fx.push({ kind: "punch", x: this.x, y: this.y - 8, t: -k * 0.08, life: 0.2, a: angle + (k - 1) * 0.35, r: reach, elem: "fight" });
    for (const e of this.around(this.x, this.y, reach + 12)) {
      const da = Math.abs(((Math.atan2(e.y - this.y, e.x - this.x) - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (da < 0.95 && dist2(e.x, e.y, this.x, this.y) < (reach + e.r) ** 2) this.damage(e, dmg, this.aimV.x * 160, this.aimV.y * 160, "fight");
    }
    this.shake = Math.max(this.shake, 3);
    gsfx.shoot("whip");
  }

  /** Quick Attack: the player rushes, hitting what it goes through */
  private stepDash(dt: number) {
    for (const t of this.trail) t.t += dt;
    this.trail = this.trail.filter((t) => t.t < 0.25);
    if (this.dashT <= 0) return;
    this.dashT -= dt;
    // a talent's dash (Extreme Speed, Rollout) has its own speed and type; Quick Attack's is plain
    const talent = this.cur.dashDmg;
    const elem: Elem = talent ? this.cur.dashElem : "normal";
    const speed = talent ? this.cur.dashSpeed : 340;
    this.x += this.dashV.x * speed * dt;
    this.y += this.dashV.y * speed * dt;
    this.trail.push({ x: this.x, y: this.y, dir: this.dir, t: 0 });
    const m = this.moves.find((x) => x.id === "quick");
    const L = m?.level ?? 1;
    for (const e of this.around(this.x, this.y, talent ? 20 : 16)) {
      if (this.dashHit.has(e)) continue;
      this.dashHit.add(e);
      this.damage(e, talent || (20 + 8 * L) * this.power, this.dashV.x * 120, this.dashV.y * 120, elem);
    }
    if (talent && Math.random() < 0.8) this.part(this.x + rand(-4, 4), this.y - rand(0, 10), -this.dashV.x * 30, -rand(10, 30), TYPE_FX[elem][1], 0.4, 2, 0, "puff");
    if (this.dashT <= 0 && talent) {
      // it lands in a burst (of flames, of stones) that pushes the pack back
      this.fx.push({ kind: "ring", x: this.x, y: this.y, t: 0, life: 0.3, r: 44 * this.area, elem, hit: new Set(), dmg: talent * 0.6 });
      this.invuln = Math.max(this.invuln, 0.6);
      this.cur.dashDmg = 0;
    }
  }

  /** Stealth Rock: stones on the ground that hurt (and wear out) */
  private stepRocks(dt: number) {
    const L = this.moves.find((x) => x.id === "rocks")?.level ?? 1;
    for (const r of this.rocks) {
      r.life -= dt;
      for (const e of this.around(r.x, r.y, 8)) {
        if (e.touchT > 0 || e.z > 4) continue;
        e.touchT = 0.4;
        this.damage(e, (15 + 6 * L) * this.power, 0, -20, "ground");
        r.hits--;
        for (let i = 0; i < 3; i++) this.part(r.x, r.y - 2, rand(-30, 30), -rand(20, 50), "rock", 0.4, 1, 160, "dot");
        if (r.hits <= 0) break;
      }
    }
    this.rocks = this.rocks.filter((r) => r.life > 0 && r.hits > 0);
  }

  /** what circles the player: ice crystals (Icy Wind, a while; Blizzard, always), petals (Petal Blizzard) */
  private orbits() {
    const out: { kind: "ice" | "petal"; n: number; R: number; speed: number; dmg: number; freeze: boolean }[] = [];
    for (const m of this.moves) {
      if (m.id === "ice" && m.active > 0) out.push({ kind: "ice", n: 1 + m.level, R: 30 * this.area, speed: 4, dmg: (9 + 4 * m.level) * this.power, freeze: false });
      if (m.id === "blizzard") out.push({ kind: "ice", n: 6, R: 36 * this.area, speed: 3.4, dmg: 40 * this.power, freeze: true });
      if (m.id === "petal") out.push({ kind: "petal", n: 5, R: 48 * this.area, speed: -2.6, dmg: 30 * this.power, freeze: false });
    }
    return out;
  }

  private flameTick(L: number) {
    if (Math.random() < 0.5) return;
    const a = Math.atan2(this.aimV.y, this.aimV.x) + rand(-0.28, 0.28);
    this.shoot("flame", this.x + this.aimV.x * 8, this.y - 8 + this.aimV.y * 8, Math.cos(a), Math.sin(a), rand(120, 150), 4, (5 + 2 * L) * this.power, 999, 0.45 + 0.05 * L, "fire");
  }

  /* ---------------- damage ---------------- */

  private damage(e: Enemy, base: number, kx: number, ky: number, elem: Elem, quiet = false) {
    if (e.dead || e.alpha < 0.5) return;
    // a giga boss roaring takes nothing: its guards first
    if (e.state === "roar") return;
    // a combo: the right type on a foe in the right state
    let mul = 1;
    for (const c of COMBOS)
      if (c.by === elem && c.mul > mul && (c.on === "wet" ? e.wetT : c.on === "burn" ? e.burnT : c.on === "poison" ? e.poisonT : c.on === "charm" ? e.charmT : e.sleepT) > 0) mul = c.mul;
    if (elem === "water") e.wetT = 4;
    if (elem === "fire") {
      e.burnT = 3;
      e.burnDps = Math.max(e.burnDps, base * 0.12 * (1 + 0.3 * this.itemLevel("spoon")));
    }
    if (elem === "ice" && e.wetT > 0 && !e.boss) e.sleepT = Math.max(e.sleepT, this.weather === "hail" ? 2 : 1.2);
    // Fairy charms (a titan, not for long; a boss, never); Dark makes foes flinch now and then
    if (elem === "fairy" && !e.boss) {
      if (e.charmT <= 0 && ++this.charmed === 100) unlock("game-charm");
      e.charmT = Math.max(e.charmT, e.titan ? 1 : 1.8);
    }
    if (elem === "dark" && !e.boss && Math.random() < 0.3) e.sleepT = Math.max(e.sleepT, 0.5);
    const crit = Math.random() < this.crit;
    const day = this.setup.daily?.mod.elem;
    const boost = day && (elem === day[0] || (day[0] === "water" && elem === "elec")) ? day[1] : 1;
    const dmg = Math.max(1, Math.round(base * mul * boost * this.weatherMul(elem) * (crit ? this.critMul : 1) * rand(0.9, 1.1)));
    if (mul > 1) {
      unlock("game-combo");
      for (let i = 0; i < 5; i++) this.part(e.x, e.y - 10, rand(-40, 40), rand(-60, -10), "gold", 0.4, 2, 60, "spark");
      if (!quiet) gsfx.zap();
    }
    e.hp -= dmg;
    e.hitT = 0.1;
    // King's Rock: now and then, the foe is knocked out cold for a moment
    const rock = this.itemLevel("kingsrock");
    if (rock && !e.boss && e.hp > 0 && Math.random() < 0.04 * rock) e.sleepT = Math.max(e.sleepT, 1);
    const heavy = e.boss ? 0.15 : 1;
    e.kx += kx * heavy;
    e.ky += ky * heavy;
    if (this.nums.length > 50) this.nums.shift();
    this.nums.push({ x: e.x + rand(-4, 4), y: e.y - 14 - (e.boss ? 14 : 0), t: 0, text: mul > 1 ? `${dmg}!` : String(dmg), color: mul > 1 ? "psy" : crit ? "gold" : "ui", big: crit || mul > 1 });
    if (!quiet) gsfx.hit(crit);
    const [c1] = TYPE_FX[elem];
    for (let i = 0; i < (crit ? 6 : 2); i++) this.part(e.x, e.y - 8, rand(-50, 50), rand(-60, 10), c1, 0.3, 1, 100, "spark");
    if (e.hp <= 0) this.kill(e);
  }

  private kill(e: Enemy) {
    e.dead = true;
    e.deadT = 0;
    this.kills++;
    gsfx.faint();
    const bell = this.itemLevel("shellbell");
    if (bell) this.hp = Math.min(this.maxHp, this.hp + 0.3 * bell);
    for (let i = 0; i < 6; i++) this.part(e.x + rand(-4, 4), e.y - 6, rand(-25, 25), rand(-30, 0), "white", 0.45, 3, -10, "puff");
    if (e.w?.act === "explode") this.explode(e, false);
    // Gengar's Curse: each foe it knocks out sends a wisp at the next one (and that one's at the next...)
    if (this.starter.sig === "phantom" && !e.boss && this.shots.length < 250) {
      const next = this.nearest(e.x, e.y, 130);
      if (next) {
        const dx = next.x - e.x, dy = next.y - e.y, d = Math.hypot(dx, dy) || 1;
        this.shoot("gball", e.x, e.y - 8, dx / d, dy / d, 150, 3, (12 + 3 * this.level) * this.power, 0, 1.5, "ghost", next);
      }
    }
    const xp = (e.w?.xp ?? 0) * (e.elite ? 4 : e.titan ? TITAN.xp : 1);
    if (e.titan) unlock("defi-titan");
    if (e.boss?.giga && !this.setup.defi) unlock("game-giga");
    if (e.boss && (this.setup.defi || e.final)) this.bossDown(e);
    else if (e.boss) {
      unlock("game-boss");
      this.bossAlive = null;
      this.breakAt = this.time + 1.5;
      music.boss(false);
      this.shake = 10;
      this.flash = 0.8;
      this.drop("rare", e.x, e.y, 0);
      this.drop("oran", e.x + 8, e.y, 0);
      for (let i = 0; i < 14; i++) this.drop("candy", e.x + rand(-20, 20), e.y + rand(-20, 20), 8);
      for (let i = 0; i < 10; i++) this.drop("coin", e.x + rand(-24, 24), e.y + rand(-24, 24), 2 + Math.floor(this.wave / 4));
      gsfx.rare();
      // the 100th wave's boss: what used to be the end, now the way beyond
      if (this.wave === BEYOND) {
        unlock("game-wave100");
        gsfx.evolveDone();
        this.showBanner(this.tr("100 VAGUES !", "100 WAVES!"), this.tr("et ce n'est pas fini…", "and it's not over…"));
      } else
        this.showBanner(this.tr(`${this.name(e.dex)} est K.O. !`, `${this.name(e.dex)} fainted!`), this.tr("un Super Bonbon est tombé", "a Rare Candy dropped"));
    } else if (e.w?.act === "treasure") {
      unlock("game-chansey");
      for (let i = 0; i < 8; i++) this.drop("candy", e.x + rand(-14, 14), e.y + rand(-14, 14), 8);
      for (let i = 0; i < 6; i++) this.drop("coin", e.x + rand(-14, 14), e.y + rand(-14, 14), 2 + Math.floor(this.wave / 5));
      this.drop("egg", e.x, e.y, 0);
      gsfx.rare();
    } else {
      this.drop("candy", e.x, e.y, xp);
      // gold: now and then, worth a little more as the waves go on (the late waves bring many more foes already)
      const v = 1 + Math.floor(this.wave / 6);
      if (e.elite) for (let i = 0; i < 2; i++) this.drop("coin", e.x + rand(-8, 8), e.y + rand(-8, 8), v);
      else if (Math.random() < 0.06) this.drop("coin", e.x, e.y, v);
      const r = Math.random();
      if (r < 0.012) this.drop("oran", e.x, e.y, 0);
      else if (r < 0.016) this.drop("magnet", e.x, e.y, 0);
      else if (r < 0.0175) this.drop("rare", e.x, e.y, 0);
    }
  }

  /**
   * A boss falls where there's no break: the daily challenge's (its wave-5 boss: half the HP back; its giga boss, or the
   * classic's 100th wave: won), the loot bursting out.
   */
  private bossDown(e: Enemy) {
    this.bossAlive = null;
    music.boss(false);
    this.shake = 10;
    this.flash = 0.8;
    unlock("game-boss");
    for (let i = 0; i < 10; i++) this.drop("candy", e.x + rand(-20, 20), e.y + rand(-20, 20), 8);
    for (let i = 0; i < 8; i++) this.drop("coin", e.x + rand(-24, 24), e.y + rand(-24, 24), 3);
    gsfx.rare();
    if (e.boss!.giga || !this.setup.defi) {
      // won: everyone untouchable, the foes gone, the end a moment later
      this.endAt = this.time + 3;
      this.defiLeft = 0;
      for (const o of this.enemies) if (!o.dead && o !== e) Object.assign(o, { dead: true, deadT: 0 });
      this.foes = [];
      for (const p of this.players) p.invuln = 99;
      this.showBanner(this.tr("VICTOIRE !", "VICTORY!"), this.tr(`${this.name(e.dex)} est K.O.`, `${this.name(e.dex)} fainted`));
      gsfx.evolveDone();
      return;
    }
    for (const p of this.players) if (!p.down) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5);
    gsfx.heal();
    this.showBanner(this.tr(`${this.name(e.dex)} est K.O. !`, `${this.name(e.dex)} fainted!`), this.tr("la moitié de tes PV revient", "half your HP comes back"));
  }

  /** Abra's Teleport: away from the blow, a psychic mine left where it stood */
  private teleport(from?: Enemy) {
    const p = this.cur;
    p.sigCd = (this.stage === 2 ? 1.8 : 2.5) * this.haste;
    this.fx.push({ kind: "mark", x: this.x, y: this.y, t: 0, life: 0.6, r: 42 * this.area, dmg: (30 + 6 * this.level) * this.power, elem: "psy", target: null, owner: p });
    for (let i = 0; i < 10; i++) this.part(this.x + rand(-6, 6), this.y - rand(0, 16), rand(-30, 30), rand(-30, 10), "psy2", 0.4, 2, 0, "spark");
    const away = from ? Math.atan2(this.y - from.y, this.x - from.x) : Math.random() * Math.PI * 2;
    const a = away + rand(-0.6, 0.6);
    this.x += Math.cos(a) * 70;
    this.y += Math.sin(a) * 60;
    this.invuln = Math.max(this.invuln, 0.5);
    for (let i = 0; i < 10; i++) this.part(this.x + rand(-6, 6), this.y - rand(0, 16), rand(-30, 30), rand(-30, 10), "psy2", 0.4, 2, 0, "spark");
    gsfx.shoot("bolt");
  }

  private explode(e: Enemy, hurtsPlayer: boolean) {
    const R = 30;
    this.fx.push({ kind: "boom", x: e.x, y: e.y - 6, t: 0, life: 0.4, r: R });
    this.shake = Math.max(this.shake, 4);
    gsfx.boom();
    for (const o of this.around(e.x, e.y, R)) if (o !== e) this.damage(o, 40 * (1 + this.wave * 0.05), (o.x - e.x) * 3, (o.y - e.y) * 3, "normal", true);
    if (hurtsPlayer && dist2(this.x, this.y, e.x, e.y) < (R + PLAYER_R) ** 2) this.hurt(e.dmg);
  }

  private hurt(dmg: number, from?: Enemy) {
    if (this.invuln > 0 || this.shieldT > 0 || this.cur.restT > 0) return;
    const sig = this.starter.sig;
    // Teleport (Abra's talent): the blow lands on nothing but a psychic mine
    if (sig === "teleport" && this.cur.sigCd <= 0) return this.teleport(from);
    // Snorlax's thick body: who bumps into it pays for it
    if (sig === "rest" && from && !from.dead) this.damage(from, (10 + 3 * this.level) * this.power, (from.x - this.x) * 4, (from.y - this.y) * 4, "normal", true);
    // Lapras's shell, Gyarados's glare
    if (sig === "ere" || (sig === "rage" && this.dex === 130)) dmg *= 0.75;
    // Poison Point: who touches Nidoran is poisoned, and a poisoned foe hits softer
    if (sig === "poisonpoint" && from && !from.dead) {
      if (from.poisonT > 0) dmg *= 0.7;
      this.poisonFoe(from, (6 + 2 * this.level) * this.power, 4);
    }
    // Geodude's rock body; Dragon Dance's scales, at full HP
    dmg *= this.starter.armor ?? 1;
    if (sig === "dragondance" && this.hp >= this.maxHp * 0.98) dmg *= 0.5;
    const helmet = this.itemLevel("helmet");
    if (from && helmet && !from.dead) this.damage(from, (20 + 12 * helmet) * this.power, (from.x - this.x) * 4, (from.y - this.y) * 4, "ground", true);
    const protect = this.moves.find((m) => m.id === "protect" && m.cd <= 0);
    if (protect) {
      // Protect takes the hit, then keeps a bubble up for a moment
      this.shieldT = 0.8 + 0.2 * protect.level;
      protect.cd = MOVES.find((d) => d.id === "protect")!.cd[protect.level - 1] * this.haste;
      gsfx.shield();
      return;
    }
    dmg *= (1 - 0.07 * this.itemLevel("eviolite")) * (1 - 0.025 * this.perm("armor"));
    // never more than 30 % of the max HP a blow (Johan, 2026-10-18: past wave 60 any touch was a one-shot, and running
    // through the crowd happens all the time): a run wears down, it doesn't end on one bump
    dmg = Math.min(dmg, this.maxHp * HIT_CAP);
    // Focus Sash: a fatal blow leaves 1 HP, then it needs a while
    const sash = this.itemLevel("sash");
    if (sash && this.hp - dmg <= 0 && this.hp > 1 && this.cur.sashCd <= 0) {
      dmg = this.hp - 1;
      this.cur.sashCd = 100 - 15 * sash;
      this.invuln = 1.5;
      this.fx.push({ kind: "text", x: this.x, y: this.y - 30, t: 0, life: 1.2, text: this.tr("TIENT BON !", "HOLDS ON!"), color: "gold" });
      gsfx.shield();
    }
    this.hp -= dmg;
    // a little less breathing room as the waves go on
    this.invuln = Math.max(0.45, 0.8 - this.wave * 0.012);
    if (sig === "counter") {
      // Counter: the blow comes back as a shockwave
      this.fx.push({ kind: "ring", x: this.x, y: this.y, t: 0, life: 0.35, r: 70 * this.area, elem: "fight", hit: new Set(), dmg: (dmg * 3 + 15 + 4 * this.level) * this.power });
      this.shake = Math.max(this.shake, 5);
    }
    if (sig === "rest" && this.hp > 0 && this.hp < this.maxHp * 0.35 && this.cur.sigCd <= 0) {
      // Rest: asleep for 2 s, untouchable, and back to full
      this.cur.restT = 2;
      this.cur.sigCd = 25;
      this.showBanner(this.tr("REPOS", "REST"), this.tr(`${this.name(this.dex)} s'endort…`, `${this.name(this.dex)} fell asleep…`));
      gsfx.heal();
    }
    this.hurtT = 0.3;
    this.hurtFlash = 1;
    this.shake = Math.max(this.shake, 3);
    gsfx.hurt();
  }

  /* ---------------- spawning ---------------- */

  private makeEnemy(dex: number, x: number, y: number, titan = false): Enemy {
    const w = WILD[dex] ?? DEFI_WILD[dex] ?? null;
    // the daily challenge's 10 waves climb like 17 of a classic run
    const k = (this.wave - 1) * (this.setup.defi ? 1.7 : 1);
    // they get tougher faster than the player does, past the first waves; beyond the 100th, in a straight line (squared,
    // the 200th would hit 4 times as hard as the 100th: one blow and out)
    const kq = Math.min(k, BEYOND - 1), kl = Math.max(0, k - (BEYOND - 1));
    const hpMul = 1 + 0.18 * kq + 0.009 * kq * kq + (0.18 + 0.018 * kq) * kl;
    const dmgMul = 1 + 0.07 * kq + 0.003 * kq * kq + BEYOND_DMG * kl;
    const eliteOdds = this.setup.defi ? 0.04 + 0.008 * this.wave : (0.015 + 0.004 * this.wave) * (this.setup.daily?.mod.elite ?? 1);
    const elite = !titan && !!w && w.act !== "treasure" && w.act !== "flop" && Math.random() < eliteOdds;
    const big = titan ? TITAN : null;
    const hp = (w?.hp ?? 100) * hpMul * (elite ? 4 : 1) * (big?.hp ?? 1);
    return {
      w, boss: null, dex, x, y, kx: 0, ky: 0, hp, max: hp, speed: (w?.speed ?? 30) * (1 + Math.min(0.35, 0.012 * k)) * (elite ? 0.9 : 1) * (big?.speed ?? 1),
      dmg: (w?.dmg ?? 10) * dmgMul * (elite ? 1.5 : 1) * (this.setup.daily?.mod.enemyDmg ?? 1) * (big?.dmg ?? 1),
      r: (w?.r ?? 7) * (elite ? 1.3 : 1) * (big?.scale ?? 1), dir: 0, t: Math.random() * 2, hitT: 0, slowT: 0, sleepT: 0, wetT: 0, burnT: 0, burnDps: 0, poisonT: 0, poisonDps: 0, charmT: 0, dotT: 0.5,
      state: "", stateT: rand(1, 3), actT: 2, elite, titan, z: 0, alpha: 1, aim: { x: 0, y: 0 }, touchT: 0, n: 0, dead: false, deadT: 0, seed: Math.random() * 100,
    };
  }

  private spawnOne(dex: number, frac = Math.random()) {
    const a = frac * Math.PI * 2;
    const d = VIEW_R + rand(10, 40);
    // around one of the players standing
    const p = pick(this.alive().length ? this.alive() : this.players);
    this.enemies.push(this.makeEnemy(dex, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d));
  }

  /** the closest foe to another one (a charmed foe's target): not charmed itself, never a boss */
  private nearestFoe(e: Enemy, R: number) {
    let best: Enemy | null = null, bd = R;
    for (const o of this.enemies) {
      if (o === e || o.dead || o.boss || o.charmT > 0 || o.w?.act === "treasure") continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  /** the wild Pokémon of this wave: those come so far, but the ones gone by now */
  private get wildPool() {
    return POOLS.filter(([w]) => w <= this.wave).flatMap(([, d]) => d).filter((d) => !(RETIRE[d] && this.wave >= RETIRE[d]));
  }

  private spawn(dt: number) {
    // won: nobody else comes
    if (this.endAt) return;
    if (this.setup.defi) return this.spawnDefi(dt);
    const alive = this.enemies.length;
    // a start tier's ramp: a trickle at first, the wave's full crowd after RAMP seconds
    const k = this.startAt > 0 ? Math.min(1, (this.time - this.startAt) / RAMP) : 1;
    const cap = Math.min(260, 120 + this.wave * 6) * (0.15 + 0.85 * k);
    const rate =
      (0.6 + 0.3 * this.wave + 0.012 * this.wave * this.wave) * (this.bossAlive ? 0.5 : 1) * (this.setup.daily?.mod.spawn ?? 1) * (0.06 + 0.94 * k * k);
    this.spawnAcc += rate * dt;
    const pool = this.wildPool;
    while (this.spawnAcc >= 1) {
      this.spawnAcc--;
      if (alive >= cap) continue;
      // the biome's own come up more (among the wave's)
      const local = pool.filter((d) => this.biome.foes.includes(d));
      const dex = local.length && Math.random() < 0.45 ? pick(local) : pick(pool);
      // sometimes a whole group comes from one side
      if (Math.random() < 0.08) {
        const f = Math.random();
        for (let i = 0; i < 5; i++) this.spawnOne(dex, f + rand(-0.03, 0.03));
      } else this.spawnOne(dex);
    }
    // past wave 100, titans walk among the crowd, more and more often (a third as many while a boss is out)
    if (this.wave > TITANS_FROM) {
      this.titanT -= dt;
      if (this.titanT <= 0) {
        // one every ~25 s at wave 50, every ~14 s at 100, then more and more often
        const every = this.wave > BEYOND ? Math.max(4, 14 - (this.wave - BEYOND) * 0.1) : 25 - (this.wave - TITANS_FROM) * 0.22;
        this.titanT = every * (this.bossAlive ? 3 : 1);
        const a = Math.random() * Math.PI * 2, d = VIEW_R + 20;
        const p = pick(this.alive().length ? this.alive() : this.players);
        this.enemies.push(this.makeEnemy(pick(pool), p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, true));
        if (this.titanWave !== this.wave && !this.bossAlive) this.showBanner(this.tr("UN TITAN !", "A TITAN!"), this.tr("un ennemi géant", "a giant foe"));
        this.titanWave = this.wave;
      }
    }
    if (this.treasureAt > 0 && this.time >= this.treasureAt) {
      this.treasureAt = -1;
      // on screen, not far: it's a gift, not a chase across the map
      const a = Math.random() * Math.PI * 2;
      const d = rand(90, 120);
      this.enemies.push(this.makeEnemy(113, this.x + Math.cos(a) * d, this.y + Math.sin(a) * d * 0.8));
      this.showBanner(this.tr("Un Leveinard !", "A Chansey!"), this.tr("attrape-le avant qu'il file", "catch it before it runs off"));
      gsfx.rare();
    }
  }

  /* ---------------- the wild Pokémon ---------------- */

  private stepEnemies(dt: number) {
    const keep = this.cur;
    for (const e of this.enemies) {
      if (e.dead) {
        e.deadT += dt;
        continue;
      }
      // its target: the closest player standing (the current one, for its moves and its hits)
      this.cur = this.nearestPlayer(e.x, e.y);
      const px = this.x, py = this.y;
      e.t += dt;
      e.hitT = Math.max(0, e.hitT - dt);
      e.slowT = Math.max(0, e.slowT - dt);
      e.sleepT = Math.max(0, e.sleepT - dt);
      e.touchT = Math.max(0, e.touchT - dt);
      e.wetT = Math.max(0, e.wetT - dt);
      e.burnT = Math.max(0, e.burnT - dt);
      e.poisonT = Math.max(0, e.poisonT - dt);
      e.charmT = Math.max(0, e.charmT - dt);
      if (e.burnT <= 0) e.burnDps = 0;
      if (e.poisonT <= 0) e.poisonDps = 0;
      e.dotT -= dt;
      if (e.dotT <= 0) {
        e.dotT = 0.5;
        const dot = (e.burnDps + e.poisonDps) * 0.5;
        if (dot > 0) {
          const d = Math.max(1, Math.round(dot));
          e.hp -= d;
          if (this.nums.length > 50) this.nums.shift();
          this.nums.push({ x: e.x + rand(-4, 4), y: e.y - 12, t: 0.2, text: String(d), color: e.poisonDps ? "poison" : "fire", big: false });
          if (e.hp <= 0) {
            this.kill(e);
            continue;
          }
        }
      }
      if (e.wetT > 0 && Math.random() < 0.04) this.part(e.x + rand(-5, 5), e.y - 12, 0, 20, "water2", 0.5, 1, 60, "dot");
      if (e.burnT > 0 && Math.random() < 0.1) this.part(e.x + rand(-5, 5), e.y - 10, 0, -25, "fire2", 0.4, 1, -20, "dot");
      if (e.poisonT > 0 && Math.random() < 0.06) this.part(e.x + rand(-5, 5), e.y - 14, 0, -14, "poison2", 0.6, 1, 0, "puff");
      const dx = px - e.x, dy = py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      let sp = e.speed * (e.slowT > 0 ? 0.5 : 1);
      let vx = ux, vy = uy;
      e.stateT -= dt;
      if (e.boss) {
        this.bossAct(e, dt, ux, uy);
        sp = 0;
      } else
        switch (e.w!.act) {
          case "erratic": {
            const s = Math.sin(e.t * 4 + e.seed) * 0.9;
            vx = ux - uy * s;
            vy = uy + ux * s;
            break;
          }
          case "charge":
            if (e.state === "wind") {
              sp = 0;
              if (e.stateT <= 0) {
                e.state = "dash";
                e.stateT = 0.55;
              }
            } else if (e.state === "dash") {
              sp = 170;
              vx = e.aim.x;
              vy = e.aim.y;
              if (Math.random() < 0.3) this.part(e.x, e.y, -vx * 20, -5, "pebble", 0.4, 2, 0, "puff");
              if (e.stateT <= 0) {
                e.state = "rest";
                e.stateT = 2.4;
              }
            } else if (d < 110 && e.stateT <= 0) {
              e.state = "wind";
              e.stateT = 0.6;
              e.aim = { x: ux, y: uy };
            }
            break;
          case "shoot":
            if (d < 70) {
              vx = -ux;
              vy = -uy;
            } else if (d < 100) {
              vx = -uy;
              vy = ux;
              sp *= 0.6;
            }
            if (e.stateT <= 0 && d < 180) {
              e.stateT = rand(2.3, 3);
              this.foeShot(e.x, e.y - 8, ux, uy, 75, e.dmg * 0.8, e.w!.shot ?? "ghost");
            }
            break;
          case "explode":
            if (e.state === "fuse") {
              sp = 0;
              if (e.stateT <= 0) {
                e.dead = true;
                e.deadT = 0;
                this.explode(e, true);
                continue;
              }
            } else if (d < 20) {
              e.state = "fuse";
              e.stateT = 0.7;
            }
            break;
          case "ghost": {
            const cyc = (e.t + e.seed) % 4.5;
            e.alpha = cyc < 3 ? 1 : 0.3;
            break;
          }
          case "treasure":
            // it waddles about, and runs off (slower than any starter) only when you come close; gone after 20 s
            if (d > 95) {
              const a = e.seed + e.t * 0.7;
              vx = Math.cos(a);
              vy = Math.sin(a);
              sp *= 0.35;
            } else {
              vx = -ux;
              vy = -uy;
            }
            if (e.t > 20) {
              e.dead = true;
              e.deadT = 0;
              for (let i = 0; i < 6; i++) this.part(e.x, e.y - 6, rand(-25, 25), rand(-30, 0), "white", 0.45, 3, -10, "puff");
              this.showBanner(this.tr("Leveinard s'est enfui…", "Chansey ran away…"), "");
              continue;
            }
            break;
          case "flop": {
            // Splash: a hop now and then, mostly in vain
            const hop = (e.t + e.seed) % 1.4 < 0.35;
            sp = hop ? 50 : 0;
            e.z = hop ? Math.sin((((e.t + e.seed) % 1.4) / 0.35) * Math.PI) * 6 : 0;
            break;
          }
        }
      if (e.charmT > 0 && !e.boss) {
        // charmed: off after the closest foe that isn't, and it hits it
        if (Math.random() < 0.05) this.part(e.x + rand(-4, 4), e.y - 18, 0, -14, "fairy", 0.8, 2, 0, "dot");
        const o = this.nearestFoe(e, 90);
        if (o) {
          const ox = o.x - e.x, oy = o.y - e.y, od = Math.hypot(ox, oy) || 1;
          vx = ox / od;
          vy = oy / od;
          sp = e.speed;
          if (od < e.r + o.r + 2 && e.touchT <= 0) {
            e.touchT = 0.6;
            this.damage(o, e.dmg * 1.5, vx * 60, vy * 60, "normal", true);
          }
        } else sp = 0;
      }
      if (e.sleepT > 0) {
        sp = 0;
        if (Math.random() < 0.02) this.part(e.x + 4, e.y - 18, 6, -12, "uiDim", 1, 1, 0, "dot");
      }
      const vl = Math.hypot(vx, vy) || 1;
      e.x += (vx / vl) * sp * dt + e.kx * dt;
      e.y += (vy / vl) * sp * dt + e.ky * dt;
      e.kx *= 0.86;
      e.ky *= 0.86;
      if (sp > 0) e.dir = dirOf(vx, vy);
      // touching the player
      if (e.alpha >= 0.5 && e.z < 4 && e.sleepT <= 0 && (e.charmT <= 0 || e.boss) && e.w?.act !== "treasure" && d < e.r + PLAYER_R) {
        this.hurt(e.dmg, e);
        if (e.w?.act === "explode" && e.state !== "fuse") {
          e.state = "fuse";
          e.stateT = 0.4;
        }
      }
      // too far behind: brought back in front
      if (d > VIEW_R + 160 && !e.boss && e.w?.act !== "treasure") {
        const a = Math.random() * Math.PI * 2;
        e.x = px + Math.cos(a) * (VIEW_R + 20);
        e.y = py + Math.sin(a) * (VIEW_R + 20);
      }
    }
    this.cur = keep;
    // keep them from piling on one spot
    for (const e of this.enemies) {
      if (e.dead) continue;
      for (const o of this.around(e.x, e.y, 16)) {
        if (o === e) continue;
        const dx = e.x - o.x, dy = e.y - o.y;
        const dd = dx * dx + dy * dy;
        const min = (e.r + o.r) * 0.8;
        if (dd > 0.01 && dd < min * min) {
          const dl = Math.sqrt(dd);
          const push = ((min - dl) / dl) * 0.25;
          const wE = e.boss ? 0.1 : 1, wO = o.boss ? 0.1 : 1;
          e.x += dx * push * wE;
          e.y += dy * push * wE;
          o.x -= dx * push * wO;
          o.y -= dy * push * wO;
        }
      }
    }
    // the fainted fade out
    this.enemies = this.enemies.filter((e) => !e.dead || e.deadT < (e.boss ? 1.4 : 0.35));
  }

  private bossAct(e: Enemy, dt: number, ux: number, uy: number) {
    const b = e.boss!;
    e.actT -= dt;
    if (b.giga && this.gigaAct(e, dt)) return;
    const base = () => {
      e.x += ux * e.speed * dt;
      e.y += uy * e.speed * dt;
      e.dir = dirOf(ux, uy);
    };
    switch (e.state) {
      case "slam": {
        // up in the air, then down on where the player was
        const t = 1 - e.stateT / 1.1;
        e.z = Math.sin(Math.min(1, t) * Math.PI) * 40;
        e.x += (e.aim.x - e.x) * dt * 2.2;
        e.y += (e.aim.y - e.y) * dt * 2.2;
        if (e.stateT <= 0) {
          e.z = 0;
          e.state = "";
          this.fx.push({ kind: "ring", x: e.x, y: e.y, t: 0, life: 0.5, r: 70, elem: "ground", foe: true, dmg: e.dmg, hit: new Set() });
          this.shake = 8;
          gsfx.quake();
        }
        return;
      }
      case "wind":
        if (e.stateT <= 0) {
          e.state = "dash";
          e.stateT = 0.8;
        }
        return;
      case "dash":
        e.x += e.aim.x * 210 * dt;
        e.y += e.aim.y * 210 * dt;
        if (Math.random() < 0.5) this.part(e.x, e.y, -e.aim.x * 30, -6, "pebble", 0.5, 2, 0, "puff");
        if (e.stateT <= 0) e.state = "";
        return;
      case "fade":
        e.alpha = Math.max(0, e.stateT / 0.4);
        if (e.stateT <= 0) {
          const a = Math.random() * Math.PI * 2;
          e.x = this.x + Math.cos(a) * 70;
          e.y = this.y + Math.sin(a) * 60;
          e.state = "appear";
          e.stateT = 0.4;
        }
        return;
      case "appear":
        e.alpha = 1 - Math.max(0, e.stateT / 0.4);
        if (e.stateT <= 0) {
          e.alpha = 1;
          e.state = "";
          this.radial(e, 8, b.shot);
        }
        return;
      case "beam":
        if (e.stateT <= 0) {
          e.state = "";
          this.fx.push({ kind: "beam", x: e.x, y: e.y - 10, x2: e.x + e.aim.x * 320, y2: e.y - 10 + e.aim.y * 320, t: 0, life: 0.45, elem: b.shot, dmg: e.dmg });
          gsfx.wave();
        }
        return;
      case "volley":
        if (e.stateT <= 0) {
          e.stateT = 0.16;
          this.foeShot(e.x, e.y - 12, ux, uy, 110, e.dmg * 0.7, b.shot);
          if (--e.n <= 0) e.state = "";
        }
        return;
    }
    base();
    if (e.actT > 0) return;
    // a giga boss quickens with each phase
    e.actT = rand(2.6, 3.8) * (this.wave > 30 ? 0.75 : 1) * (b.giga ? [0.85, 0.7, 0.5][e.n] : 1);
    const move: BossMove = pick(b.moves);
    switch (move) {
      case "slam":
        e.state = "slam";
        e.stateT = 1.1;
        e.aim = { x: this.x, y: this.y };
        break;
      case "charge":
        e.state = "wind";
        e.stateT = 0.7;
        e.aim = { x: ux, y: uy };
        break;
      case "radial":
        this.radial(e, 12 + Math.floor(this.wave / 10) * 2, b.shot);
        break;
      case "aimed":
        e.state = "volley";
        e.stateT = 0;
        e.n = 3 + Math.floor(this.wave / 15);
        break;
      case "teleport":
        e.state = "fade";
        e.stateT = 0.4;
        break;
      case "beam":
        e.state = "beam";
        e.stateT = 0.8;
        e.aim = { x: ux, y: uy };
        this.fx.push({ kind: "warn", x: e.x, y: e.y - 10, x2: e.x + ux * 320, y2: e.y - 10 + uy * 320, t: 0, life: 0.8 });
        break;
      case "rain": {
        // strikes falling all around the player, one after the other
        const n = 7 + 4 * e.n;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = i === 0 ? 0 : rand(14, 70);
          this.fx.push({ kind: "slashwarn", x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r, t: -i * 0.12, life: 1, r: 16, dmg: e.dmg, elem: b.shot });
        }
        break;
      }
      case "spiral":
        e.state = "spiral";
        e.stateT = 2.4;
        e.aim = { x: Math.random() * Math.PI * 2, y: 0 };
        break;
      case "fan": {
        // a star of beams, shown first, then fired
        const n = 3 + 2 * e.n;
        const base = Math.atan2(uy, ux);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * (Math.PI * 2 / n);
          const x2 = e.x + Math.cos(a) * 340, y2 = e.y - 10 + Math.sin(a) * 340;
          this.fx.push({ kind: "warn", x: e.x, y: e.y - 10, x2, y2, t: 0, life: 0.9 });
          this.fx.push({ kind: "beam", x: e.x, y: e.y - 10, x2, y2, t: -0.9, life: 0.45, elem: b.shot, dmg: e.dmg });
        }
        gsfx.wave();
        break;
      }
      case "strikes":
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = i === 0 ? 0 : rand(16, 50);
          this.fx.push({ kind: "slashwarn", x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r, t: 0, life: 0.9, r: 14, dmg: e.dmg, elem: b.shot });
        }
        break;
    }
  }

  /**
   * A giga boss (the daily challenge's wave 10): three phases. At two thirds and one third of its HP it roars: untouchable
   * for a moment, guards called, a shockwave; then it hits harder and faster (e.n, the phase). Its spiral of shots is its
   * own; true when it acted (bossAct does the rest).
   */
  private gigaAct(e: Enemy, dt: number) {
    const b = e.boss!;
    const k = e.hp / e.max;
    const phase = k > 0.66 ? 0 : k > 0.33 ? 1 : 2;
    if (phase > e.n && e.state !== "roar") {
      e.n = phase;
      e.state = "roar";
      e.stateT = 2.2;
      e.z = 0;
      e.alpha = 1;
      const d = this.setup.defi?.d;
      const pool = d ? [...d.mid, ...d.late] : this.wildPool;
      for (let i = 0; i < 4 + 3 * phase; i++) {
        const a = (i / (4 + 3 * phase)) * Math.PI * 2;
        const g = this.makeEnemy(pick(pool), e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 50);
        g.elite = true;
        g.hp *= 3;
        g.max = g.hp;
        this.enemies.push(g);
      }
      this.showBanner(this.tr("IL RUGIT !", "IT ROARS!"), this.tr("ses gardes d'abord", "its guards first"));
      this.shake = 10;
      gsfx.boss();
      return true;
    }
    if (e.state === "roar") {
      if (Math.random() < 0.6) this.part(e.x + rand(-20, 20), e.y - rand(0, 40), rand(-40, 40), -rand(20, 60), TYPE_FX[b.shot][0], 0.6, 3, 0, "puff");
      if (e.stateT <= 0) {
        e.state = "";
        e.actT = 1.2;
        e.speed = b.speed * (1 + 0.2 * e.n);
        this.fx.push({ kind: "ring", x: e.x, y: e.y, t: 0, life: 0.7, r: 150, elem: b.shot, foe: true, dmg: e.dmg, hit: new Set() });
        this.shake = 8;
        gsfx.quake();
      }
      return true;
    }
    if (e.state === "spiral") {
      // arms of shots turning around it
      e.actT = Math.max(e.actT, 0.8);
      e.aim.y -= dt;
      if (e.aim.y <= 0) {
        e.aim.y = 0.09;
        const arms = 2 + e.n;
        e.aim.x += 0.32;
        for (let i = 0; i < arms; i++) {
          const a = e.aim.x + (i / arms) * Math.PI * 2;
          this.foeShot(e.x, e.y - 14, Math.cos(a), Math.sin(a), 90, e.dmg * 0.6, b.shot);
        }
      }
      if (e.stateT <= 0) e.state = "";
      return true;
    }
    return false;
  }

  private radial(e: Enemy, n: number, elem: Elem) {
    const off = Math.random();
    for (let i = 0; i < n; i++) {
      const a = ((i + off) / n) * Math.PI * 2;
      this.foeShot(e.x, e.y - 10, Math.cos(a), Math.sin(a), 70, e.dmg * 0.7, elem);
    }
  }

  private foeShot(x: number, y: number, dx: number, dy: number, speed: number, dmg: number, elem: Elem) {
    this.foes.push({ kind: "foe", x, y, vx: dx * speed, vy: dy * speed, r: 3, dmg, pierce: 0, life: 4, elem, t: 0 });
    gsfx.enemyShot();
  }

  /* ---------------- shots ---------------- */

  private stepShots(dt: number) {
    for (const s of this.shots) {
      s.t += dt;
      s.life -= dt;
      if ((s.kind === "leaf" || s.kind === "swift" || s.kind === "aura" || s.kind === "gball" || s.kind === "psyorb" || s.kind === "fairy") && s.target) {
        if (s.target.dead) s.target = this.nearest(s.x, s.y, 120);
        if (s.target) {
          const dx = s.target.x - s.x, dy = s.target.y - 8 - s.y;
          const d = Math.hypot(dx, dy) || 1;
          const sp = Math.hypot(s.vx, s.vy);
          const turn = s.t < 0.15 ? 0.04 : 0.18;
          s.vx += ((dx / d) * sp - s.vx) * turn;
          s.vy += ((dy / d) * sp - s.vy) * turn;
        }
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.kind === "flame") {
        s.vx *= 0.97;
        s.vy *= 0.97;
      }
      if (s.kind === "bubble" || s.kind === "scald") {
        // they slow down and wobble
        s.vx *= 0.985;
        s.vy *= 0.985;
        s.x += Math.sin(s.t * 6 + s.r) * 0.3;
      }
      if (s.kind === "bone") {
        // out, then back to the closest player, hitting again on the way
        if (!s.back && s.t > 0.5) {
          s.back = true;
          s.hit!.clear();
        }
        if (s.back) {
          const p = this.nearestPlayer(s.x, s.y);
          const dx = p.x - s.x, dy = p.y - 8 - s.y, d = Math.hypot(dx, dy) || 1;
          s.vx = (dx / d) * 200;
          s.vy = (dy / d) * 200;
          if (d < 10) s.life = 0;
        }
      }
      if ((s.kind === "psycut" || s.kind === "psyorb") && Math.random() < 0.4) this.part(s.x, s.y, 0, 0, "psy2", 0.25, 1, 0, "spark");
      if (s.kind === "ice" && Math.random() < 0.3) this.part(s.x, s.y, 0, 0, "ice2", 0.25, 1, 0, "spark");
      if (s.kind === "aura" && Math.random() < 0.5) this.part(s.x + rand(-3, 3), s.y + rand(-3, 3), 0, -6, "fight2", 0.3, 1, 0, "spark");
      if (s.kind === "sludge" && Math.random() < 0.3) this.part(s.x, s.y, 0, 10, "poison", 0.3, 1, 60, "dot");
      if (s.kind === "ember" && Math.random() < 0.5) this.part(s.x, s.y, rand(-8, 8), rand(-14, 0), "fire2", 0.25, 1, 0, "dot");
      if ((s.kind === "shadow" || s.kind === "gball") && Math.random() < 0.6) this.part(s.x + rand(-s.r, s.r), s.y + rand(-s.r, s.r), 0, -8, "ghost2", 0.4, 1, 0, "dot");
      if (s.kind === "swift" && Math.random() < 0.4) this.part(s.x, s.y, 0, 0, "gold", 0.3, 1, 0, "spark");
      if (s.kind === "fairy" && Math.random() < 0.5) this.part(s.x + rand(-2, 2), s.y + rand(-2, 2), 0, -4, "fairy2", 0.35, 1, 0, "spark");
      if (s.kind === "dragon" && Math.random() < 0.6) this.part(s.x + rand(-3, 3), s.y + rand(-3, 3), -s.vx * 0.1, -s.vy * 0.1, "dragon2", 0.3, 1, 0, "dot");
      for (const e of this.around(s.x, s.y + 8, s.r + 12)) {
        if (s.life <= 0) break;
        if (s.hit!.has(e) || e.alpha < 0.5) continue;
        if (dist2(s.x, s.y + 8, e.x, e.y) > (s.r + e.r) ** 2) continue;
        s.hit!.add(e);
        const sp = Math.hypot(s.vx, s.vy) || 1;
        const kb = s.kind === "water" ? 90 : s.kind === "shadow" ? 20 : s.kind === "bone" || s.kind === "rock" ? 60 : 30;
        this.damage(e, s.dmg, (s.vx / sp) * kb, (s.vy / sp) * kb, s.elem, s.kind === "flame");
        // Scald: soaked and burnt at once
        if (s.kind === "scald") {
          e.burnT = 3;
          e.burnDps = Math.max(e.burnDps, s.dmg * 0.15 * (1 + 0.3 * this.itemLevel("spoon")));
        }
        if (s.kind === "aura") {
          this.fx.push({ kind: "boom", x: s.x, y: s.y, t: 0, life: 0.3, r: 22 * this.area, elem: "fight" });
          for (const o of this.around(s.x, s.y + 8, 22 * this.area)) if (o !== e) this.damage(o, s.dmg * 0.5, 0, 0, "fight", true);
        }
        if (s.kind === "ember") {
          // the fireball bursts
          this.fx.push({ kind: "boom", x: s.x, y: s.y, t: 0, life: 0.25, r: 14 * this.area, elem: "fire" });
          for (const o of this.around(s.x, s.y + 8, 16 * this.area)) if (o !== e) this.damage(o, s.dmg * 0.5, 0, 0, "fire", true);
        }
        if (s.kind === "rock") {
          // the stone shatters: its shards hit what's around
          this.fx.push({ kind: "boom", x: s.x, y: s.y, t: 0, life: 0.25, r: 18 * this.area, elem: "ground" });
          for (const o of this.around(s.x, s.y + 8, 20 * this.area)) if (o !== e) this.damage(o, s.dmg * 0.5, 0, 0, "ground", true);
          for (let i = 0; i < 4; i++) this.part(s.x, s.y, rand(-50, 50), rand(-60, -10), "ground2", 0.35, 1, 160, "dot");
        }
        if (s.kind === "water") for (let i = 0; i < 3; i++) this.part(s.x, s.y, rand(-40, 40), rand(-50, 0), "water2", 0.3, 1, 140, "dot");
        if (s.pierce-- <= 0) s.life = 0;
      }
      if (s.kind === "blast" && s.life <= 0) this.blastStar(s);
      if (s.kind === "sludge" && s.life <= 0 && s.pool) {
        this.fx.push({ kind: "boom", x: s.x, y: s.y + 6, t: 0, life: 0.25, r: s.pool.r * 0.6, elem: "poison" });
        this.fx.push({ kind: "zone", x: s.x, y: s.y + 8, t: 0, life: 3, r: s.pool.r, dmg: s.pool.dps, tick: 0, elem: "poison" });
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
    // what circles each player
    this.eachAlive(() => this.stepOrbits());
  }

  private stepOrbits() {
    for (const o of this.orbits())
      for (let i = 0; i < o.n; i++) {
        const a = this.time * o.speed + (i / o.n) * Math.PI * 2;
        const cx = this.x + Math.cos(a) * o.R, cy = this.y - 6 + Math.sin(a) * o.R * 0.8;
        for (const e of this.around(cx, cy + 6, 10)) {
          if (e.touchT > 0 || dist2(cx, cy + 6, e.x, e.y) > (6 + e.r) ** 2) continue;
          e.touchT = 0.35;
          if (o.kind === "ice") e.slowT = 1.5;
          if (o.freeze && !e.boss) e.sleepT = Math.max(e.sleepT, 0.9);
          this.damage(e, o.dmg, Math.cos(a) * 40, Math.sin(a) * 40, o.kind === "ice" ? "ice" : "grass", o.kind === "petal");
        }
      }
  }

  /** Fire Blast: the fireball bursts, and five jets of fire shoot out in a star */
  private blastStar(s: Shot) {
    const R = 46 * this.area;
    this.fx.push({ kind: "boom", x: s.x, y: s.y, t: 0, life: 0.4, r: R, elem: "fire" });
    for (const e of this.around(s.x, s.y + 8, R)) this.damage(e, s.dmg, (e.x - s.x) * 2, (e.y - s.y) * 2, "fire", true);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      for (let k = 0; k < 3; k++) this.shoot("flame", s.x, s.y, Math.cos(a), Math.sin(a), 110 + k * 25, 5, s.dmg * 0.25, 999, 0.6, "fire");
    }
    this.shake = Math.max(this.shake, 5);
    gsfx.boom();
  }

  private stepFoes(dt: number) {
    for (const s of this.foes) {
      s.t += dt;
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      this.eachAlive((p) => {
        if (s.life > 0 && dist2(s.x, s.y + 8, p.x, p.y) < (s.r + PLAYER_R - 1) ** 2) {
          this.hurt(s.dmg);
          s.life = 0;
        }
      });
    }
    this.foes = this.foes.filter((s) => s.life > 0 && this.players.some((p) => dist2(s.x, s.y, p.x, p.y) < (VIEW_R + 60) ** 2));
  }

  private stepFx(dt: number) {
    for (const f of this.fx) {
      f.t += dt;
      if (f.t < 0) continue;
      if (f.kind === "ring" && f.hit) {
        // a shockwave hits what its front passes
        const r = (f.t / f.life) * f.r!;
        if (f.foe)
          this.eachAlive((p) => {
            // one hit per player (a bit per player in done)
            const bit = 1 << p.id;
            if (!((f.done ?? 0) & bit) && Math.abs(Math.hypot(p.x - f.x, p.y - f.y) - r) < 8) {
              f.done = (f.done ?? 0) | bit;
              this.hurt(f.dmg!);
            }
          });
        else
          for (const e of this.around(f.x, f.y, r + 10)) {
            if (f.hit.has(e)) continue;
            const d = Math.hypot(e.x - f.x, e.y - f.y) || 1;
            if (d > r + e.r) continue;
            f.hit.add(e);
            this.damage(e, f.dmg!, ((e.x - f.x) / d) * 150, ((e.y - f.y) / d) * 150, f.elem ?? "water", f.heal != null);
            // Hydro Pump: each foe it hits gives back a little
            if (f.heal != null && f.heal < 25) {
              f.heal++;
              this.hp = Math.min(this.maxHp, this.hp + 1);
            }
          }
      }
      if (f.kind === "cloud") {
        f.tick! -= dt;
        if (f.tick! <= 0) {
          f.tick = 0.5;
          for (const e of this.around(f.x, f.y, f.r!)) {
            if (!e.boss) e.sleepT = Math.max(e.sleepT, 1.4);
            this.damage(e, f.dmg!, 0, 0, "grass", true);
          }
        }
        if (Math.random() < 0.3) this.part(f.x + rand(-f.r!, f.r!), f.y + rand(-f.r! / 2, f.r! / 2), 0, -8, "psy2", 0.8, 2, 0, "puff");
      }
      if (f.kind === "hbeam" && !f.done && f.t > (f.charge ?? 0.22)) {
        f.done = 1;
        this.shake = Math.max(this.shake, 4);
        gsfx.boom();
        // the beam leaves from where its caster is now
        const dx = f.x2! - f.x, dy = f.y2! - f.y;
        const owner = f.owner ?? this.cur;
        f.x = owner.x;
        f.y = owner.y - 8;
        f.x2 = f.x + dx;
        f.y2 = f.y + dy;
        for (const e of this.enemies)
          if (!e.dead && segDist(e.x, e.y - 8, f.x, f.y, f.x2, f.y2) < f.r! / 2 + e.r) {
            this.damage(e, f.dmg!, 0, 0, f.elem ?? "normal", true);
            // Ice Beam freezes
            if (f.elem === "ice") {
              if (!e.boss) e.sleepT = Math.max(e.sleepT, 1.3);
              e.slowT = Math.max(e.slowT, 2);
            }
          }
      }
      if (f.kind === "tornado") {
        f.vx! += Math.sin(f.t * 2.3) * 30 * dt;
        f.vy! += Math.cos(f.t * 1.7) * 30 * dt;
        f.x += f.vx! * dt;
        f.y += f.vy! * dt;
        for (const e of this.around(f.x, f.y, f.r! * 1.4)) {
          if (e.boss) continue;
          e.kx += (f.x - e.x) * 2.2 * dt * 60;
          e.ky += (f.y - e.y) * 2.2 * dt * 60;
        }
        f.tick! -= dt;
        if (f.tick! <= 0) {
          f.tick = 0.3;
          for (const e of this.around(f.x, f.y, f.r!)) this.damage(e, f.dmg!, 0, 0, "fly", true);
        }
        if (Math.random() < 0.5) this.part(f.x + rand(-f.r!, f.r!) * 0.6, f.y - rand(0, 30), rand(-30, 30), -rand(10, 40), "pebble", 0.5, 1, 0, "dot");
      }
      if (f.kind === "zone") {
        // Fire Spin follows its caster; a toxic puddle stays
        if (f.owner) {
          f.x = f.owner.x;
          f.y = f.owner.y;
        }
        f.tick! -= dt;
        if (f.tick! <= 0) {
          f.tick = f.elem === "fire" ? 0.35 : 0.5;
          const keep = this.cur;
          if (f.owner) this.cur = f.owner;
          for (const e of this.around(f.x, f.y, f.r!)) {
            if (dist2(e.x, e.y, f.x, f.y) > (f.r! + e.r) ** 2) continue;
            if (f.elem === "poison") this.poisonFoe(e, f.dmg!, 3);
            this.damage(e, f.dmg!, 0, 0, f.elem ?? "fire", true);
          }
          if (f.heal && f.owner && !f.owner.down) f.owner.hp = Math.min(f.owner.maxHp, f.owner.hp + f.heal);
          this.cur = keep;
        }
        if (f.elem === "fire" && Math.random() < 0.6) {
          const a = Math.random() * Math.PI * 2;
          this.part(f.x + Math.cos(a) * f.r!, f.y + Math.sin(a) * f.r! * 0.6, 0, -rand(20, 40), Math.random() < 0.5 ? "fire" : "fire2", 0.4, 2, 0, "puff");
        }
      }
      if (f.kind === "mark") {
        if (f.target && !f.target.dead) {
          f.x = f.target.x;
          f.y = f.target.y;
        }
        if (!f.done && f.t >= f.life) {
          f.done = 1;
          const keep = this.cur;
          if (f.owner) this.cur = f.owner;
          this.fx.push({ kind: "boom", x: f.x, y: f.y - 6, t: 0, life: 0.35, r: f.r, elem: "psy" });
          for (const e of this.around(f.x, f.y, f.r!)) this.damage(e, f.dmg!, (e.x - f.x) * 3, (e.y - f.y) * 3, "psy", true);
          this.cur = keep;
          this.shake = Math.max(this.shake, 3);
          gsfx.boom();
        }
      }
      if (f.kind === "meteor" && !f.done && f.t >= f.life) {
        f.done = 1;
        this.fx.push({ kind: "boom", x: f.x, y: f.y, t: 0, life: 0.35, r: f.r, elem: f.elem ?? "dragon" });
        for (const e of this.around(f.x, f.y, f.r!)) this.damage(e, f.dmg!, (e.x - f.x) * 3, (e.y - f.y) * 3, f.elem ?? "dragon", true);
        this.shake = Math.max(this.shake, 3);
        gsfx.boom();
      }
      if (f.kind === "beam" && !f.done && f.t > 0.05) {
        f.done = 1;
        this.eachAlive((p) => {
          if (segDist(p.x, p.y - 8, f.x, f.y, f.x2!, f.y2!) < 9) this.hurt(f.dmg!);
        });
      }
      if (f.kind === "slashwarn" && f.t >= f.life && !f.done) {
        f.done = 1;
        this.fx.push({ kind: "strike", x: f.x, y: f.y, t: 0, life: 0.3, pts: jag([[f.x + rand(-20, 20), f.y - 200], [f.x, f.y]], 10), elem: f.elem, foe: true });
        this.eachAlive((p) => {
          if (dist2(p.x, p.y, f.x, f.y) < (f.r! + PLAYER_R) ** 2) this.hurt(f.dmg!);
        });
        gsfx.thunder();
      }
    }
    this.fx = this.fx.filter((f) => f.t < f.life || (f.kind === "meteor" && !f.done));
  }

  private stepPickups(dt: number) {
    const keep = this.cur;
    for (const p of this.pickups) {
      this.cur = this.nearestPlayer(p.x, p.y);
      const mag = this.magnet;
      p.t += dt;
      if (p.z > 0 || p.vz) {
        p.vz -= 260 * dt;
        p.z += p.vz * dt;
        if (p.z <= 0) {
          p.z = 0;
          p.vz = 0;
        }
      }
      const dx = this.x - p.x, dy = this.y - 4 - p.y;
      const d = Math.hypot(dx, dy);
      // in reach, or lying on screen for a while: it comes
      if (!p.pull && (d < mag || (p.t > 10 && d < SH * 0.6))) p.pull = true;
      if (p.pull) {
        const sp = 60 + p.t * 30 + (mag - Math.min(d, mag)) * 4;
        p.x += (dx / (d || 1)) * Math.min(d, sp * dt * 2.2);
        p.y += (dy / (d || 1)) * Math.min(d, sp * dt * 2.2);
      }
      if (d < 7) {
        p.t = -1;
        this.collect(p);
      }
    }
    // a level-up opened the cards: the player who took the candy stays the current one
    if (this.phase === "play") this.cur = keep;
    this.pickups = this.pickups.filter((p) => p.t >= 0);
  }

  private collect(p: Pickup) {
    if (p.kind === "coin") {
      this.gold += Math.max(1, Math.round(p.value * this.goldMul));
      gsfx.coin();
    } else if (p.kind === "candy") {
      gsfx.candy();
      this.gainXp(p.value);
    } else if (p.kind === "oran" || p.kind === "egg") {
      this.hp = Math.min(this.maxHp, this.hp + (p.kind === "egg" ? this.maxHp * 0.5 : 25));
      gsfx.heal();
      for (let i = 0; i < 8; i++) this.part(this.x + rand(-8, 8), this.y - rand(0, 16), 0, -30, "heal", 0.7, 1, 0, "spark");
    } else if (p.kind === "rare") {
      unlock("game-rarecandy");
      gsfx.rare();
      this.gainXp(xpFor(this.level) - this.xp);
    } else if (p.kind === "magnet") {
      gsfx.rare();
      for (const q of this.pickups) if (q.kind === "candy") q.pull = true;
    }
  }

  private gainXp(v: number) {
    this.xp += v * this.xpMul;
    while (this.xp >= xpFor(this.level)) {
      this.xp -= xpFor(this.level);
      this.level++;
      this.pendingLevels++;
      this.maxHp = this.computeMaxHp();
      this.fx.push({ kind: "levelup", x: this.x, y: this.y, t: 0, life: 0.9, owner: this.cur });
      for (let i = 0; i < 16; i++) this.part(this.x + rand(-10, 10), this.y, 0, -rand(30, 80), "gold", 0.8, 1, 0, "spark");
    }
    if (this.pendingLevels > 0 && this.phase === "play" && !this.inBreak) {
      gsfx.levelUp();
      this.offerChoices();
    }
  }

  private drop(kind: Pickup["kind"], x: number, y: number, value: number) {
    // too many candies on the ground: they melt into the closest one
    if (kind === "candy" && this.pickups.length > 260) {
      let best: Pickup | null = null;
      let bd = Infinity;
      for (const p of this.pickups) {
        const d = dist2(p.x, p.y, x, y);
        if (p.kind === "candy" && d < bd) {
          bd = d;
          best = p;
        }
      }
      if (best) {
        best.value += value;
        return;
      }
    }
    this.pickups.push({ kind, x, y, z: 0.1, vz: rand(50, 80), value, pull: false, t: 0 });
  }

  /* ---------------- particles ---------------- */

  private part(x: number, y: number, vx: number, vy: number, color: ColorKey, life: number, size: number, grav: number, kind: Part["kind"]) {
    if (this.parts.length > 500) return;
    this.parts.push({ x, y, vx, vy, life, max: life, color, size, grav, kind });
  }

  private stepParts(dt: number) {
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "leaf" || p.kind === "petal") p.vx += Math.sin(p.life * 5) * 10 * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const n of this.nums) n.t += dt;
    this.nums = this.nums.filter((n) => n.t < 0.7);
    if (this.phase === "play" && Math.random() < 0.25) this.ambient(false);
  }

  /** the field of the wave: a new one every 10 waves (the daily challenge and the menus stay in the meadow) */
  get biome() {
    if (this.setup.defi || this.setup.daily || this.phase === "title" || this.phase === "select") return BIOMES[0];
    return BIOMES[Math.floor((this.wave - 1) / BIOME_WAVES) % BIOMES.length];
  }
  /** a move's strength in the wave's weather */
  private weatherMul(elem: Elem) {
    return this.weather ? (WEATHERS[this.weather].mul[elem] ?? 1) : 1;
  }
  /** the wave's weather, drawn from its biome's chances */
  private rollWeather() {
    this.weather = null;
    if (this.setup.defi || this.setup.daily || this.wave < 3) return;
    let r = Math.random();
    for (const [id, p] of Object.entries(this.biome.weather) as [WeatherId, number][]) {
      if ((r -= p) < 0) return void (this.weather = id);
    }
  }

  /** the time of day changes with the waves: day, dusk, night (fireflies), dawn */
  get timeOfDay() {
    const c = ((this.wave - 1) % 8) + Math.min(1, Math.max(0, (this.time - waveStart(this.wave)) / waveLength(this.wave)));
    return c;
  }
  private get night() {
    const t = this.phase === "play" || this.phase === "levelup" || this.phase === "paused" ? this.timeOfDay : 0;
    if (t < 3) return 0;
    if (t < 4) return t - 3;
    if (t < 6) return 1;
    if (t < 7) return 7 - t;
    return 0;
  }

  private ambient(menu: boolean) {
    const cx = menu ? SW / 2 : this.cam.x, cy = menu ? SH / 2 : this.cam.y;
    const n = this.night;
    // the weather's own: light and see-through, never over what matters
    const w = menu ? null : this.weather;
    if (w === "rain" && Math.random() < 0.9) this.part(cx + rand(-SW / 2, SW / 2) + 30, cy - SH / 2 - 4, -40, 260, "water2", 1.1, 1, 0, "rain");
    if (w === "hail" && Math.random() < 0.45) this.part(cx + rand(-SW / 2, SW / 2) + 20, cy - SH / 2 - 4, -24, 150, "ice2", 2, 1, 0, "hail");
    if (w === "sand" && Math.random() < 0.7) this.part(cx - SW / 2 - 4, cy + rand(-SH / 2, SH / 2), rand(200, 260), rand(10, 30), "ground2", 1.6, 1, 0, "sand");
    if (n > 0.6) {
      if (Math.random() < 0.1) this.part(cx + rand(-SW / 2, SW / 2), cy + rand(-SH / 2, SH / 2), rand(-6, 6), rand(-6, 6), "elec", 3, 1, 0, "firefly");
    } else if (!w && this.biome.id === "meadow" && Math.random() < 0.12) this.part(cx + rand(-SW / 2, SW / 2), cy - SH / 2 - 4, rand(-12, 4), rand(10, 18), Math.random() < 0.5 ? "flowerA" : "grassFx", 9, 1, 0, Math.random() < 0.5 ? "petal" : "leaf");
  }

  /* ---------------- spatial grid ---------------- */

  private buildGrid() {
    this.grid.clear();
    for (const e of this.enemies) {
      if (e.dead) continue;
      const k = (Math.floor(e.x / 32) + 4096) * 8192 + Math.floor(e.y / 32) + 4096;
      const cell = this.grid.get(k);
      if (cell) cell.push(e);
      else this.grid.set(k, [e]);
    }
  }

  /** living foes whose cell is within r of a point (a rough cut; callers check the distance) */
  private around(x: number, y: number, r: number): Enemy[] {
    const out: Enemy[] = [];
    const x0 = Math.floor((x - r) / 32), x1 = Math.floor((x + r) / 32);
    const y0 = Math.floor((y - r) / 32), y1 = Math.floor((y + r) / 32);
    for (let gx = x0; gx <= x1; gx++)
      for (let gy = y0; gy <= y1; gy++) {
        const cell = this.grid.get((gx + 4096) * 8192 + gy + 4096);
        if (cell) for (const e of cell) if (!e.dead && dist2(e.x, e.y, x, y) <= (r + e.r) ** 2) out.push(e);
      }
    return out;
  }

  private nearest(x: number, y: number, r: number) {
    let best: Enemy | null = null;
    let bd = r * r;
    for (const e of this.enemies) {
      if (e.dead || e.alpha < 0.5 || e.w?.act === "flop") continue;
      const d = dist2(e.x, e.y, x, y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private nearestN(x: number, y: number, n: number, r: number) {
    return this.enemies
      .filter((e) => !e.dead && e.alpha >= 0.5 && dist2(e.x, e.y, x, y) < r * r)
      .sort((a, b) => dist2(a.x, a.y, x, y) - dist2(b.x, b.y, x, y))
      .slice(0, n);
  }

  /* ---------------- drawing ---------------- */

  /** a player's screen: their camera, their HUD (in coop, one screen each) */
  draw(ctx: CanvasRenderingContext2D, viewer = 0) {
    const keep = this.cur;
    this.cur = this.players[viewer] ?? this.players[0];
    this.drawView(ctx);
    this.cur = keep;
  }

  /** draws pl's things (their aura, orbits, stones, body) as them */
  private as(pl: Player, fn: () => void) {
    const keep = this.cur;
    this.cur = pl;
    fn();
    this.cur = keep;
  }

  private drawView(ctx: CanvasRenderingContext2D) {
    const g = this.gfx;
    ctx.imageSmoothingEnabled = false;
    if (this.phase === "title" || this.phase === "select") return this.drawMenu(ctx);
    const shake = this.shake > 0 ? { x: rand(-1, 1) * this.shake, y: rand(-1, 1) * this.shake } : { x: 0, y: 0 };
    const ox = Math.round(SW / 2 - this.cam.x + shake.x), oy = Math.round(SH / 2 - this.cam.y + shake.y);
    this.drawGround(ctx, ox, oy);

    // shadows, then the candies, then everyone sorted by depth
    ctx.fillStyle = g.c.shadow;
    ctx.globalAlpha = 0.28;
    for (const e of this.enemies) if (!e.dead || e.deadT < 0.2) ellipse(ctx, e.x + ox, e.y + oy, e.r * (e.boss ? 1.1 : 1.05) * (1 - e.z / 90), e.r * 0.45);
    for (const p of this.players) ellipse(ctx, p.x + ox, p.y + oy, 7, 3);
    ctx.globalAlpha = 1;
    this.drawPickups(ctx, ox, oy);
    for (const p of this.players) this.as(p, () => this.drawGroundOf(ctx, ox, oy));
    for (const f of this.fx) if (f.kind === "slashwarn" || f.kind === "warn" || f.kind === "cloud" || f.kind === "meteor" || f.kind === "zone") this.drawFx(ctx, f, ox, oy);

    const bodies: { y: number; draw: () => void }[] = [];
    for (const e of this.enemies) bodies.push({ y: e.y, draw: () => this.drawEnemy(ctx, e, ox, oy) });
    for (const p of this.players) bodies.push({ y: p.y, draw: () => this.as(p, () => this.drawPlayer(ctx, ox, oy)) });
    this.drawBodies(ctx, bodies, ox, oy);
  }

  /** what a player has on the ground around them: their aura, their stones */
  private drawGroundOf(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
    const g = this.gfx;
    const psy = this.moves.find((m) => m.id === "psychic");
    if (psy) {
      const R = (24 + 5 * psy.level) * this.area;
      ctx.strokeStyle = g.c.psy;
      ctx.globalAlpha = 0.35 + Math.sin(this.time * 6) * 0.15;
      ring(ctx, this.x + ox, this.y + oy - 4, R + Math.sin(this.time * 3) * 1.5, 0.75);
      ctx.globalAlpha = 0.15;
      ring(ctx, this.x + ox, this.y + oy - 4, R * ((this.time * 0.8) % 1), 0.75);
      ctx.globalAlpha = 1;
    }
    for (const r of this.rocks) {
      const x = Math.round(r.x + ox), y = Math.round(r.y + oy);
      if (r.life < 1.5 && Math.floor(r.life * 8) % 2) continue;
      ctx.fillStyle = g.c.ink;
      ctx.fillRect(x - 4, y - 3, 8, 4);
      ctx.fillRect(x - 2 + (r.seed > 0.5 ? 1 : 0), y - 7, 3, 4);
      ctx.fillStyle = g.c.rock;
      ctx.fillRect(x - 3, y - 2, 6, 2);
      ctx.fillRect(x - 1 + (r.seed > 0.5 ? 1 : 0), y - 6, 1, 4);
      ctx.fillStyle = g.c.pebble;
      ctx.fillRect(x - 2, y - 2, 2, 1);
    }
  }

  private drawBodies(ctx: CanvasRenderingContext2D, bodies: { y: number; draw: () => void }[], ox: number, oy: number) {
    bodies.sort((a, b) => a.y - b.y);
    for (const b of bodies) b.draw();

    // shots
    for (const s of this.shots) this.drawShot(ctx, s, ox, oy);
    for (const s of this.foes) this.drawFoeShot(ctx, s, ox, oy);
    for (const p of this.players) this.as(p, () => this.drawOrbits(ctx, ox, oy));
    this.drawTop(ctx, ox, oy);
  }

  private drawOrbits(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
    const g = this.gfx;
    if (this.cur.down) return;
    for (const o of this.orbits())
      for (let i = 0; i < o.n; i++) {
        const a = this.time * o.speed + (i / o.n) * Math.PI * 2;
        const cx = Math.round(this.x + ox + Math.cos(a) * o.R), cy = Math.round(this.y + oy - 6 + Math.sin(a) * o.R * 0.8);
        if (o.kind === "ice") {
          diamond(ctx, cx, cy, o.freeze ? 5 : 4, g.c.ice, g.c.ice2);
          if (Math.random() < 0.3) this.part(cx - ox, cy - oy, 0, 0, "ice2", 0.3, 1, 0, "spark");
        } else {
          // a petal, turning
          const s = Math.floor(this.time * 10 + i) % 2;
          ctx.fillStyle = g.c.psy;
          ctx.fillRect(cx - 2, cy - 1 + s, 4, 2);
          ctx.fillRect(cx - 1, cy - 2, 2, 4);
          ctx.fillStyle = g.c.flowerA;
          ctx.fillRect(cx - 1, cy - 1, 1, 1);
          if (Math.random() < 0.15) this.part(cx - ox, cy - oy, rand(-10, 10), rand(-10, 10), "psy", 0.6, 1, 20, "petal");
        }
      }
  }

  private drawTop(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
    const g = this.gfx;
    for (const f of this.fx) if (!["slashwarn", "warn", "cloud", "meteor", "zone"].includes(f.kind)) this.drawFx(ctx, f, ox, oy);
    this.drawParts(ctx, ox, oy);

    // damage numbers
    for (const n of this.nums) {
      const k = n.t / 0.7;
      const y = n.y + oy - 10 * Math.sin(Math.min(1, k * 2) * Math.PI * 0.5) - k * 4;
      if (k > 0.8 && Math.floor(n.t * 30) % 2) continue;
      g.text(ctx, n.text, n.x + ox, y, n.color, { align: "center", scale: n.big && k < 0.2 ? 2 : 1 });
    }

    this.drawLight(ctx);
    if (this.flash > 0) {
      ctx.fillStyle = g.c.white;
      ctx.globalAlpha = this.flash * 0.5;
      ctx.fillRect(0, 0, SW, SH);
      ctx.globalAlpha = 1;
    }
    if (this.hurtFlash > 0 && !g.palette.shades) {
      ctx.fillStyle = g.c.hpLow;
      ctx.globalAlpha = this.hurtFlash * 0.18;
      ctx.fillRect(0, 0, SW, SH);
      ctx.globalAlpha = 1;
    }
    this.drawPointers(ctx, ox, oy);
    if (this.phase === "evolve" && this.evo) this.drawEvolution(ctx, ox, oy);
    else this.drawHud(ctx);
    if (this.phase === "countdown") {
      // 3, 2, 1, each one popping in
      const n = Math.ceil(this.countT);
      const k = 1 - (this.countT - Math.floor(this.countT));
      ctx.fillStyle = g.c.uiDark;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(0, 0, SW, SH);
      ctx.globalAlpha = 1;
      const sc = k < 0.15 ? 9 : 7;
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [2, 2]]) g.text(ctx, String(n), SW / 2 + dx, 40 + dy, "uiDark", { align: "center", scale: sc, outline: "uiDark" });
      g.text(ctx, String(n), SW / 2, 40, "gold", { align: "center", scale: sc, outline: "gold" });
      g.text(ctx, this.tr(`VAGUE ${this.wave}`, `WAVE ${this.wave}`), SW / 2, 100, "ui", { align: "center", scale: 2 });
    }
    if (this.cur.down && this.players.length > 1 && this.phase === "play") {
      // knocked out: waiting for the partner
      ctx.fillStyle = g.c.uiDark;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, 168, SW, 30);
      ctx.globalAlpha = 1;
      g.text(ctx, this.tr("K.O. !", "DOWN!"), SW / 2, 172, "hpLow", { align: "center", scale: 2 });
      g.text(ctx, this.tr("ton partenaire peut te relever", "your partner can get you up"), SW / 2, 188, "ui", { align: "center" });
    }
  }

  private drawGround(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
    const g = this.gfx;
    const tx0 = Math.floor(-ox / TILE), ty0 = Math.floor(-oy / TILE);
    const sway = Math.floor(this.animT * 2) % 2;
    const b = this.biome;
    const tiles = g.tilesFor(b.id, b.colors);
    for (let ty = ty0; ty <= ty0 + SH / TILE + 1; ty++)
      for (let tx = tx0; tx <= tx0 + SW / TILE + 1; tx++) {
        const h = hash(tx, ty);
        // patches of tall grass and flower meadows, a few tiles wide
        const patch = hash(tx >> 2, ty >> 2);
        let tile: number = h < 0.6 ? T.plain : h < 0.82 ? T.plain2 : h < 0.92 ? T.tuft : h < 0.96 ? T.clover : T.pebble;
        if (patch > 0.86 && h < 0.85) tile = T.tall + ((sway + tx) % 2);
        else if (patch < 0.12 && h < 0.5) tile = (h < 0.25 ? T.flowerA : T.flowerB) + ((sway + tx + ty) % 2);
        ctx.drawImage(tiles, tile * TILE, 0, TILE, TILE, tx * TILE + ox, ty * TILE + oy, TILE, TILE);
      }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
    const g = this.gfx;
    const look = this.dex;
    if (this.phase === "dying" || this.cur.down) {
      const a = anim(look, "Faint");
      g.sprite(ctx, look, "Faint", frameAt(a, this.cur.down ? 9 : this.dyingT, false), this.dir, this.x + ox, this.y + oy - 8);
      if (this.cur.down && this.cur.reviveT > 0) {
        ctx.strokeStyle = g.c.hp;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x + ox, this.y + oy - 10, 12, -Math.PI / 2, -Math.PI / 2 + (this.cur.reviveT / 3) * Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      return;
    }
    for (const t of this.trail) g.sprite(ctx, look, "Walk", 0, t.dir, t.x + ox, t.y + oy - 8, { white: true, alpha: 0.5 * (1 - t.t / 0.25) });
    // Gengar sunk into the shadows (Phantom Force): a faint shape, no blinking
    const sunk = this.cur.phaseT > 0;
    if (!sunk && this.invuln > 0 && this.hurtT <= 0 && this.dashT <= 0 && Math.floor(this.invuln * 20) % 2) return;
    let name: AnimName = this.moving ? "Walk" : "Idle";
    let t = this.animT;
    if (this.hurtT > 0) {
      name = "Hurt";
      t = 0.3 - this.hurtT;
    } else if (this.basicT > this.basic.every - 0.2 && !this.moving) {
      name = "Shoot";
      t = this.basic.every - this.basicT;
    }
    // Rest: asleep, still, the Z's floating up
    if (this.cur.restT > 0) {
      name = "Idle";
      t = 0;
      if (Math.random() < 0.05) this.part(this.x + 6, this.y - 20, 8, -14, "uiDim", 1, 2, 0, "dot");
    }
    const a = anim(look, name);
    g.sprite(ctx, look, name, frameAt(a, t, name !== "Shoot"), this.dir, this.x + ox, this.y + oy - 8, sunk ? { alpha: 0.3 } : undefined);
    if (this.shieldT > 0) {
      ctx.strokeStyle = g.c.grassFx2;
      ctx.globalAlpha = 0.5 + Math.sin(this.time * 20) * 0.2;
      ring(ctx, this.x + ox, this.y + oy - 9, 15, 1);
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = g.c.grassFx;
      ctx.beginPath();
      ctx.arc(this.x + ox, this.y + oy - 9, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, ox: number, oy: number) {
    const g = this.gfx;
    const x = e.x + ox, y = e.y + oy - 8 - e.z;
    if (x < -60 || x > SW + 60 || y < -80 || y > SH + 60) return;
    // the daily challenge's titans and giga bosses are drawn bigger
    const scale = e.boss?.giga ? 2 : e.titan ? TITAN.scale : undefined;
    if (e.dead) {
      const life = e.boss ? 1.4 : 0.35;
      const name: AnimName = e.boss ? "Faint" : "Hurt";
      g.sprite(ctx, e.dex, name, frameAt(anim(e.dex, name), e.deadT, false), e.dir, x, y, { alpha: 1 - e.deadT / life, white: !e.boss && e.deadT < 0.12, scale });
      return;
    }
    if (e.state === "roar" || e.titan) {
      // a giga boss's roar, a titan's menace: a dark halo
      ctx.strokeStyle = g.c[e.titan ? "hpLow" : TYPE_FX[e.boss!.shot][0]];
      ctx.globalAlpha = 0.4 + Math.sin(e.t * 10) * 0.25;
      ring(ctx, e.x + ox, e.y + oy, e.r + 4 + (e.titan ? 0 : Math.sin(e.t * 20) * 3), 0.45);
      ctx.globalAlpha = 1;
    }
    if (e.elite) {
      ctx.strokeStyle = g.c.gold;
      ctx.globalAlpha = 0.5 + Math.sin(e.t * 8) * 0.3;
      ring(ctx, e.x + ox, e.y + oy, e.r + 3, 0.45);
      ctx.globalAlpha = 1;
    }
    // its last seconds: it blinks, about to leave
    if (e.w?.act === "treasure" && e.t > 16 && Math.floor(e.t * 8) % 2) return;
    const hurt = e.hitT > 0.04;
    const name: AnimName = hurt && !e.boss ? "Hurt" : "Walk";
    const fuse = e.state === "fuse" && Math.floor(e.t * 16) % 2 === 0;
    const wind = e.state === "wind" && Math.floor(e.t * 20) % 2 === 0;
    g.sprite(ctx, e.dex, name, frameAt(anim(e.dex, name), e.sleepT > 0 ? 0 : e.t * (e.state === "dash" ? 2 : 1)), e.dir, x, y, {
      white: e.hitT > 0.06 || fuse || wind,
      alpha: e.alpha < 1 ? e.alpha : undefined,
      scale,
    });
    if (e.w?.act === "treasure" && Math.random() < 0.3) this.part(e.x + rand(-8, 8), e.y - rand(4, 20), 0, -10, "gold", 0.5, 1, 0, "spark");
  }

  private drawShot(ctx: CanvasRenderingContext2D, s: Shot, ox: number, oy: number) {
    const g = this.gfx;
    const x = Math.round(s.x + ox), y = Math.round(s.y + oy);
    const [c1, c2] = TYPE_FX[s.elem];
    switch (s.kind) {
      case "ember":
        // a fireball, its flame flickering behind; the evolved ones glow wider
        if (s.r > 3) {
          ctx.fillStyle = g.c.fire;
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.arc(x, y, s.r + 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        pix(ctx, g, Math.floor(s.t * 14) % 2 ? PIX.ember2 : PIX.ember, x, y, dir4(s.vx, s.vy));
        break;
      case "water":
        pix(ctx, g, PIX.drop, x, y, dir4(s.vx, s.vy));
        break;
      case "flame": {
        const k = 1 - s.life / 0.7;
        ctx.fillStyle = g.c[k < 0.4 ? "fire2" : "fire"];
        const r = 2 + Math.round(k * 4);
        ctx.globalAlpha = Math.max(0.2, 1 - k);
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
        break;
      }
      case "leaf":
        // Razor Leaf: a leaf spinning a quarter at a time
        pix(ctx, g, PIX.leaf, x, y, Math.floor(s.t * 12) % 4);
        break;
      case "shadow":
      case "gball": {
        // Shadow Ball (the move, and Gengar's smaller ones): a dark core, two wisps turning around it, its rim flickering
        const r = s.r;
        ctx.fillStyle = g.c.ink;
        ctx.beginPath();
        ctx.arc(x, y, r + 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = g.c.ghost;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = g.c.ink;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, r - 3), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = g.c.ghost2;
        for (let i = 0; i < 2; i++) {
          const a = s.t * 7 + i * Math.PI;
          ctx.fillRect(Math.round(x + Math.cos(a) * (r - 1.5)) - 1, Math.round(y + Math.sin(a) * (r - 1.5)) - 1, 2, 2);
        }
        ctx.fillRect(x - Math.round(r / 2), y - Math.round(r / 2) - 1, 1, 1);
        if (Math.random() < 0.25) this.part(s.x + rand(-r, r), s.y + rand(-r, r), 0, -12, "ghost2", 0.4, 1, 0, "spark");
        break;
      }
      case "bubble":
        pix(ctx, g, PIX.bubble, x, y);
        break;
      case "scald":
        pix(ctx, g, PIX.bubble, x, y, 0, { b: "fire", l: "fire2" });
        break;
      case "bone":
        pix(ctx, g, PIX.bone, x, y, Math.floor(s.t * 14) % 4);
        break;
      case "sludge":
        pix(ctx, g, PIX.orb, x, y, 0, { a: "poison", b: "poison2" });
        break;
      case "psycut":
        pix(ctx, g, PIX.blade, x, y, dir4(s.vx, s.vy));
        break;
      case "psyorb":
        pix(ctx, g, PIX.orb, x, y, 0, { a: "psy", b: "psy2" });
        break;
      case "rock":
        // Rock Throw: a stone tumbling a quarter at a time (bigger once evolved)
        pix(ctx, g, s.r > 4 ? PIX.orb : PIX.pebble, x, y, Math.floor(s.t * 10) % 4, { a: "ground", b: "ground2" });
        break;
      case "fairy":
        // Fairy Wind: a pink star, turning
        pix(ctx, g, PIX.star, x, y, Math.floor(s.t * 10) % 2, { y: "fairy", w: "fairy2" });
        break;
      case "dragon": {
        // Dragon Rage: a blue flame in its glow
        ctx.fillStyle = g.c.dragon;
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(s.t * 24);
        ctx.beginPath();
        ctx.arc(x, y, s.r + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        pix(ctx, g, PIX.orb, x, y, 0, { a: "dragon", b: "dragon2" });
        break;
      }
      case "ice":
        // a shard of ice, pointing where it flies
        pix(ctx, g, PIX.blade, x, y, dir4(s.vx, s.vy), { p: "ice", P: "ice2" });
        break;
      case "blade":
        // X-Scissor: a blade in its type's colours, pointing where it flies
        pix(ctx, g, PIX.blade, x, y, dir4(s.vx, s.vy), { p: c1, P: c2 });
        break;
      case "aura": {
        // Aura Sphere: a blue-white core in its glow
        ctx.fillStyle = g.c.fight;
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(s.t * 20);
        ctx.beginPath();
        ctx.arc(x, y, s.r + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = g.c.ink;
        ctx.beginPath();
        ctx.arc(x, y, s.r + 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = g.c.fight;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = g.c.fight2;
        ctx.fillRect(x - 2, y - 2, 3, 3);
        break;
      }
      case "swift":
        // Swift: an outlined star, turning
        pix(ctx, g, PIX.star, x, y, Math.floor(s.t * 10) % 2);
        if (Math.random() < 0.2) this.part(s.x, s.y, 0, 0, "gold", 0.25, 1, 0, "spark");
        break;
      case "blast": {
        const r = 6 + (Math.floor(s.t * 12) % 2);
        ctx.fillStyle = g.c.ink;
        ctx.beginPath();
        ctx.arc(x, y, r + 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = g.c.fire;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = g.c.fire2;
        ctx.fillRect(x - 2, y - 2, 4, 4);
        if (Math.random() < 0.8) this.part(s.x, s.y, rand(-14, 14), rand(-20, 4), "fire2", 0.3, 2, 0, "puff");
        break;
      }
      default:
        ctx.fillStyle = g.c[c1];
        ctx.fillRect(x - 2, y - 2, 4, 4);
        ctx.fillStyle = g.c[c2];
        ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }

  /** the wild ones' shots: each element its own little picture */
  private drawFoeShot(ctx: CanvasRenderingContext2D, s: Shot, ox: number, oy: number) {
    const g = this.gfx;
    const x = Math.round(s.x + ox), y = Math.round(s.y + oy);
    if (x < -8 || x > SW + 8 || y < -8 || y > SH + 8) return;
    const d = dir4(s.vx, s.vy);
    const [a, b] = TYPE_FX[s.elem];
    switch (s.elem) {
      case "fire":
        return pix(ctx, g, Math.floor(s.t * 14) % 2 ? PIX.ember2 : PIX.ember, x, y, d);
      case "water":
      case "ice":
        return pix(ctx, g, PIX.drop, x, y, d, { b: a, l: b });
      case "grass":
        return pix(ctx, g, PIX.leaf, x, y, Math.floor(s.t * 12) % 4);
      case "elec":
        return pix(ctx, g, PIX.zap, x, y, (d + (Math.floor(s.t * 16) % 2) * 2) % 4);
      case "ground":
        return pix(ctx, g, PIX.pebble, x, y, Math.floor(s.t * 8) % 4, { a, b });
      default:
        // an orb, blinking
        return pix(ctx, g, PIX.orb, x, y, 0, Math.floor(s.t * 10) % 2 ? { a, b } : { a: b, b: "white" });
    }
  }

  private drawFx(ctx: CanvasRenderingContext2D, f: Fx, ox: number, oy: number) {
    const g = this.gfx;
    if (f.t < 0) return;
    const k = f.t / f.life;
    const x = f.x + ox, y = f.y + oy;
    switch (f.kind) {
      case "zone": {
        // a ring of flames, or a bubbling puddle
        const [c1, c2] = TYPE_FX[f.elem ?? "fire"];
        const fade = Math.max(0, Math.min(1, (f.life - f.t) * 3, f.t * 6));
        ctx.globalAlpha = 0.18 * fade;
        ctx.fillStyle = g.c[c1];
        ellipse(ctx, x, y, f.r!, f.r! * 0.6);
        ctx.globalAlpha = fade;
        if (f.elem === "fire") {
          const n = Math.max(8, Math.round(f.r! / 4));
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + f.t * 2;
            const h = 3 + ((i + Math.floor(f.t * 12)) % 3);
            const px = Math.round(x + Math.cos(a) * f.r!), py = Math.round(y + Math.sin(a) * f.r! * 0.6);
            ctx.fillStyle = g.c.fire;
            ctx.fillRect(px - 1, py - h, 3, h);
            ctx.fillStyle = g.c.fire2;
            ctx.fillRect(px, py - h + 1, 1, h - 1);
          }
        } else {
          ctx.strokeStyle = g.c[c1];
          ring(ctx, x, y, f.r!, 0.6);
          for (let i = 0; i < 6; i++) {
            const a = hash(i, 7) * Math.PI * 2, d = hash(i, 9) * f.r! * 0.8;
            const b = (f.t * 2 + hash(i, 5)) % 1;
            ctx.fillStyle = g.c[c2];
            ctx.globalAlpha = fade * (1 - b);
            ctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.6 - b * 4), 2, 2);
          }
        }
        ctx.globalAlpha = 1;
        break;
      }
      case "mark": {
        // a psychic target closing in, blinking at the end
        const k2 = f.t / f.life;
        if (k2 > 0.75 && Math.floor(f.t * 20) % 2) break;
        const R = Math.round(14 - 7 * k2), cy = y - 8;
        ctx.fillStyle = g.c.psy;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + f.t * 3;
          const px = Math.round(x + Math.cos(a) * R), py = Math.round(cy + Math.sin(a) * R);
          ctx.fillRect(px - 1, py - 1, 3, 3);
        }
        ctx.strokeStyle = g.c.psy2;
        ctx.lineWidth = 1;
        ring(ctx, x, cy, R, 1);
        break;
      }
      case "punch": {
        // a blow: an arc of force bursting out in front (Fighting's, Poison Jab's)
        const [c1, c2] = TYPE_FX[f.elem ?? "fight"];
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = g.c[c1];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, f.r! * (0.4 + 0.6 * k), f.a! - 0.6, f.a! + 0.6);
        ctx.stroke();
        ctx.strokeStyle = g.c[c2];
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, f.r! * (0.3 + 0.6 * k), f.a! - 0.4, f.a! + 0.4);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case "cloud": {
        // Sleep Powder: a soft cloud, fading in and out
        ctx.fillStyle = g.c.psy2;
        ctx.globalAlpha = 0.28 * Math.min(1, k * 6, (1 - k) * 4);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + f.t;
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(a) * f.r! * 0.45, y + Math.sin(a) * f.r! * 0.25, f.r! * 0.6, f.r! * 0.35, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case "hbeam": {
        const ch = f.charge ?? 0.22;
        const [b1, b2] = f.elem && f.elem !== "normal" ? TYPE_FX[f.elem] : (["gold", "white"] as ColorKey[]);
        if (f.t < ch) {
          // charging: a thin flickering line, light gathering at the player
          const px = this.x + ox, py = this.y + oy - 8;
          ctx.fillStyle = g.c[b2];
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.arc(px, py, 2 + (f.t / ch) * 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          if (Math.floor(f.t * 30) % 2) break;
          ctx.strokeStyle = g.c[b1];
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + (f.x2! - f.x), py + (f.y2! - f.y));
          ctx.stroke();
          break;
        }
        const w = f.r! * (1 - (f.t - ch) / (f.life - ch));
        ctx.strokeStyle = g.c[b1];
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(f.x2! + ox, f.y2! + oy);
        ctx.stroke();
        ctx.strokeStyle = g.c[b2];
        ctx.lineWidth = Math.max(1, w * 0.4);
        ctx.stroke();
        ctx.lineWidth = 1;
        break;
      }
      case "tornado": {
        // stacked rings, turning, wider at the top
        const fade = Math.min(1, (f.life - f.t) * 2, f.t * 4);
        for (let i = 0; i < 6; i++) {
          const rr = (f.r! * (0.3 + i * 0.14));
          const sx = x + Math.sin(f.t * 9 + i) * 3;
          ctx.strokeStyle = g.c[i % 2 ? "fly" : "fly2"];
          ctx.globalAlpha = 0.55 * fade;
          ring(ctx, sx, y - i * 7, rr * 0.6, 0.35);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case "meteor": {
        // the shadow grows where it will land, the meteor falls on it (Moonblast's moon: pink, and bigger)
        const kk = Math.min(1, k);
        const [m1, m2] = TYPE_FX[f.elem ?? "dragon"];
        const ms = f.elem === "fairy" ? 2 : 1;
        ctx.strokeStyle = g.c[m1];
        ctx.globalAlpha = 0.5;
        ring(ctx, x, y, f.r! * (0.4 + kk * 0.6), 0.5);
        ctx.globalAlpha = 1;
        const my = y - (1 - kk) * 160;
        const mx = x + (1 - kk) * 60;
        ctx.fillStyle = g.c.ink;
        ctx.fillRect(Math.round(mx) - 4 * ms, Math.round(my) - 4 * ms, 8 * ms, 8 * ms);
        ctx.fillStyle = g.c[m1];
        ctx.fillRect(Math.round(mx) - 3 * ms, Math.round(my) - 3 * ms, 6 * ms, 6 * ms);
        ctx.fillStyle = g.c[m2];
        ctx.fillRect(Math.round(mx) - ms, Math.round(my) - 2 * ms, 2 * ms, 2 * ms);
        if (Math.random() < 0.7) this.part(mx - ox + 4, my - oy - 4, 20, -10, "dragon2", 0.3, 2, 0, "puff");
        break;
      }
      case "whip": {
        // the vine sweeps across the arc
        const half = 0.75 + this.stage * 0.2;
        const a = f.a! - half + k * half * 2;
        ctx.strokeStyle = g.c.grassFx;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
          const rr = (i / 8) * f.r!;
          const aa = a - (1 - i / 8) * 0.5 + Math.sin(i + f.t * 30) * 0.05;
          const px = x + Math.cos(aa) * rr, py = y + Math.sin(aa) * rr;
          if (i) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.strokeStyle = g.c.grassFx2;
        ctx.globalAlpha = 0.5 * (1 - k);
        ctx.beginPath();
        ctx.arc(x, y, f.r! * 0.95, f.a! - half, a);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case "bolt":
      case "strike": {
        const [c1, c2] = TYPE_FX[f.elem ?? "elec"];
        if (Math.floor(f.t * 40) % 3 === 2) break;
        ctx.strokeStyle = g.c[c1];
        ctx.lineWidth = f.kind === "strike" ? 3 : 2;
        poly(ctx, f.pts!, ox, oy);
        ctx.strokeStyle = g.c[c2];
        ctx.lineWidth = 1;
        poly(ctx, f.pts!, ox, oy);
        if (f.kind === "strike") {
          ctx.strokeStyle = g.c[c1];
          ring(ctx, x, y, 4 + k * 14, 0.5);
        }
        break;
      }
      case "ring": {
        const [c1, c2] = TYPE_FX[f.elem ?? "water"];
        const r = k * f.r!;
        ctx.globalAlpha = 1 - k * 0.7;
        ctx.strokeStyle = g.c[c1];
        ctx.lineWidth = 3;
        ring(ctx, x, y, r, 0.6);
        ctx.lineWidth = 1;
        ctx.strokeStyle = g.c[c2];
        ring(ctx, x, y - 1, r, 0.6);
        // crests of the wave
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2 + f.t;
          ctx.fillStyle = g.c[c2];
          ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.6) - 2, 2, 2);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case "quake": {
        ctx.strokeStyle = g.c.ground;
        ctx.globalAlpha = 1 - k;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + hash(i, 3);
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 3);
          ctx.lineTo(x + Math.cos(a + 0.2) * f.r! * 0.5, y + Math.sin(a + 0.2) * f.r! * 0.3);
          ctx.lineTo(x + Math.cos(a) * f.r! * Math.min(1, k * 3), y + Math.sin(a) * f.r! * 0.6 * Math.min(1, k * 3));
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case "boom": {
        const r = (f.r ?? 20) * (0.4 + k * 0.6);
        ctx.fillStyle = g.c[k < 0.3 ? "white" : k < 0.6 ? "fire2" : "fire"];
        ctx.globalAlpha = 1 - k;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case "warn":
        if (Math.floor(f.t * 16) % 2) break;
        ctx.strokeStyle = g.c.hpLow;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(f.x2! + ox, f.y2! + oy);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      case "beam": {
        const [c1, c2] = TYPE_FX[f.elem ?? "water"];
        ctx.strokeStyle = g.c[c1];
        ctx.lineWidth = 9 * (1 - k * 0.6);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(f.x2! + ox, f.y2! + oy);
        ctx.stroke();
        ctx.strokeStyle = g.c[c2];
        ctx.lineWidth = 3 * (1 - k * 0.6);
        ctx.stroke();
        ctx.lineWidth = 1;
        break;
      }
      case "slashwarn": {
        ctx.strokeStyle = g.c.hpLow;
        ctx.globalAlpha = 0.4 + 0.4 * (Math.floor(f.t * 12) % 2);
        ring(ctx, x, y, f.r! * (1 - k * 0.3), 0.5);
        ring(ctx, x, y, f.r! * k, 0.5);
        ctx.globalAlpha = 1;
        break;
      }
      case "levelup": {
        // a column of light
        ctx.fillStyle = g.c.gold;
        ctx.globalAlpha = 0.35 * (1 - k);
        const ow = f.owner ?? this.cur;
        ctx.fillRect(Math.round(ow.x + ox) - 8, 0, 16, Math.round(ow.y + oy));
        ctx.globalAlpha = 1;
        g.text(ctx, this.tr("NIVEAU +", "LEVEL UP"), ow.x + ox, ow.y + oy - 34 - k * 10, "gold", { align: "center" });
        break;
      }
      default:
        break;
    }
  }

  private drawPickups(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
    for (const p of this.pickups) this.drawPickup(ctx, p, ox, oy);
  }

  private drawPickup(ctx: CanvasRenderingContext2D, p: Pickup, ox: number, oy: number) {
    const g = this.gfx;
    {
      const x = Math.round(p.x + ox), y = Math.round(p.y + oy - p.z - (p.vz ? 0 : Math.sin(p.t * 5 + p.x) * 1));
      if (x < -8 || x > SW + 8 || y < -8 || y > SH + 8) return;
      // the precious ones glow
      if (p.kind !== "candy" || p.value >= 8) {
        ctx.fillStyle = g.c[p.kind === "rare" || p.kind === "coin" ? "gold" : p.kind === "candy" ? "xpBig" : p.kind === "magnet" ? "hpLow" : "heal"];
        ctx.globalAlpha = 0.18 + 0.12 * Math.sin(p.t * 6);
        ctx.beginPath();
        ctx.arc(x, y, p.kind === "rare" ? 9 : 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (p.kind === "coin") {
        // a Nugget, turning on itself
        const w = [3, 2, 1, 2][Math.floor(p.t * 8 + p.x) % 4];
        ctx.fillStyle = g.c.ink;
        ctx.fillRect(x - w - 1, y - 4, w * 2 + 2, 8);
        ctx.fillRect(x - w - 2, y - 3, w * 2 + 4, 6);
        ctx.fillStyle = g.c.coin;
        ctx.fillRect(x - w, y - 3, w * 2, 6);
        ctx.fillRect(x - w - 1, y - 2, w * 2 + 2, 4);
        ctx.fillStyle = g.c.coin2;
        ctx.fillRect(x - Math.max(0, w - 1), y - 2, 1, 2);
        return;
      }
      if (p.kind === "candy") {
        // a wrapped candy; the big ones are pink, and a glint runs over them now and then
        const big = p.value >= 8;
        pix(ctx, g, big ? PIX.bigCandy : PIX.candy, x, y);
        if ((p.t + p.x * 0.01) % 2.4 < 0.12) {
          ctx.fillStyle = g.c.white;
          ctx.fillRect(x - 1, y - (big ? 2 : 1), 1, 1);
        }
      } else if (p.kind === "oran" || p.kind === "egg") {
        ctx.fillStyle = g.c.ink;
        ctx.fillRect(x - 3, y - 3, 7, 7);
        ctx.fillStyle = p.kind === "egg" ? g.c.white : g.c.water;
        ctx.fillRect(x - 2, y - 2, 5, 5);
        ctx.fillStyle = p.kind === "egg" ? g.c.heal : g.c.grassFx;
        ctx.fillRect(x, y - 4, 1, 2);
        if (p.kind === "egg") ctx.fillRect(x - 1, y, 2, 1);
      } else if (p.kind === "rare") {
        // the Rare Candy: blue with its golden band and wrappers, twinkling
        pix(ctx, g, PIX.rare, x, y);
        if (Math.floor(p.t * 6) % 2) star(ctx, x + 5, y - 4, p.t, g.c.gold, g.c.white);
      } else {
        ctx.fillStyle = g.c.ink;
        ctx.fillRect(x - 4, y - 4, 8, 7);
        ctx.fillStyle = g.c.hpLow;
        ctx.fillRect(x - 3, y - 3, 2, 5);
        ctx.fillRect(x + 1, y - 3, 2, 5);
        ctx.fillStyle = g.c.white;
        ctx.fillRect(x - 3, y + 1, 2, 1);
        ctx.fillRect(x + 1, y + 1, 2, 1);
      }
    }
  }

  private drawParts(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
    const g = this.gfx;
    for (const p of this.parts) {
      const k = p.life / p.max;
      const x = Math.round(p.x + ox), y = Math.round(p.y + oy);
      ctx.fillStyle = g.c[p.color];
      switch (p.kind) {
        case "puff": {
          const r = Math.max(1, Math.round(p.size * (1.4 - k)));
          ctx.globalAlpha = k * 0.7;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
          ctx.globalAlpha = 1;
          break;
        }
        case "spark":
          if (k < 0.3 && Math.floor(p.life * 30) % 2) break;
          ctx.fillRect(x, y, 1, 1);
          if (p.size > 1 && k > 0.5) {
            ctx.fillRect(x - 1, y, 3, 1);
            ctx.fillRect(x, y - 1, 1, 3);
          }
          break;
        case "rain":
          ctx.globalAlpha = 0.5;
          ctx.fillRect(x, y, 1, 4);
          ctx.globalAlpha = 1;
          break;
        case "hail":
          ctx.globalAlpha = 0.7;
          ctx.fillRect(x, y, 2, 2);
          ctx.globalAlpha = 1;
          break;
        case "sand":
          ctx.globalAlpha = 0.35;
          ctx.fillRect(x, y, 5, 1);
          ctx.globalAlpha = 1;
          break;
        case "firefly":
          ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(p.life * 3));
          ctx.fillRect(x, y, 1, 1);
          ctx.globalAlpha *= 0.4;
          ctx.fillRect(x - 1, y - 1, 3, 3);
          ctx.globalAlpha = 1;
          break;
        case "petal":
        case "leaf":
          ctx.fillRect(x, y, Math.floor(p.life * 4) % 2 ? 2 : 1, 1);
          break;
        default:
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.fillRect(x, y, p.size, p.size);
          ctx.globalAlpha = 1;
      }
    }
  }

  /** dusk and night darken the field (the colour palette only: the four-shade ones keep their shades) */
  private drawLight(ctx: CanvasRenderingContext2D) {
    const g = this.gfx;
    if (g.palette.shades) return;
    const n = this.night;
    const t = this.timeOfDay;
    if (n > 0) {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = g.c.night;
      ctx.globalAlpha = n * 0.42;
      ctx.fillRect(0, 0, SW, SH);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    } else if (this.weather === "sun") {
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = g.c.fire2;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(0, 0, SW, SH);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    } else if (t > 2 && t < 3.5) {
      // golden hour
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = g.c.fire;
      ctx.globalAlpha = Math.min(1, (t - 2) * 2) * 0.35;
      ctx.fillRect(0, 0, SW, SH);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
  }

  /** an arrow at the screen's edge toward the boss or a Chansey */
  private drawPointers(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
    for (const p of this.players) {
      if (p === this.cur) continue;
      const x = p.x + ox, y = p.y + oy;
      if (x > 0 && x < SW && y > 16 && y < SH) {
        // their tag over their head
        this.gfx.text(ctx, `J${p.id + 1}`, x, y - 34, p.down ? "hpLow" : "xp", { align: "center" });
        continue;
      }
      const cx = Math.max(8, Math.min(SW - 8, x)), cy = Math.max(24, Math.min(SH - 30, y));
      const a = Math.atan2(y - cy, x - cx);
      ctx.fillStyle = this.gfx.c[p.down ? "hpLow" : "xp"];
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7);
      ctx.lineTo(cx + Math.cos(a + 2.4) * 6, cy + Math.sin(a + 2.4) * 6);
      ctx.lineTo(cx + Math.cos(a - 2.4) * 6, cy + Math.sin(a - 2.4) * 6);
      ctx.fill();
    }
    // the daily challenge's last foes of a wave are pointed at too
    const last = !!this.setup.defi && !this.bossAlive && this.defiLeft <= 0 && this.defiRemaining <= 6;
    for (const e of this.enemies) {
      if (e.dead || !(e.boss || e.w?.act === "treasure" || last)) continue;
      const x = e.x + ox, y = e.y + oy;
      if (x > 0 && x < SW && y > 16 && y < SH) continue;
      const cx = Math.max(8, Math.min(SW - 8, x)), cy = Math.max(24, Math.min(SH - 30, y));
      const a = Math.atan2(y - cy, x - cx);
      ctx.fillStyle = this.gfx.c[e.boss ? "hpLow" : "gold"];
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
      ctx.lineTo(cx + Math.cos(a + 2.4) * 5, cy + Math.sin(a + 2.4) * 5);
      ctx.lineTo(cx + Math.cos(a - 2.4) * 5, cy + Math.sin(a - 2.4) * 5);
      ctx.fill();
    }
  }

  /** the daily challenge's wave: the foes still standing and those still to come */
  get defiRemaining() {
    return this.defiLeft + this.enemies.filter((e) => !e.dead && !e.boss && e.w?.act !== "treasure").length;
  }

  private drawHud(ctx: CanvasRenderingContext2D) {
    const g = this.gfx;
    const c = g.c;
    // experience across the top
    ctx.fillStyle = c.uiDark;
    ctx.fillRect(0, 0, SW, 4);
    ctx.fillStyle = c.xp;
    ctx.fillRect(1, 1, Math.round((SW - 2) * Math.min(1, this.xp / xpFor(this.level))), 2);
    // HP
    const hpK = this.hp / this.maxHp;
    g.text(ctx, this.tr(`N.${this.level}`, `LV${this.level}`), 4, 8, "ui");
    ctx.fillStyle = c.uiDark;
    ctx.fillRect(28, 8, 62, 6);
    ctx.fillStyle = c[hpK > 0.5 ? "hp" : hpK > 0.2 ? "hpMid" : "hpLow"];
    ctx.fillRect(29, 9, Math.round(60 * hpK), 4);
    g.text(ctx, `${Math.ceil(this.hp)}/${this.maxHp}`, 94, 8, hpK > 0.2 || Math.floor(this.time * 4) % 2 ? "ui" : "hpLow");
    // wave and its clock; the daily challenge's: what's left of the wave
    if (this.setup.defi) {
      g.text(ctx, this.tr(`VAGUE ${this.wave}/${DEFI_WAVES}`, `WAVE ${this.wave}/${DEFI_WAVES}`), SW / 2, 8, "gold", { align: "center" });
      const n = this.defiRemaining;
      if (!this.bossAlive && !this.endAt) g.text(ctx, this.tr(`reste ${n}`, `${n} left`), SW / 2, 15, n <= 5 ? "hpLow" : "uiDim", { align: "center" });
    } else if (this.wave >= MAX_WAVE) {
      g.text(ctx, this.tr(`VAGUE ${MAX_WAVE} · FINALE`, `WAVE ${MAX_WAVE} · FINAL`), SW / 2, 8, "gold", { align: "center" });
    } else {
      const left = Math.max(0, Math.ceil(waveStart(this.wave + 1) - this.time));
      g.text(ctx, this.tr(`VAGUE ${this.wave}`, `WAVE ${this.wave}`), SW / 2, 8, "gold", { align: "center" });
      g.text(ctx, `0:${String(left).padStart(2, "0")}`, SW / 2, 15, left <= 5 ? "hpLow" : "uiDim", { align: "center" });
    }
    g.text(ctx, `KO ${this.kills}`, SW - 4, 8, "ui", { align: "right" });
    this.drawPickup(ctx, { kind: "coin", x: 8, y: 20, z: 0, vz: 1, value: 0, pull: false, t: 0 }, 0, 0);
    g.text(ctx, String(this.gold), 15, 18, "gold");
    const daily = this.setup.daily;
    if (daily)
      g.text(ctx, this.wave >= daily.target ? this.tr("DEFI REUSSI", "CHALLENGE MET") : this.tr(`OBJECTIF : VAGUE ${daily.target}`, `GOAL: WAVE ${daily.target}`), 4, 26, this.wave >= daily.target ? "gold" : "psy");
    if (this.players.length > 1) g.text(ctx, `J${this.cur.id + 1}`, 4, 26, "xp");
    const m = Math.floor(this.time / 60);
    g.text(ctx, `${m}:${String(Math.floor(this.time % 60)).padStart(2, "0")}`, SW - 4, 15, "uiDim", { align: "right" });

    // the boss's bar
    if (this.bossAlive && !this.bossAlive.dead) {
      const b = this.bossAlive;
      ctx.fillStyle = c.uiDark;
      ctx.fillRect(SW / 2 - 70, 24, 140, 6);
      ctx.fillStyle = c.hpLow;
      ctx.fillRect(SW / 2 - 69, 25, Math.round(138 * (b.hp / b.max)), 4);
      g.text(ctx, this.name(b.dex), SW / 2, 32, "ui", { align: "center" });
    }

    // the moves at the bottom: their cooldown fills them back up
    this.moves.forEach((mv, i) => {
      const def = MOVES.find((d) => d.id === mv.id)!;
      const x = 4 + i * 22, y = SH - 22;
      const [c1, c2] = TYPE_FX[def.type];
      ctx.fillStyle = def.evo ? c.gold : c.uiDark;
      ctx.fillRect(x, y, 19, 19);
      ctx.fillStyle = c[c1];
      ctx.fillRect(x + 1, y + 1, 17, 17);
      const full = def.cd[mv.level - 1] * this.haste;
      const ready = mv.id === "protect" ? mv.cd <= 0 && this.shieldT <= 0 : mv.cd <= 0;
      if (!ready && !["psychic", "petal", "blizzard"].includes(mv.id)) {
        ctx.fillStyle = c.uiDark;
        ctx.globalAlpha = 0.65;
        ctx.fillRect(x + 1, y + 1, 17, Math.round(17 * Math.min(1, Math.max(0, mv.cd / full))));
        ctx.globalAlpha = 1;
      } else if (mv.active > 0 || (ready && Math.floor(this.time * 3) % 2 && this.manualMoves)) {
        ctx.strokeStyle = c[c2];
        ctx.strokeRect(x + 0.5, y + 0.5, 18, 18);
      }
      g.text(ctx, this.tr(def.name[0], def.name[1]).slice(0, 3), x + 10, y + 4, "ui", { align: "center" });
      for (let l = 0; l < mv.level; l++) {
        ctx.fillStyle = c[c2];
        ctx.fillRect(x + 3 + l * 3, y + 14, 2, 2);
      }
      if (this.manualMoves && !["psychic", "protect", "petal", "blizzard"].includes(mv.id)) g.text(ctx, String(i + 1), x + 1, y - 7, "uiDim");
    });
    // held items, small, bottom right
    this.items.forEach((it, i) => {
      const def = ITEMS.find((d) => d.id === it.id)!;
      const x = SW - 4 - (this.items.length - i) * 16, y = SH - 16;
      ctx.fillStyle = c.uiDark;
      ctx.fillRect(x, y, 14, 12);
      ctx.fillStyle = c.normal;
      ctx.fillRect(x + 1, y + 1, 12, 10);
      g.text(ctx, this.tr(def.name[0], def.name[1]).slice(0, 2), x + 7, y + 2, "uiDark", { align: "center", outline: "normal" });
      for (let l = 0; l < it.level; l++) {
        ctx.fillStyle = c.gold;
        ctx.fillRect(x + 2 + l * 2, y + 9, 1, 1);
      }
    });

    this.drawRadar(ctx);
    if (this.phase === "paused") this.drawLegend(ctx);

    // the wave's banner slides in and out
    if (this.bannerT > 0) {
      const k = this.bannerT;
      const slide = k > 2.3 ? (k - 2.3) / 0.3 : k < 0.3 ? -(0.3 - k) / 0.3 : 0;
      const x = SW / 2 + slide * SW;
      ctx.fillStyle = c.uiDark;
      ctx.globalAlpha = 0.75;
      ctx.fillRect(0, 96, SW, this.bannerSub ? 34 : 24);
      ctx.globalAlpha = 1;
      g.text(ctx, this.banner, x, 101, "gold", { align: "center", scale: 2 });
      if (this.bannerSub) g.text(ctx, this.bannerSub, x - slide * 40, 119, "ui", { align: "center" });
    }
  }

  /** a radar in the corner: the crowd, the boss, a Chansey */
  private drawRadar(ctx: CanvasRenderingContext2D) {
    const c = this.gfx.c;
    const S = 44, x0 = SW - S - 4, y0 = 22, k = S / 2 / 330;
    ctx.fillStyle = c.uiDark;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x0, y0, S, S);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c.uiDim;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, S - 1, S - 1);
    const dot = (wx: number, wy: number, col: string, s: number) => {
      const dx = (wx - this.x) * k, dy = (wy - this.y) * k;
      if (Math.abs(dx) > S / 2 - 1 || Math.abs(dy) > S / 2 - 1) return;
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x0 + S / 2 + dx - s / 2), Math.round(y0 + S / 2 + dy - s / 2), s, s);
    };
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.boss) dot(e.x, e.y, c.hpLow, 3);
      else if (e.w?.act === "treasure") dot(e.x, e.y, c.psy, 3);
      else if (e.elite) dot(e.x, e.y, c.gold, 2);
      else dot(e.x, e.y, c.uiDim, 1);
    }
    for (const p of this.players) if (p !== this.cur) dot(p.x, p.y, p.down ? c.hpLow : c.xp, 3);
    dot(this.x, this.y, c.white, 2);
  }

  /** the pause's legend: what lies on the ground */
  private drawLegend(ctx: CanvasRenderingContext2D) {
    const g = this.gfx;
    const items: [Pickup["kind"], number, string][] = [
      ["candy", 1, this.tr("BONBON XP", "XP CANDY")],
      ["candy", 10, this.tr("GROS BONBON", "BIG CANDY")],
      ["rare", 0, "SUPER BONBON"],
      ["oran", 0, this.tr("BAIE ORAN", "ORAN BERRY")],
      ["egg", 0, this.tr("OEUF CHANCE", "LUCKY EGG")],
      ["magnet", 0, this.tr("AIMANT", "MAGNET")],
    ];
    items.splice(1, 0, ["coin", 0, this.tr("PEPITE (OR)", "NUGGET (GOLD)")]);
    items.splice(5, 1);
    const y = SH - 56;
    ctx.fillStyle = g.c.uiDark;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, y - 6, SW, 36);
    ctx.globalAlpha = 1;
    items.forEach(([kind, value, label], i) => {
      const x = 14 + (i % 3) * 104, yy = y + 4 + Math.floor(i / 3) * 14;
      this.drawPickup(ctx, { kind, x, y: yy, z: 0, vz: 0, value, pull: false, t: this.animT }, 0, 0);
      g.text(ctx, label, x + 10, yy - 3, "ui");
    });
  }

  private drawEvolution(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
    const g = this.gfx;
    const e = this.evo!;
    ctx.fillStyle = g.c.uiDark;
    ctx.globalAlpha = Math.min(0.85, e.t * 2);
    ctx.fillRect(0, 0, SW, SH);
    ctx.globalAlpha = 1;
    const x = this.x + ox, y = this.y + oy - 8;
    if (e.t < 3.2 || e.cancelled) {
      // the classic flicker between the two shapes, faster and faster
      const speed = 2 + e.t * e.t * 3;
      const showNew = !e.cancelled && Math.floor(e.t * speed) % 2 === 1 && e.t > 0.8;
      g.sprite(ctx, showNew ? e.to : e.from, "Idle", frameAt(anim(e.from, "Idle"), this.animT), 0, x, y, { white: e.t > 0.6 && !e.cancelled, scale: 2 });
    } else {
      const a = anim(e.to, "Pose");
      g.sprite(ctx, e.to, "Pose", frameAt(a, e.t - 3.2, a.d.length > 1 && animSeconds(a) < 1.8), 0, x, y, { scale: 2 });
    }
    if (Math.random() < 0.4) this.part(this.x + rand(-30, 30), this.y + 20, 0, -rand(20, 50), "gold", 1, 1, 0, "spark");
    this.drawParts(ctx, ox, oy);
  }

  /* ---------------- the title and the starter choice, drawn behind the menus ---------------- */

  private drawMenu(ctx: CanvasRenderingContext2D) {
    const g = this.gfx;
    const scroll = Math.floor(this.menuT * 12);
    this.drawGround(ctx, -scroll, -Math.floor(this.menuT * 4));
    for (const w of this.wanderers)
      g.sprite(ctx, w.dex, "Walk", frameAt(anim(w.dex, "Walk"), w.t), w.vx > 0 ? 2 : 6, w.x - (this.menuT * 12) % 1, w.y);
    this.drawParts(ctx, 0, 0);
    if (this.phase === "select") {
      ctx.fillStyle = g.c.uiDark;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(0, 0, SW, SH);
      ctx.globalAlpha = 1;
      this.roster.forEach((s, i) => {
        const { x, y } = pickAt(i, this.roster);
        const sel = i === this.selected;
        const locked = this.locked(i);
        if (sel) {
          ctx.fillStyle = g.c.gold;
          ctx.globalAlpha = 0.25;
          ellipse(ctx, x, y + 14, 22, 8);
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = g.c.shadow;
        ctx.globalAlpha = 0.35;
        ellipse(ctx, x, y + 14, 10, 4);
        ctx.globalAlpha = 1;
        // a starter still to unlock: its silhouette, standing still
        const name: AnimName = sel && !locked ? "Walk" : "Idle";
        const dex = s.dex;
        g.sprite(ctx, dex, name, locked ? 0 : frameAt(anim(dex, name), this.menuT * (sel ? 1.4 : 1)), 0, x, y + 6 - (sel && !locked ? Math.abs(Math.sin(this.menuT * 6)) * 3 : 0), {
          scale: 2,
          dark: locked,
          alpha: locked && !sel ? 0.75 : undefined,
        });
        if (locked) g.text(ctx, "?", x, y - 18, sel ? "gold" : "ui", { align: "center", scale: 2 });
      });
    }
  }
}

/* ---------------- small drawing helpers ---------------- */

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(Math.round(x), Math.round(y), Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, squash: number) {
  ctx.beginPath();
  ctx.ellipse(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.max(1, r), Math.max(1, r * squash), 0, 0, Math.PI * 2);
  ctx.stroke();
}

function poly(ctx: CanvasRenderingContext2D, pts: [number, number][], ox: number, oy: number) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(Math.round(x + ox), Math.round(y + oy)) : ctx.moveTo(Math.round(x + ox), Math.round(y + oy))));
  ctx.stroke();
}

/** a lightning path: each straight segment broken into zigzags */
function jag(pts: [number, number][], amp = 5): [number, number][] {
  const out: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 12));
    for (let k = 1; k < n; k++) out.push([ax + ((bx - ax) * k) / n + rand(-amp, amp), ay + ((by - ay) * k) / n + rand(-amp, amp)]);
    out.push(pts[i]);
  }
  return out;
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c1: string, c2: string) {
  ctx.fillStyle = c1;
  for (let i = -r; i <= r; i++) ctx.fillRect(x - (r - Math.abs(i)), y + i, (r - Math.abs(i)) * 2 + 1, 1);
  ctx.fillStyle = c2;
  ctx.fillRect(x - 1, y - 1, 1, 2);
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, c1: string, c2: string) {
  const s = Math.floor(t * 12) % 2;
  ctx.fillStyle = c1;
  ctx.fillRect(x - 2 - s, y, 5 + s * 2, 1);
  ctx.fillRect(x, y - 2 - s, 1, 5 + s * 2);
  ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = c2;
  ctx.fillRect(x, y, 1, 1);
}

/**
 * Little pixel pictures, drawn facing right: one character a pixel, a colour of the palette ("." = see-through). k ink,
 * w white; the others are each picture's own (see PIX_KEYS), and a caller can swap them (a foe's element).
 */
const PIX = {
  ember: [
    ".....kkk..",
    "r...krrrk.",
    ".rrkrryyrk",
    "rrrkryywyk",
    ".rrkrryyrk",
    "....krrrk.",
    ".....kkk..",
  ],
  ember2: [
    ".....kkk..",
    "....krrrk.",
    "r.rkrryyrk",
    ".rrkryywyk",
    "rrrkrryyrk",
    ".r..krrrk.",
    ".....kkk..",
  ],
  drop: [
    "...kkkk.",
    ".kkbbllk",
    "kbbbbblk",
    ".kkbbbbk",
    "...kkkk.",
  ],
  leaf: [
    "....kkk",
    "..kkggk",
    ".kgggGk",
    "kgGGgk.",
    "kGgkk..",
    "kk.....",
  ],
  star: [
    "...k...",
    "..kyk..",
    "kkyyykk",
    "kyywyyk",
    ".kyyyk.",
    ".kykyk.",
    ".kk.kk.",
  ],
  zap: [
    "...kk",
    "..kak",
    ".kak.",
    "kaaak",
    ".kak.",
    "kak..",
    "kk...",
  ],
  pebble: [
    ".kkk.",
    "kabak",
    "kaaak",
    ".kkk.",
  ],
  orb: [
    ".kkkk.",
    "kbaaak",
    "kbaaak",
    "kaaaak",
    "kaaaak",
    ".kkkk.",
  ],
  candy: [
    "...kkk...",
    "k.kbaak.k",
    "kckaaakck",
    "k.kaaak.k",
    "...kkk...",
  ],
  bigCandy: [
    ".....kkk.....",
    "k...kbbak...k",
    "kc.kbaaaak.ck",
    "kcckaaaaakcck",
    "kc.kaaaaak.ck",
    "k...kaaak...k",
    ".....kkk.....",
  ],
  bubble: [
    ".bbbb.",
    "bwl..b",
    "bl...b",
    "b....b",
    "b...lb",
    ".bbbb.",
  ],
  bone: [
    "kkk...kkk",
    "kwwkkkwwk",
    "kwwwwwwwk",
    "kwwkkkwwk",
    "kkk...kkk",
  ],
  blade: [
    ".pp..",
    "..pP.",
    "...PP",
    "...PW",
    "...PP",
    "..pP.",
    ".pp..",
  ],
  rare: [
    ".....kkk.....",
    "k...kllbk...k",
    "ky.klbbbbk.yk",
    "kyykyyyyykyyk",
    "ky.kbbbbbk.yk",
    "k...kbbbk...k",
    ".....kkk.....",
  ],
} as const;
type PixArt = (typeof PIX)[keyof typeof PIX];
const PIX_KEYS: Record<string, ColorKey> = {
  k: "ink", w: "white", r: "fire", y: "fire2", b: "water", l: "water2", g: "grassFx", G: "grassFx2", a: "elec", c: "xp2", p: "psy", P: "psy2", W: "white",
};
/** each picture's colours, where they differ from PIX_KEYS */
const PIX_OWN = new Map<PixArt, Record<string, ColorKey>>([
  [PIX.star, { y: "gold" }],
  [PIX.pebble, { a: "ground", b: "ground2" }],
  [PIX.candy, { a: "xp", b: "xp2", c: "xp" }],
  [PIX.bigCandy, { a: "xpBig", b: "white", c: "xpBig" }],
  [PIX.rare, { y: "gold" }],
]);
/** made once per palette, picture, turn and colours */
const pixMade = new WeakMap<object, Map<string, HTMLCanvasElement>>();

/** a picture centred on x, y; dir turns it a quarter at a time (0 right, 1 down, 2 left, 3 up) */
function pix(ctx: CanvasRenderingContext2D, g: Gfx, rows: PixArt, x: number, y: number, dir = 0, swap?: Record<string, ColorKey>) {
  let made = pixMade.get(g.c);
  if (!made) pixMade.set(g.c, (made = new Map()));
  const id = `${Object.keys(PIX).find((k) => PIX[k as keyof typeof PIX] === rows)}${dir}${swap ? JSON.stringify(swap) : ""}`;
  let cv = made.get(id);
  if (!cv) {
    const keys = { ...PIX_KEYS, ...PIX_OWN.get(rows), ...swap };
    const h = rows.length, w = rows[0].length, turned = dir % 2 === 1;
    cv = document.createElement("canvas");
    cv.width = turned ? h : w;
    cv.height = turned ? w : h;
    const c = cv.getContext("2d")!;
    for (let i = 0; i < h; i++)
      for (let j = 0; j < w; j++) {
        const ch = rows[i][j];
        if (ch === ".") continue;
        c.fillStyle = g.c[keys[ch]];
        const [px, py] = dir === 0 ? [j, i] : dir === 1 ? [h - 1 - i, j] : dir === 2 ? [w - 1 - j, i] : [i, w - 1 - j];
        c.fillRect(px, py, 1, 1);
      }
    made.set(id, cv);
  }
  ctx.drawImage(cv, Math.round(x - cv.width / 2), Math.round(y - cv.height / 2));
}

/** where a shot heads, a quarter at a time */
const dir4 = (vx: number, vy: number) => (Math.abs(vx) >= Math.abs(vy) ? (vx >= 0 ? 0 : 2) : vy >= 0 ? 1 : 3);

/** the starter screen: where the i-th of n Pokémon stands */
/**
 * Where a starter stands on the starter screen (its feet, about): the four starters and the rewards on the first row,
 * the ones to unlock on the second
 */
export const pickAt = (i: number, roster: Starter[]) => {
  const s = roster[i];
  const row = roster.filter((o) => !o.unlock === !s.unlock);
  const n = row.length, k = row.indexOf(s);
  return { x: Math.round(SW / 2 + (k - (n - 1) / 2) * (n > 5 ? 52 : n > 4 ? 60 : 68)), y: s.unlock ? 124 : 66 };
};

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + dx * k), py - (ay + dy * k));
}
