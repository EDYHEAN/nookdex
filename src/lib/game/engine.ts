// The NookBoy survival game: one starter against waves of wild Pokémon. A fixed 60 Hz step, drawn on a 320x288 canvas.
// React (components/game/NookBoy) owns the menus and the shell; the engine tells it when its phase changes.

import { unlock } from "@/lib/trophyStore";
import { gsfx, music } from "./audio";
import {
  BONUSES, BOSSES, COMBOS, ITEMS, MAX_ITEMS, MAX_LEVEL, MAX_MOVES, MOVES, NAMES, POOLS, RARITY, RETIRE, STARTERS, WAVE_SECONDS, WILD, xpFor,
  DAILY_MODS, type BonusId, type DailyMod, type PensionId, type Rarity, type BossDef, type BossMove, type Elem, type ItemId, type Lang, type MoveId, type Starter, type Wild,
} from "./data";
import { SH, SW, T, TILE, TYPE_FX, anim, animSeconds, dirOf, frameAt, mon, type AnimName, type ColorKey, type Gfx } from "./gfx";

/** after each boss, a break: center (the Pokémon Center: healed, moves to forget), shop (Kecleon's), countdown (3-2-1) */
export type Phase = "title" | "select" | "play" | "levelup" | "evolve" | "paused" | "dying" | "over" | "center" | "shop" | "countdown";
export type Mode = "classic" | "daily" | "coop";

/** what a run is played with: the Pension's levels (none in the daily), the daily's rule */
export interface RunSetup {
  mode: Mode;
  perm: Partial<Record<PensionId, number>>;
  /** the purse brought in: what's in it at the end goes back */
  wallet?: number;
  /** player 1 dressed as another Pokémon (a reward) */
  skin?: number;
  daily?: { day: string; mod: DailyMod; starter: number; target: number };
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
  /** evolve: a move at its last level and its item make a stronger move; bonus: what's left once all is learnt */
  kind: "move" | "item" | "heal" | "evolve" | "bonus";
  id?: MoveId | ItemId | BonusId;
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
  wave: number;
  kills: number;
  level: number;
  seconds: number;
  starter: number;
  dex: number;
  /** the second player's Pokémon, in coop */
  dex2?: number;
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
  dotT: number;
  state: string;
  stateT: number;
  /** a boss's next move */
  actT: number;
  elite: boolean;
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
  kind: "ember" | "water" | "leaf" | "shadow" | "swift" | "flame" | "foe" | "blast";
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
  kind: "whip" | "bolt" | "strike" | "ring" | "quake" | "boom" | "warn" | "beam" | "levelup" | "text" | "slashwarn" | "poof" | "cloud" | "hbeam" | "meteor" | "tornado";
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
  kind: "dot" | "puff" | "leaf" | "spark" | "rain" | "petal" | "firefly";
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
  /** dressed as another Pokémon (a reward): only the look changes */
  skin?: number;
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
  /** the starter screen shows the chosen one in this skin */
  selectSkin?: number;
  showSkin(dex?: number) {
    this.selectSkin = dex;
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
    this.selected = (i + STARTERS.length) % STARTERS.length;
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
  /** dressed as Mewtwo (a reward), the player is stronger too (Johan, 2026-10-13); not in the daily, the same for all */
  private get mew() {
    return this.cur.skin === 150 && this.setup.mode !== "daily";
  }
  get power() {
    return (1 + 0.02 * this.perm("power")) * (this.setup.daily?.mod.playerDmg ?? 1) * (1 + this.stage * 0.18) * (1 + 0.12 * this.itemLevel("band")) * (1 + 0.1 * this.itemLevel("lifeorb")) * (1 + this.bonusPower) * (this.mew ? 1.3 : 1);
  }
  get speed() {
    return this.starter.speed * (1 + 0.08 * this.itemLevel("scarf")) * (1 + this.stage * 0.04) * (1 + 0.015 * this.perm("speed")) * (this.mew ? 1.1 : 1);
  }
  get haste() {
    return Math.max(0.4, (1 - 0.08 * this.itemLevel("claw")) * this.bonusHaste * (1 - 0.015 * this.perm("haste")) * (this.mew ? 0.88 : 1));
  }
  get area() {
    return (1 + 0.1 * this.itemLevel("root")) * (1 + this.stage * 0.08);
  }
  get crit() {
    return 0.05 + 0.07 * this.itemLevel("lens");
  }
  get critMul() {
    return 1.8 + 0.25 * this.itemLevel("belt");
  }
  get magnet() {
    return 56 * (1 + 0.4 * this.itemLevel("magnet")) * (1 + 0.08 * this.perm("magnet"));
  }
  get xpMul() {
    return (1 + 0.12 * this.itemLevel("share")) * (1 + 0.03 * this.perm("xp")) * (this.setup.daily?.mod.xp ?? 1);
  }
  get goldMul() {
    return (1 + 0.06 * this.perm("gold")) * (this.setup.daily?.mod.gold ?? 1);
  }
  private computeMaxHp() {
    return Math.round(
      (this.starter.hp + this.stage * 30 + 20 * this.itemLevel("hpup") + (this.level - 1) * 2) * (1 - 0.03 * this.itemLevel("lifeorb")) * (1 + 0.04 * this.perm("hp")) * (this.mew ? 1.3 : 1),
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
    this.setup = setup;
    this.cardRng = setup.daily ? seeded(dailyOf(setup.daily.day).seed) : Math.random;
    this.gold = setup.wallet ?? 0;
    this.offers = [];
    this.shopRerolls = 0;
    this.inBreak = false;
    Object.assign(this, {
      time: 0, kills: 0, wave: 1, enemies: [], shots: [], foes: [], pickups: [], fx: [], parts: [], nums: [], spawnAcc: 0, treasureAt: -1,
      bossAlive: null, breakAt: 0, shake: 0, flash: 0, dyingT: 0,
    });
    const picks = setup.mode === "coop" && i2 != null ? [i, i2] : [setup.daily ? setup.daily.starter : i];
    this.players = picks.map((k, id) => {
      const p = new Player(id);
      const s = STARTERS[k];
      Object.assign(p, { starter: s, dex: s.dex, x: id * 24, y: 0, cam: { x: id * 24, y: 0 }, invuln: 1 });
      this.cur = p;
      p.rerolls = this.perm("reroll");
      p.revives = this.perm("revive");
      p.maxHp = this.computeMaxHp();
      p.hp = p.maxHp;
      return p;
    });
    this.cur = this.players[0];
    if (setup.skin) {
      const p = this.players[0];
      p.skin = setup.skin;
      p.maxHp = this.computeMaxHp();
      p.hp = p.maxHp;
    }
    this.showBanner(this.tr("VAGUE 1", "WAVE 1"), this.tr("des Pokémon sauvages approchent", "wild Pokémon are coming"));
    gsfx.waveStart();
    music.boss(false);
    this.set("play");
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
    this.apply(c);
    this.pendingLevels--;
    this.afterLevel();
  }

  /** a card's effect, from a level-up or from the shop */
  private apply(c: Choice) {
    if (c.kind === "move") {
      const m = this.moves.find((x) => x.id === c.id);
      if (m) m.level++;
      else this.moves.push({ id: c.id as MoveId, level: 1, cd: 0.5, active: 0 });
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
  /** prices climb 8 % a wave after the first shop (wave 6) */
  private get priceUp() {
    return Math.pow(1.08, Math.max(0, this.wave - 6));
  }
  get rerollPrice() {
    return Math.round((15 + 15 * this.shopRerolls) * this.priceUp);
  }
  get healPrice() {
    return Math.round(25 * this.priceUp);
  }
  buy(i: number) {
    const o = this.offers[i];
    if (this.phase !== "shop" || !o || o.sold || this.gold < o.price) return gsfx.back();
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
  leaveShop() {
    if (this.phase !== "shop") return;
    gsfx.ok();
    // in coop, the second player's turn at the stall (the gold is shared)
    const next = this.players[this.cur.id + 1];
    if (next) {
      this.cur = next;
      this.shopRerolls = 0;
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

  /** at the Pokémon Center: forget a move or drop an item (it frees its slot) */
  forget(kind: "move" | "item", id: MoveId | ItemId) {
    if (this.phase !== "center") return;
    if (kind === "move") this.moves = this.moves.filter((m) => m.id !== id);
    else this.items = this.items.filter((i) => i.id !== id);
    this.maxHp = this.computeMaxHp();
    this.hp = Math.min(this.hp, this.maxHp);
    gsfx.back();
    this.onChange();
  }

  leaveCenter() {
    if (this.phase !== "center") return;
    gsfx.ok();
    // in coop, the second player's turn at the counter
    const next = this.players[this.cur.id + 1];
    if (next) {
      this.cur = next;
      return this.onChange();
    }
    this.cur = this.players[0];
    this.resume();
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
    this.choices = this.drawChoices(3);
    this.choiceAt = performance.now();
    this.release();
    this.set("levelup");
  }

  /** n cards: the evolutions ready first, then by rarity; boosts once everything is learnt */
  private drawChoices(n: number): Choice[] {
    const pool: Choice[] = [];
    // an evolution ready: it always comes first
    const evolutions: Choice[] = MOVES.filter(
      (d) => d.evo && this.moves.some((m) => m.id === d.evo!.from && m.level >= MAX_LEVEL) && this.itemLevel(d.evo.item) > 0,
    ).map((d) => ({ kind: "evolve", id: d.id, level: MAX_LEVEL }));
    const weights: number[] = [];
    for (const m of MOVES) {
      if (m.evo) continue;
      const has = this.moves.find((x) => x.id === m.id);
      if (!(has ? has.level < MAX_LEVEL : this.moves.length < MAX_MOVES)) continue;
      pool.push({ kind: "move", id: m.id, level: (has?.level ?? 0) + 1, rarity: m.rarity });
      // what you have comes back more; new moves too while the four slots aren't full
      weights.push(RARITY[m.rarity].weight * (has ? 1.6 : this.moves.length < 2 ? 2.5 : 1));
    }
    for (const it of ITEMS) {
      const has = this.items.find((x) => x.id === it.id);
      if (!(has ? has.level < MAX_LEVEL : this.items.length < MAX_ITEMS)) continue;
      pool.push({ kind: "item", id: it.id, level: (has?.level ?? 0) + 1, rarity: it.rarity });
      weights.push(RARITY[it.rarity].weight * (has ? 1.6 : 1));
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
    for (const b of BONUSES) if (out.length < n) out.push({ kind: "bonus", id: b.id, level: 0, rarity: "common" });
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
      if (this.dyingT > 2.2) {
        const daily = this.setup.daily;
        if (this.setup.mode === "coop") unlock("game-coop");
        const won = !!daily && this.wave >= daily.target;
        this.lastStats = {
          mode: this.setup.mode, day: daily?.day, gold: this.gold, dailyBonus: daily ? dailyReward(this.wave, won) : 0, dailyWon: won,
          wave: this.wave, kills: this.kills, level: Math.max(...this.players.map((p) => p.level)), seconds: Math.floor(this.time),
          starter: this.players[0].starter.dex, dex: this.players[0].dex, dex2: this.players[1]?.dex,
        };
        this.set("over");
      }
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

    // a new wave every 30 s; every fifth one brings a boss
    const wave = 1 + Math.floor(this.time / WAVE_SECONDS);
    if (wave !== this.wave) this.newWave(wave);
    if (this.breakAt && this.time >= this.breakAt) {
      this.breakAt = 0;
      return this.startBreak();
    }

    this.eachAlive((p) => this.movePlayer(p.input, dt));
    this.buildGrid();
    this.eachAlive((p) => {
      this.stepDash(dt);
      this.stepRocks(dt);
      this.attack(p.input, dt);
      this.castMoves(dt);
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
      const regen = 0.3 * this.itemLevel("leftovers");
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
      if (this.pendingLevels > 0) this.offerChoices();
      else this.set("play");
    }
  }

  private newWave(wave: number) {
    this.wave = wave;
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
    gsfx.waveStart();
    if (wave % 5 === 0) {
      const round = Math.floor((wave / 5 - 1) / BOSSES.length);
      const b = BOSSES[(wave / 5 - 1) % BOSSES.length];
      const mult = (1 + round * 2) * (1 + wave * 0.02);
      const a = Math.random() * Math.PI * 2;
      const e = this.makeEnemy(b.dex, this.x + Math.cos(a) * 170, this.y + Math.sin(a) * 150);
      Object.assign(e, { boss: b, hp: b.hp * mult, max: b.hp * mult, speed: b.speed, dmg: b.dmg * (1 + round * 0.5) * (1 + wave * 0.04), r: b.r, actT: 3 });
      this.enemies.push(e);
      this.bossAlive = e;
      this.showBanner(`${this.name(b.dex)}`, this.tr(b.title[0], b.title[1]));
      gsfx.boss();
      music.boss(true);
    } else if (wave === 11) {
      // a joke wave: a shoal of Magikarp splashing about
      for (let i = 0; i < 40; i++) this.spawnOne(129, i / 40);
      this.showBanner(this.tr("VAGUE 11", "WAVE 11"), this.tr("une horde de Magicarpe ?!", "a shoal of Magikarp?!"));
    } else this.showBanner(this.tr(`VAGUE ${wave}`, `WAVE ${wave}`), "");
    // the daily met: its banner wins over the others
    if (daily && wave === daily.target)
      this.showBanner(this.tr("DEFI REUSSI !", "CHALLENGE MET!"), this.tr(`+${dailyReward(wave, true)} or, et plus si tu tiens`, `+${dailyReward(wave, true)} gold, more if you hold on`));
    // a Chansey runs by sometimes: catch it if you can
    this.treasureAt = wave >= 3 && Math.random() < 0.45 ? this.time + rand(5, 25) : -1;
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
    if (noCenter) return this.resume();
    gsfx.heal();
    this.set("center");
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

  private attack(input: Input, dt: number) {
    this.basicT -= dt;
    if (this.basicT > 0 || !this.firingNow(input)) return;
    const b = this.starter.basic;
    this.basicT = b.every * (this.stage === 2 ? 0.85 : 1);
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
          e.poisonT = 5;
          e.poisonDps = Math.max(e.poisonDps, (4 + 2 * L) * pw);
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
      // ---- the evolved moves ----
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

  /** Quick Attack: the player rushes, hitting what it goes through */
  private stepDash(dt: number) {
    for (const t of this.trail) t.t += dt;
    this.trail = this.trail.filter((t) => t.t < 0.25);
    if (this.dashT <= 0) return;
    this.dashT -= dt;
    this.x += this.dashV.x * 340 * dt;
    this.y += this.dashV.y * 340 * dt;
    this.trail.push({ x: this.x, y: this.y, dir: this.dir, t: 0 });
    const m = this.moves.find((x) => x.id === "quick");
    const L = m?.level ?? 1;
    for (const e of this.around(this.x, this.y, 16)) {
      if (this.dashHit.has(e)) continue;
      this.dashHit.add(e);
      this.damage(e, (20 + 8 * L) * this.power, this.dashV.x * 120, this.dashV.y * 120, "normal");
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
    // a combo: the right type on a foe in the right state
    let mul = 1;
    for (const c of COMBOS)
      if (c.by === elem && c.mul > mul && (c.on === "wet" ? e.wetT : c.on === "burn" ? e.burnT : c.on === "poison" ? e.poisonT : e.sleepT) > 0) mul = c.mul;
    if (elem === "water") e.wetT = 4;
    if (elem === "fire") {
      e.burnT = 3;
      e.burnDps = Math.max(e.burnDps, base * 0.12);
    }
    if (elem === "ice" && e.wetT > 0 && !e.boss) e.sleepT = Math.max(e.sleepT, 1.2);
    const crit = Math.random() < this.crit;
    const day = this.setup.daily?.mod.elem;
    const boost = day && (elem === day[0] || (day[0] === "water" && elem === "elec")) ? day[1] : 1;
    const dmg = Math.max(1, Math.round(base * mul * boost * (crit ? this.critMul : 1) * rand(0.9, 1.1)));
    if (mul > 1) {
      unlock("game-combo");
      for (let i = 0; i < 5; i++) this.part(e.x, e.y - 10, rand(-40, 40), rand(-60, -10), "gold", 0.4, 2, 60, "spark");
      if (!quiet) gsfx.zap();
    }
    e.hp -= dmg;
    e.hitT = 0.1;
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
    const xp = (e.w?.xp ?? 0) * (e.elite ? 4 : 1);
    if (e.boss) {
      unlock("game-boss");
      this.bossAlive = null;
      this.breakAt = this.time + 1.5;
      music.boss(false);
      this.shake = 10;
      this.flash = 0.8;
      this.drop("rare", e.x, e.y, 0);
      this.drop("oran", e.x + 8, e.y, 0);
      for (let i = 0; i < 14; i++) this.drop("candy", e.x + rand(-20, 20), e.y + rand(-20, 20), 8);
      for (let i = 0; i < 12; i++) this.drop("coin", e.x + rand(-24, 24), e.y + rand(-24, 24), 3 + Math.floor(this.wave / 3));
      gsfx.rare();
      this.showBanner(this.tr(`${this.name(e.dex)} est K.O. !`, `${this.name(e.dex)} fainted!`), this.tr("un Super Bonbon est tombé", "a Rare Candy dropped"));
    } else if (e.w?.act === "treasure") {
      unlock("game-chansey");
      for (let i = 0; i < 8; i++) this.drop("candy", e.x + rand(-14, 14), e.y + rand(-14, 14), 8);
      for (let i = 0; i < 8; i++) this.drop("coin", e.x + rand(-14, 14), e.y + rand(-14, 14), 2 + Math.floor(this.wave / 4));
      this.drop("egg", e.x, e.y, 0);
      gsfx.rare();
    } else {
      this.drop("candy", e.x, e.y, xp);
      const v = 1 + Math.floor(this.wave / 4);
      if (e.elite) for (let i = 0; i < 4; i++) this.drop("coin", e.x + rand(-8, 8), e.y + rand(-8, 8), v);
      else if (Math.random() < 0.1) this.drop("coin", e.x, e.y, v);
      const r = Math.random();
      if (r < 0.012) this.drop("oran", e.x, e.y, 0);
      else if (r < 0.016) this.drop("magnet", e.x, e.y, 0);
      else if (r < 0.0175) this.drop("rare", e.x, e.y, 0);
    }
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
    if (this.invuln > 0 || this.shieldT > 0) return;
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
    this.hp -= dmg;
    // a little less breathing room as the waves go on
    this.invuln = Math.max(0.45, 0.8 - this.wave * 0.012);
    this.hurtT = 0.3;
    this.hurtFlash = 1;
    this.shake = Math.max(this.shake, 3);
    gsfx.hurt();
  }

  /* ---------------- spawning ---------------- */

  private makeEnemy(dex: number, x: number, y: number): Enemy {
    const w = WILD[dex] ?? null;
    const k = this.wave - 1;
    // they get tougher faster than the player does, past the first waves
    const hpMul = 1 + 0.18 * k + 0.012 * k * k;
    const elite = !!w && w.act !== "treasure" && w.act !== "flop" && Math.random() < (0.015 + 0.004 * this.wave) * (this.setup.daily?.mod.elite ?? 1);
    const hp = (w?.hp ?? 100) * hpMul * (elite ? 4 : 1);
    return {
      w, boss: null, dex, x, y, kx: 0, ky: 0, hp, max: hp, speed: (w?.speed ?? 30) * (1 + Math.min(0.35, 0.012 * k)) * (elite ? 0.9 : 1),
      dmg: (w?.dmg ?? 10) * (1 + 0.08 * k + 0.004 * k * k) * (elite ? 1.5 : 1) * (this.setup.daily?.mod.enemyDmg ?? 1), r: (w?.r ?? 7) * (elite ? 1.3 : 1), dir: 0, t: Math.random() * 2, hitT: 0, slowT: 0, sleepT: 0, wetT: 0, burnT: 0, burnDps: 0, poisonT: 0, poisonDps: 0, dotT: 0.5,
      state: "", stateT: rand(1, 3), actT: 2, elite, z: 0, alpha: 1, aim: { x: 0, y: 0 }, touchT: 0, n: 0, dead: false, deadT: 0, seed: Math.random() * 100,
    };
  }

  private spawnOne(dex: number, frac = Math.random()) {
    const a = frac * Math.PI * 2;
    const d = VIEW_R + rand(10, 40);
    // around one of the players standing
    const p = pick(this.alive().length ? this.alive() : this.players);
    this.enemies.push(this.makeEnemy(dex, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d));
  }

  private spawn(dt: number) {
    const alive = this.enemies.length;
    const cap = Math.min(260, 120 + this.wave * 6);
    const rate = (0.6 + 0.3 * this.wave + 0.012 * this.wave * this.wave) * (this.bossAlive ? 0.5 : 1) * (this.setup.daily?.mod.spawn ?? 1);
    this.spawnAcc += rate * dt;
    const pool = POOLS.filter(([w]) => w <= this.wave).flatMap(([, d]) => d).filter((d) => !(RETIRE[d] && this.wave >= RETIRE[d]));
    while (this.spawnAcc >= 1) {
      this.spawnAcc--;
      if (alive >= cap) continue;
      const dex = pick(pool);
      // sometimes a whole group comes from one side
      if (Math.random() < 0.08) {
        const f = Math.random();
        for (let i = 0; i < 5; i++) this.spawnOne(dex, f + rand(-0.03, 0.03));
      } else this.spawnOne(dex);
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
      if (e.alpha >= 0.5 && e.z < 4 && e.sleepT <= 0 && e.w?.act !== "treasure" && d < e.r + PLAYER_R) {
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
    e.actT = rand(2.6, 3.8) * (this.wave > 30 ? 0.75 : 1);
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
      case "strikes":
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = i === 0 ? 0 : rand(16, 50);
          this.fx.push({ kind: "slashwarn", x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r, t: 0, life: 0.9, r: 14, dmg: e.dmg, elem: b.shot });
        }
        break;
    }
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
      if ((s.kind === "leaf" || s.kind === "swift") && s.target) {
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
      if (s.kind === "ember" && Math.random() < 0.5) this.part(s.x, s.y, rand(-8, 8), rand(-14, 0), "fire2", 0.25, 1, 0, "dot");
      if (s.kind === "shadow" && Math.random() < 0.6) this.part(s.x + rand(-s.r, s.r), s.y + rand(-s.r, s.r), 0, -8, "ghost2", 0.4, 1, 0, "dot");
      if (s.kind === "swift" && Math.random() < 0.4) this.part(s.x, s.y, 0, 0, "gold", 0.3, 1, 0, "spark");
      for (const e of this.around(s.x, s.y + 8, s.r + 12)) {
        if (s.life <= 0) break;
        if (s.hit!.has(e) || e.alpha < 0.5) continue;
        if (dist2(s.x, s.y + 8, e.x, e.y) > (s.r + e.r) ** 2) continue;
        s.hit!.add(e);
        const sp = Math.hypot(s.vx, s.vy) || 1;
        const kb = s.kind === "water" ? 90 : s.kind === "shadow" ? 20 : 30;
        this.damage(e, s.dmg, (s.vx / sp) * kb, (s.vy / sp) * kb, s.elem, s.kind === "flame");
        if (s.kind === "ember") {
          // the fireball bursts
          this.fx.push({ kind: "boom", x: s.x, y: s.y, t: 0, life: 0.25, r: 14 * this.area, elem: "fire" });
          for (const o of this.around(s.x, s.y + 8, 16 * this.area)) if (o !== e) this.damage(o, s.dmg * 0.5, 0, 0, "fire", true);
        }
        if (s.kind === "water") for (let i = 0; i < 3; i++) this.part(s.x, s.y, rand(-40, 40), rand(-50, 0), "water2", 0.3, 1, 140, "dot");
        if (s.pierce-- <= 0) s.life = 0;
      }
      if (s.kind === "blast" && s.life <= 0) this.blastStar(s);
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
            this.damage(e, f.dmg!, ((e.x - f.x) / d) * 150, ((e.y - f.y) / d) * 150, "water", f.heal != null);
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
          if (!e.dead && segDist(e.x, e.y - 8, f.x, f.y, f.x2, f.y2) < f.r! / 2 + e.r) this.damage(e, f.dmg!, 0, 0, f.elem ?? "normal", true);
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
      if (f.kind === "meteor" && !f.done && f.t >= f.life) {
        f.done = 1;
        this.fx.push({ kind: "boom", x: f.x, y: f.y, t: 0, life: 0.35, r: f.r, elem: "dragon" });
        for (const e of this.around(f.x, f.y, f.r!)) this.damage(e, f.dmg!, (e.x - f.x) * 3, (e.y - f.y) * 3, "dragon", true);
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

  /** the time of day changes with the waves: day, dusk, night (rain, fireflies), dawn */
  get timeOfDay() {
    const c = ((this.wave - 1) % 8) + Math.min(1, ((this.time % WAVE_SECONDS) / WAVE_SECONDS) * 1);
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
    if (n > 0.6) {
      if (Math.random() < 0.9) this.part(cx + rand(-SW / 2, SW / 2) + 30, cy - SH / 2 - 4, -40, 260, "water2", 1.1, 1, 0, "rain");
      if (Math.random() < 0.1) this.part(cx + rand(-SW / 2, SW / 2), cy + rand(-SH / 2, SH / 2), rand(-6, 6), rand(-6, 6), "elec", 3, 1, 0, "firefly");
    } else if (Math.random() < 0.12) this.part(cx + rand(-SW / 2, SW / 2), cy - SH / 2 - 4, rand(-12, 4), rand(10, 18), Math.random() < 0.5 ? "flowerA" : "grassFx", 9, 1, 0, Math.random() < 0.5 ? "petal" : "leaf");
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
    for (const f of this.fx) if (f.kind === "slashwarn" || f.kind === "warn" || f.kind === "cloud" || f.kind === "meteor") this.drawFx(ctx, f, ox, oy);

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
    for (const f of this.fx) if (!["slashwarn", "warn", "cloud", "meteor"].includes(f.kind)) this.drawFx(ctx, f, ox, oy);
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
    for (let ty = ty0; ty <= ty0 + SH / TILE + 1; ty++)
      for (let tx = tx0; tx <= tx0 + SW / TILE + 1; tx++) {
        const h = hash(tx, ty);
        // patches of tall grass and flower meadows, a few tiles wide
        const patch = hash(tx >> 2, ty >> 2);
        let tile: number = h < 0.6 ? T.plain : h < 0.82 ? T.plain2 : h < 0.92 ? T.tuft : h < 0.96 ? T.clover : T.pebble;
        if (patch > 0.86 && h < 0.85) tile = T.tall + ((sway + tx) % 2);
        else if (patch < 0.12 && h < 0.5) tile = (h < 0.25 ? T.flowerA : T.flowerB) + ((sway + tx + ty) % 2);
        ctx.drawImage(g.tiles, tile * TILE, 0, TILE, TILE, tx * TILE + ox, ty * TILE + oy, TILE, TILE);
      }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
    const g = this.gfx;
    const look = this.cur.skin ?? this.dex;
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
    if (this.invuln > 0 && this.hurtT <= 0 && this.dashT <= 0 && Math.floor(this.invuln * 20) % 2) return;
    let name: AnimName = this.moving ? "Walk" : "Idle";
    let t = this.animT;
    if (this.hurtT > 0) {
      name = "Hurt";
      t = 0.3 - this.hurtT;
    } else if (this.basicT > this.starter.basic.every - 0.2 && !this.moving) {
      name = "Shoot";
      t = this.starter.basic.every - this.basicT;
    }
    const a = anim(look, name);
    g.sprite(ctx, look, name, frameAt(a, t, name !== "Shoot"), this.dir, this.x + ox, this.y + oy - 8);
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
    if (e.dead) {
      const life = e.boss ? 1.4 : 0.35;
      const name: AnimName = e.boss ? "Faint" : "Hurt";
      g.sprite(ctx, e.dex, name, frameAt(anim(e.dex, name), e.deadT, false), e.dir, x, y, { alpha: 1 - e.deadT / life, white: !e.boss && e.deadT < 0.12 });
      return;
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
      case "shadow": {
        // Shadow Ball: a dark core, two wisps turning around it, its rim flickering
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
        // the shadow grows where it will land, the meteor falls on it
        const kk = Math.min(1, k);
        ctx.strokeStyle = g.c.dragon;
        ctx.globalAlpha = 0.5;
        ring(ctx, x, y, f.r! * (0.4 + kk * 0.6), 0.5);
        ctx.globalAlpha = 1;
        const my = y - (1 - kk) * 160;
        const mx = x + (1 - kk) * 60;
        ctx.fillStyle = g.c.ink;
        ctx.fillRect(Math.round(mx) - 4, Math.round(my) - 4, 8, 8);
        ctx.fillStyle = g.c.dragon;
        ctx.fillRect(Math.round(mx) - 3, Math.round(my) - 3, 6, 6);
        ctx.fillStyle = g.c.dragon2;
        ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 2, 2, 2);
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
    for (const e of this.enemies) {
      if (e.dead || !(e.boss || e.w?.act === "treasure")) continue;
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
    // wave and its clock
    const left = Math.ceil(WAVE_SECONDS - (this.time % WAVE_SECONDS));
    g.text(ctx, this.tr(`VAGUE ${this.wave}`, `WAVE ${this.wave}`), SW / 2, 8, "gold", { align: "center" });
    g.text(ctx, `0:${String(left).padStart(2, "0")}`, SW / 2, 15, left <= 5 ? "hpLow" : "uiDim", { align: "center" });
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
      const skin = this.cur.skin;
      g.sprite(ctx, skin ?? (showNew ? e.to : e.from), "Idle", frameAt(anim(skin ?? e.from, "Idle"), this.animT), 0, x, y, { white: e.t > 0.6 && !e.cancelled, scale: 2 });
    } else {
      const look = this.cur.skin ?? e.to;
      const a = anim(look, "Pose");
      g.sprite(ctx, look, "Pose", frameAt(a, e.t - 3.2, a.d.length > 1 && animSeconds(a) < 1.8), 0, x, y, { scale: 2 });
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
      STARTERS.forEach((s, i) => {
        const x = 52 + i * 72, y = 118;
        const sel = i === this.selected;
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
        const name: AnimName = sel ? "Walk" : "Idle";
        const dex = sel && this.selectSkin ? this.selectSkin : s.dex;
        g.sprite(ctx, dex, name, frameAt(anim(dex, name), this.menuT * (sel ? 1.4 : 1)), sel ? 0 : 0, x, y + 6 - (sel ? Math.abs(Math.sin(this.menuT * 6)) * 3 : 0), { scale: 2 });
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
const PIX_KEYS: Record<string, ColorKey> = { k: "ink", w: "white", r: "fire", y: "fire2", b: "water", l: "water2", g: "grassFx", G: "grassFx2", a: "elec", c: "xp2" };
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

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + dx * k), py - (ay + dy * k));
}
