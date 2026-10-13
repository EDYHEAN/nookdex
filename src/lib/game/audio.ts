// The NookBoy's sounds: chiptune blips on the room's synth (muted with it), and a lofi chiptune loop. No audio files.

import { synth } from "@/lib/sound";

const { tone, noise, semi } = synth;
let bus: GainNode | null = null;
let musicBus: GainNode | null = null;
const out = () => (bus ??= synth.bus(0.55));

/** many hits in one frame: one sound */
const last = new Map<string, number>();
const throttle = (key: string, ms: number) => {
  const now = performance.now();
  if (now - (last.get(key) ?? 0) < ms) return false;
  last.set(key, now);
  return true;
};
let candyStreak = 0;
let candyAt = 0;

export const gsfx = {
  move() {
    tone({ freq: 880, dur: 0.03, vol: 0.05, dest: out() });
  },
  ok() {
    tone({ freq: 660, dur: 0.05, vol: 0.06, dest: out() });
    tone({ freq: 1320, dur: 0.08, vol: 0.06, delay: 0.05, dest: out() });
  },
  back() {
    tone({ freq: 520, to: 330, dur: 0.08, vol: 0.06, dest: out() });
  },
  /** the boot "ding" */
  boot() {
    tone({ freq: 1046, type: "square", dur: 0.08, vol: 0.06, dest: out() });
    tone({ freq: 2093, type: "square", dur: 0.6, vol: 0.05, delay: 0.08, dest: out() });
  },
  shoot(kind: string) {
    if (!throttle("shoot", 90)) return;
    if (kind === "ember") noise({ dur: 0.12, vol: 0.06, freq: 900, to: 300, dest: out() });
    else if (kind === "water") noise({ dur: 0.06, vol: 0.05, type: "highpass", freq: 2500, dest: out() });
    else if (kind === "bolt") tone({ freq: 1800, to: 600, type: "sawtooth", dur: 0.06, vol: 0.025, dest: out() });
    else noise({ dur: 0.08, vol: 0.06, freq: 2200, to: 800, q: 2, dest: out() });
  },
  hit(crit = false) {
    if (!throttle("hit", 45)) return;
    tone({ freq: crit ? 260 : 180, to: 80, dur: 0.05, vol: crit ? 0.07 : 0.045, dest: out() });
    if (crit) noise({ dur: 0.05, vol: 0.06, type: "highpass", freq: 3000, dest: out() });
  },
  faint() {
    if (!throttle("faint", 60)) return;
    tone({ freq: 700, to: 200, type: "square", dur: 0.09, vol: 0.035, dest: out() });
  },
  /** candies picked in a row climb the scale */
  candy() {
    const now = performance.now();
    candyStreak = now - candyAt < 400 ? Math.min(candyStreak + 1, 14) : 0;
    candyAt = now;
    if (!throttle("candy", 35)) return;
    tone({ freq: semi(988, [0, 2, 4, 7, 9][candyStreak % 5] + 12 * Math.floor(candyStreak / 5)), dur: 0.05, vol: 0.035, dest: out() });
  },
  /** a Nugget: a little cash-register ding */
  coin() {
    if (!throttle("coin", 50)) return;
    tone({ freq: 1568, dur: 0.05, vol: 0.04, dest: out() });
    tone({ freq: 2093, dur: 0.12, vol: 0.04, delay: 0.05, dest: out() });
  },
  heal() {
    [0, 4, 7, 12].forEach((n, i) => tone({ freq: semi(784, n), type: "triangle", dur: 0.1, vol: 0.06, delay: i * 0.05, dest: out() }));
  },
  hurt() {
    noise({ dur: 0.12, vol: 0.12, type: "lowpass", freq: 1200, dest: out() });
    tone({ freq: 220, to: 110, dur: 0.12, vol: 0.06, dest: out() });
  },
  levelUp() {
    [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => tone({ freq: semi(523, n), dur: 0.09, vol: 0.05, delay: i * 0.07, dest: out() }));
  },
  learn() {
    [0, 7, 12].forEach((n, i) => tone({ freq: semi(659, n), type: "triangle", dur: 0.12, vol: 0.07, delay: i * 0.06, dest: out() }));
  },
  /** the evolution: a rising wobble, then the fanfare */
  evolveStart() {
    for (let i = 0; i < 16; i++) tone({ freq: semi(392, (i % 4) * 3 + Math.floor(i / 4) * 2), type: "triangle", dur: 0.12, vol: 0.05, delay: i * 0.14, dest: out() });
  },
  evolveDone() {
    [[0, 4, 7], [5, 9, 12], [7, 11, 14], [12, 16, 19]].forEach((ch, i) =>
      ch.forEach((n) => tone({ freq: semi(392, n), dur: i === 3 ? 0.8 : 0.15, vol: 0.035, delay: i * 0.16, dest: out() })),
    );
  },
  thunder() {
    noise({ dur: 0.35, vol: 0.1, type: "lowpass", freq: 2500, to: 200, dest: out() });
    tone({ freq: 90, to: 40, type: "sine", dur: 0.3, vol: 0.12, dest: out() });
  },
  fire() {
    noise({ dur: 0.9, vol: 0.06, freq: 600, to: 1500, q: 0.6, attack: 0.1, dest: out() });
  },
  wave() {
    noise({ dur: 0.7, vol: 0.08, freq: 400, to: 2400, q: 0.5, attack: 0.15, dest: out() });
  },
  quake() {
    tone({ freq: 70, to: 30, type: "sine", dur: 0.6, vol: 0.2, dest: out() });
    noise({ dur: 0.5, vol: 0.12, type: "lowpass", freq: 400, dest: out() });
  },
  zap() {
    if (!throttle("zap", 60)) return;
    tone({ freq: 2400, to: 1200, type: "square", dur: 0.05, vol: 0.03, dest: out() });
  },
  shield() {
    tone({ freq: 440, to: 880, type: "sine", dur: 0.25, vol: 0.08, dest: out() });
  },
  boom() {
    noise({ dur: 0.4, vol: 0.16, type: "lowpass", freq: 900, to: 120, dest: out() });
    tone({ freq: 120, to: 40, type: "sine", dur: 0.3, vol: 0.15, dest: out() });
  },
  enemyShot() {
    if (!throttle("eshot", 120)) return;
    tone({ freq: 500, to: 900, type: "triangle", dur: 0.06, vol: 0.03, dest: out() });
  },
  /** the start of a wave: a little bell */
  waveStart() {
    tone({ freq: 1568, type: "triangle", dur: 0.4, vol: 0.06, dest: out() });
    tone({ freq: 2093, type: "triangle", dur: 0.5, vol: 0.05, delay: 0.12, dest: out() });
  },
  boss() {
    for (let i = 0; i < 3; i++) {
      tone({ freq: 196, type: "square", dur: 0.18, vol: 0.06, delay: i * 0.3, dest: out() });
      tone({ freq: 185, type: "square", dur: 0.18, vol: 0.06, delay: i * 0.3 + 0.15, dest: out() });
    }
  },
  gameOver() {
    [12, 7, 4, 0, -5].forEach((n, i) => tone({ freq: semi(392, n), type: "triangle", dur: i === 4 ? 0.8 : 0.22, vol: 0.08, delay: i * 0.22, dest: out() }));
  },
  rare() {
    [12, 16, 19, 24, 28].forEach((n, i) => tone({ freq: semi(523, n), type: "sine", dur: 0.2, vol: 0.05, delay: i * 0.05, dest: out() }));
  },
};

/* ---------------- the music: a lofi chiptune loop, faster and darker in a boss wave ---------------- */

// Am7 - Fmaj7 - Cmaj7 - G6 (calm), Am - F - Dm - E (boss)
const CALM = [
  [57, 60, 64, 67],
  [53, 57, 60, 64],
  [48, 52, 55, 59],
  [55, 59, 62, 64],
];
const BOSS = [
  [57, 60, 64],
  [53, 57, 60],
  [50, 53, 57],
  [52, 56, 59],
];
// a melody that loops over the four bars (8 steps a bar, -1 = rest)
const MELODY = [
  [76, -1, 72, -1, 74, 76, -1, -1],
  [72, -1, 69, -1, 67, -1, 69, -1],
  [67, -1, 64, 67, -1, 72, -1, -1],
  [71, -1, 74, -1, 71, 67, -1, -1],
];
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

let timer: number | null = null;
let next = 0;
let step = 0;
let boss = false;

function schedule() {
  if (!musicBus) return;
  const now = synth.now();
  const spb = 60 / (boss ? 116 : 84) / 2;
  while (next < now + 0.3) {
    const t = next - now;
    const bar = Math.floor(step / 8) % 4;
    const s = step % 8;
    const chords = boss ? BOSS : CALM;
    const dest = musicBus;
    if (s === 0) {
      chords[bar].forEach((n, i) => tone({ freq: midi(n), type: "triangle", dur: spb * 7, vol: 0.022, delay: t + i * 0.015, attack: 0.04, dest }));
      tone({ freq: midi(chords[bar][0] - 24), type: "triangle", dur: spb * 3, vol: 0.09, delay: t, dest });
    }
    if (s === 4 || (boss && s % 2 === 0 && s !== 0)) tone({ freq: midi(chords[bar][boss ? 0 : 2] - 24), type: "triangle", dur: spb * 2, vol: 0.07, delay: t, dest });
    // drums: a soft kick, a brushed snare, a ticking hat (swung)
    if (s === 0 || s === 5 || (boss && s === 3)) tone({ freq: 120, to: 45, type: "sine", dur: 0.2, vol: 0.16, delay: t, dest });
    if (s === 2 || s === 6) noise({ dur: 0.12, vol: 0.045, freq: 1600, q: 0.6, delay: t, dest });
    noise({ dur: 0.025, vol: s % 2 ? 0.012 : 0.02, type: "highpass", freq: 7000, delay: t + (s % 2 ? spb * 0.16 : 0), dest });
    const note = MELODY[bar][s];
    if (note > 0 && !(boss && s % 4 === 2)) tone({ freq: midi(boss ? note - 3 : note), type: "square", dur: spb * 1.6, vol: 0.016, delay: t, dest });
    next += spb;
    step++;
  }
}

export const music = {
  start() {
    if (timer) return;
    musicBus = synth.bus(0.9, 1800);
    next = synth.now() + 0.1;
    step = 0;
    timer = window.setInterval(schedule, 80);
  },
  stop() {
    if (timer) clearInterval(timer);
    timer = null;
    const b = musicBus;
    musicBus = null;
    if (b) {
      b.gain.setTargetAtTime(0, synth.now(), 0.1);
      setTimeout(() => b.disconnect(), 800);
    }
  },
  boss(on: boolean) {
    boss = on;
  },
  get on() {
    return timer != null;
  },
};
