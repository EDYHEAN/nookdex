"use client";

// Every sound is synthesized with WebAudio: no audio files to ship.

let ctx: AudioContext | null = null;
let master: GainNode;
let sfxBus: GainNode;
let noiseBuf: AudioBuffer;
let muted = false;

function ac(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
  if (ctx) master.gain.setTargetAtTime(m ? 0 : 0.6, ctx.currentTime, 0.05);
}

const semi = (base: number, n: number) => base * Math.pow(2, n / 12);

interface ToneOpts {
  freq: number;
  to?: number;
  type?: OscillatorType;
  dur?: number;
  vol?: number;
  delay?: number;
  attack?: number;
  dest?: AudioNode;
}

function tone({ freq, to, type = "square", dur = 0.08, vol = 0.1, delay = 0, attack = 0.004, dest }: ToneOpts) {
  const c = ac();
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest ?? sfxBus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

interface NoiseOpts {
  dur?: number;
  vol?: number;
  delay?: number;
  type?: BiquadFilterType;
  freq?: number;
  to?: number;
  q?: number;
  attack?: number;
  dest?: AudioNode;
}

function noise({ dur = 0.2, vol = 0.2, delay = 0, type = "bandpass", freq = 1000, to, q = 1, attack = 0.005, dest }: NoiseOpts) {
  const c = ac();
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest ?? sfxBus);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

let lastHover = 0;

export const sfx = {
  hover() {
    const now = performance.now();
    if (now - lastHover < 45) return;
    lastHover = now;
    tone({ freq: 1500 + Math.random() * 200, dur: 0.025, vol: 0.025 });
  },
  click() {
    tone({ freq: 520, to: 260, dur: 0.06, vol: 0.07 });
  },
  pop() {
    tone({ freq: 480, to: 1150, type: "sine", dur: 0.09, vol: 0.18 });
  },
  plus() {
    tone({ freq: 660, dur: 0.05, vol: 0.06 });
    tone({ freq: 990, dur: 0.07, vol: 0.06, delay: 0.05 });
  },
  minus() {
    tone({ freq: 660, dur: 0.05, vol: 0.06 });
    tone({ freq: 440, dur: 0.07, vol: 0.06, delay: 0.05 });
  },
  stamp() {
    noise({ dur: 0.14, vol: 0.5, type: "lowpass", freq: 500 });
    tone({ freq: 120, to: 60, type: "sine", dur: 0.14, vol: 0.35 });
  },
  flip() {
    noise({ dur: 0.32, vol: 0.22, freq: 900, to: 4200, q: 0.8, attack: 0.08 });
    for (let i = 0; i < 3; i++) noise({ dur: 0.02, vol: 0.08, type: "highpass", freq: 5000, delay: 0.05 + Math.random() * 0.25 });
  },
  riffle() {
    noise({ dur: 0.09, vol: 0.14, freq: 1800, to: 4000, q: 0.8, attack: 0.02 });
  },
  shelfOut() {
    noise({ dur: 0.35, vol: 0.18, type: "lowpass", freq: 1400, to: 300 });
    tone({ freq: 110, to: 65, type: "sine", dur: 0.18, vol: 0.3, delay: 0.22 });
  },
  /** The binder falls back down out of the screen. */
  drop() {
    noise({ dur: 0.38, vol: 0.2, freq: 2600, to: 380, q: 0.9, attack: 0.03 });
    tone({ freq: 240, to: 90, type: "triangle", dur: 0.3, vol: 0.06 });
  },
  shelfIn() {
    noise({ dur: 0.25, vol: 0.15, type: "lowpass", freq: 900, to: 250 });
    tone({ freq: 90, to: 50, type: "sine", dur: 0.2, vol: 0.4, delay: 0.12 });
  },
  coverOpen() {
    tone({ freq: 85, to: 60, type: "sine", dur: 0.25, vol: 0.3 });
    noise({ dur: 0.45, vol: 0.12, freq: 700, to: 2600, q: 1.2, attack: 0.1 });
    // ring snap
    tone({ freq: 2400, dur: 0.03, vol: 0.05, delay: 0.05 });
    tone({ freq: 3100, dur: 0.03, vol: 0.04, delay: 0.09 });
  },
  /** Sweeping over the shelf plays a little xylophone. */
  spine(i: number) {
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    tone({ freq: semi(392, scale[i % scale.length]), type: "triangle", dur: 0.14, vol: 0.07 });
  },
  locked() {
    tone({ freq: 190, dur: 0.08, vol: 0.08 });
    tone({ freq: 150, dur: 0.12, vol: 0.08, delay: 0.1 });
  },
  add(combo: number, tier: "common" | "rare" | "legend") {
    const base = semi(523.25, Math.min(combo, 12));
    [0, 4, 7, 12].forEach((n, i) => tone({ freq: semi(base, n), dur: 0.12, vol: 0.07, delay: i * 0.055 }));
    tone({ freq: semi(base, 24), type: "sine", dur: 0.35, vol: 0.06, delay: 0.22 });
    if (tier !== "common") {
      [19, 24, 28, 31, 36].forEach((n, i) =>
        tone({ freq: semi(base, n), type: "sine", dur: 0.25, vol: 0.05, delay: 0.3 + i * 0.06 }),
      );
    }
    if (tier === "legend") {
      const f = 392;
      [[0, 4, 7], [5, 9, 12], [7, 11, 14], [12, 16, 19]].forEach((chord, i) =>
        chord.forEach((n) => tone({ freq: semi(f, n), type: "square", dur: i === 3 ? 0.9 : 0.16, vol: 0.035, delay: 0.7 + i * 0.17 })),
      );
      noise({ dur: 1.2, vol: 0.05, type: "highpass", freq: 6000, delay: 1.2, attack: 0.3 });
    }
  },
  remove() {
    [12, 7, 0].forEach((n, i) => tone({ freq: semi(440, n), dur: 0.1, vol: 0.06, delay: i * 0.07 }));
    noise({ dur: 0.3, vol: 0.12, type: "lowpass", freq: 1200, to: 200, delay: 0.15 });
  },
  bloop() {
    tone({ freq: 180, to: 520, type: "sine", dur: 0.18, vol: 0.2 });
    tone({ freq: 300, to: 900, type: "sine", dur: 0.14, vol: 0.1, delay: 0.12 });
  },
  lamp() {
    noise({ dur: 0.02, vol: 0.3, type: "highpass", freq: 3000 });
    tone({ freq: 1800, dur: 0.015, vol: 0.05 });
    tone({ freq: 60, type: "sine", dur: 0.08, vol: 0.1, delay: 0.01 });
  },
  /** day: a rising chime with birds; night: a falling one with a soft owl hoot */
  dayNight(day: boolean) {
    const notes = day ? [0, 4, 7, 12] : [12, 7, 4, 0];
    notes.forEach((n, i) => tone({ freq: semi(523, n), type: "triangle", dur: 0.22, vol: 0.07, delay: i * 0.07 }));
    if (day) {
      for (let i = 0; i < 3; i++) tone({ freq: 2600, to: 3400, type: "sine", dur: 0.06, vol: 0.03, delay: 0.35 + i * 0.1 });
    } else {
      tone({ freq: 420, to: 380, type: "sine", dur: 0.25, vol: 0.06, delay: 0.4 });
      tone({ freq: 400, to: 360, type: "sine", dur: 0.35, vol: 0.06, delay: 0.7 });
    }
  },
  purr() {
    for (let i = 0; i < 18; i++) noise({ dur: 0.05, vol: 0.14, type: "lowpass", freq: 220, delay: i * 0.045 + Math.floor(i / 6) * 0.12 });
    tone({ freq: 700, to: 1100, type: "sine", dur: 0.25, vol: 0.05, delay: 1.1 });
  },
  boot() {
    tone({ freq: 60, to: 15000, type: "sine", dur: 0.3, vol: 0.02 });
    noise({ dur: 0.25, vol: 0.05, type: "highpass", freq: 4000 });
  },
};

/* ---------------- Ambient lofi radio ---------------- */

let ambientGain: GainNode | null = null;
let schedTimer: number | null = null;
let crackleTimer: number | null = null;
let rainSrc: AudioBufferSourceNode | null = null;
let nextBeat = 0;
let beat = 0;

// Fmaj7 - Em7 - Dm7 - Cmaj7, voiced around A3.
const CHORDS = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 60],
  [48, 52, 55, 59],
];
const PENTA = [72, 74, 76, 79, 81, 84];
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function schedule() {
  if (!ctx || !ambientGain) return;
  const spb = 60 / 72;
  while (nextBeat < ctx.currentTime + 0.4) {
    const t = nextBeat - ctx.currentTime;
    const bar = Math.floor(beat / 4) % CHORDS.length;
    const inBar = beat % 4;
    if (inBar === 0) {
      CHORDS[bar].forEach((n, i) => {
        tone({ freq: midi(n), type: "sine", dur: spb * 4, vol: 0.05, delay: t + i * 0.02, attack: 0.03, dest: ambientGain! });
        tone({ freq: midi(n), type: "triangle", dur: spb * 1.5, vol: 0.012, delay: t + i * 0.02, dest: ambientGain! });
      });
      tone({ freq: midi(CHORDS[bar][0] - 12), type: "sine", dur: spb * 2, vol: 0.09, delay: t, dest: ambientGain! });
    }
    if (inBar === 2) tone({ freq: midi(CHORDS[bar][0] - 12), type: "sine", dur: spb * 1.5, vol: 0.07, delay: t, dest: ambientGain! });
    // drums
    if (inBar === 0 || inBar === 2) tone({ freq: 110, to: 42, type: "sine", dur: 0.28, vol: 0.22, delay: t, dest: ambientGain! });
    if (inBar === 1 || inBar === 3) noise({ dur: 0.16, vol: 0.06, freq: 1700, q: 0.7, delay: t, dest: ambientGain! });
    noise({ dur: 0.03, vol: 0.025, type: "highpass", freq: 7000, delay: t, dest: ambientGain! });
    noise({ dur: 0.03, vol: 0.015, type: "highpass", freq: 7000, delay: t + spb * 0.58, dest: ambientGain! });
    // sparse melody
    if (Math.random() < 0.35) {
      const n = PENTA[Math.floor(Math.random() * PENTA.length)];
      tone({ freq: midi(n), type: "sine", dur: 0.6, vol: 0.035, delay: t + (Math.random() < 0.5 ? 0 : spb / 2), attack: 0.01, dest: ambientGain! });
    }
    nextBeat += spb;
    beat++;
  }
}

function crackle() {
  if (!ambientGain) return;
  noise({ dur: 0.006, vol: 0.05 + Math.random() * 0.06, type: "highpass", freq: 2500, dest: ambientGain });
  crackleTimer = window.setTimeout(crackle, 60 + Math.random() * 380);
}

export function startAmbient() {
  const c = ac();
  if (ambientGain) return;
  ambientGain = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2200;
  ambientGain.gain.setValueAtTime(0, c.currentTime);
  ambientGain.gain.linearRampToValueAtTime(0.8, c.currentTime + 1.5);
  ambientGain.connect(lp).connect(master);

  // rain bed
  rainSrc = c.createBufferSource();
  rainSrc.buffer = noiseBuf;
  rainSrc.loop = true;
  const rf = c.createBiquadFilter();
  rf.type = "lowpass";
  rf.frequency.value = 1100;
  const rg = c.createGain();
  rg.gain.value = 0.05;
  rainSrc.connect(rf).connect(rg).connect(ambientGain);
  rainSrc.start();

  nextBeat = c.currentTime + 0.1;
  beat = 0;
  schedTimer = window.setInterval(schedule, 100);
  crackle();
}

export function stopAmbient() {
  if (!ctx || !ambientGain) return;
  const g = ambientGain;
  const src = rainSrc;
  g.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
  if (schedTimer) clearInterval(schedTimer);
  if (crackleTimer) clearTimeout(crackleTimer);
  schedTimer = crackleTimer = null;
  ambientGain = null;
  rainSrc = null;
  window.setTimeout(() => {
    src?.stop();
    g.disconnect();
  }, 1500);
}
