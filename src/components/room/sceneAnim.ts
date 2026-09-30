// Hand-drawn style animations for the painted room, rendered at a low frame rate on purpose.

type Ctx = CanvasRenderingContext2D;

/* ---------------- rain on the window (canvas at half resolution) ---------------- */

const drops = Array.from({ length: 80 }, () => ({
  x: Math.random() * 360,
  y: Math.random() * 350,
  v: 14 + Math.random() * 10,
  len: 8 + Math.random() * 10,
}));
const beads = Array.from({ length: 16 }, () => ({
  x: Math.random() * 320,
  y: Math.random() * 350,
  v: 0.6 + Math.random() * 2.2,
  r: 1.2 + Math.random() * 1.4,
}));

export function drawRain(c: Ctx, t: number) {
  const { width: w, height: h } = c.canvas;
  c.clearRect(0, 0, w, h);
  c.lineCap = "round";
  for (const d of drops) {
    d.y += d.v;
    d.x -= d.v * 0.18;
    if (d.y > h + 20) {
      d.y = -20;
      d.x = Math.random() * (w + 40);
    }
    c.strokeStyle = "rgba(214,226,255,0.45)";
    c.lineWidth = 1.1;
    c.beginPath();
    c.moveTo(d.x, d.y);
    c.lineTo(d.x + d.len * 0.18, d.y - d.len);
    c.stroke();
  }
  // droplets sliding down the glass, with a little wet trail
  for (const b of beads) {
    b.y += b.v * (0.6 + 0.4 * Math.sin(t / 700 + b.x));
    if (b.y > h + 6) {
      b.y = -6;
      b.x = Math.random() * w;
    }
    c.strokeStyle = "rgba(200,215,255,0.22)";
    c.lineWidth = b.r * 0.9;
    c.beginPath();
    c.moveTo(b.x, b.y - 14);
    c.lineTo(b.x, b.y);
    c.stroke();
    c.fillStyle = "rgba(235,242,255,0.75)";
    c.beginPath();
    c.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    c.fill();
  }
}

/* ---------------- lava lamp blobs ---------------- */

export const LAVA_THEMES = [
  { name: "rose bonbon", fill: "#f39bd0", light: "#ffd6ef", line: "#7a2f63", glow: "rgba(255,120,200,0.30)" },
  { name: "orange seventies", fill: "#ffae5c", light: "#ffe0b3", line: "#7a3b12", glow: "rgba(255,160,80,0.30)" },
  { name: "slime radioactif", fill: "#a6f07a", light: "#e2ffd0", line: "#2f6b1c", glow: "rgba(150,255,110,0.26)" },
  { name: "bleu cosmique", fill: "#7fd6ff", light: "#d9f4ff", line: "#1f4f7a", glow: "rgba(110,200,255,0.28)" },
];
type Theme = (typeof LAVA_THEMES)[number];

const blobs = [
  { phase: 0, speed: 1, r: 12 },
  { phase: 2.3, speed: 0.72, r: 8 },
  { phase: 4.1, speed: 0.86, r: 10 },
];

/** rows[y] = [x0, x1]: the inside of the painted glass, row by row. */
export function drawLava(c: Ctx, t: number, th: Theme, rows: number[][]) {
  const { width: w, height: h } = c.canvas;
  c.clearRect(0, 0, w, h);
  const widest = Math.max(...rows.map(([a, b]) => b - a));
  let bottom = rows.length - 1;
  while (bottom > 0 && rows[bottom][1] - rows[bottom][0] < widest * 0.6) bottom--;
  const top = rows.findIndex(([a, b]) => b - a > 12);
  const span = (y: number) => rows[Math.max(0, Math.min(rows.length - 1, Math.round(y)))];

  const shapes: [number, number, number, number][] = [];
  for (const [i, b] of blobs.entries()) {
    const k = (Math.sin(t / (3400 / b.speed) + b.phase) + 1) / 2;
    const y = top + b.r + 6 + (1 - k) * (bottom - top - b.r * 2 - 30);
    const [x0, x1] = span(y);
    const room = Math.max(0, (x1 - x0) / 2 - b.r - 4);
    const x = (x0 + x1) / 2 + Math.sin(t / 1300 + i * 2) * room;
    // stretched when moving fast, round when turning around
    const stretch = 1 + Math.abs(Math.cos(t / (3400 / b.speed) + b.phase)) * 0.3;
    shapes.push([x, y, b.r, b.r * stretch]);
  }
  const ellipse = (x: number, y: number, rx: number, ry: number) => {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  };
  // the pool resting at the bottom: filled row by row inside the glass, with a gently waving surface
  const surface = (x: number) => bottom - 16 + Math.sin(x / 9 + t / 700) * 1.6;
  c.fillStyle = th.fill;
  for (let y = Math.floor(bottom - 20); y <= bottom; y++) {
    const [x0, x1] = span(y);
    for (let x = x0; x <= x1; x++) if (y >= surface(x)) c.fillRect(x, y, 1, 1);
  }
  c.strokeStyle = th.line;
  c.lineWidth = 2.2;
  c.beginPath();
  const [s0, s1] = span(bottom - 16);
  for (let x = s0; x <= s1; x++) (x === s0 ? c.moveTo : c.lineTo).call(c, x, surface(x));
  c.stroke();

  // blobs: outline pass, then fill pass, so merged blobs share a single outline
  c.fillStyle = th.line;
  for (const [x, y, rx, ry] of shapes) ellipse(x, y, rx + 2.2, ry + 2.2);
  c.fillStyle = th.fill;
  for (const [x, y, rx, ry] of shapes) ellipse(x, y, rx, ry);
  c.fillStyle = th.light;
  for (const [x, y, rx, ry] of shapes) ellipse(x - rx * 0.35, y - ry * 0.4, rx * 0.28, ry * 0.22);
}

/* ---------------- dust floating in the lamp light (half resolution) ---------------- */

const motes = Array.from({ length: 46 }, () => ({
  x: Math.random() * 500,
  y: Math.random() * 300,
  vx: (Math.random() - 0.5) * 0.4,
  vy: -0.15 - Math.random() * 0.35,
  p: Math.random() * 6,
  r: 0.7 + Math.random() * 1.3,
}));

export function drawDust(c: Ctx, t: number, lampOn: boolean) {
  const { width: w, height: h } = c.canvas;
  c.clearRect(0, 0, w, h);
  for (const m of motes) {
    m.x += m.vx + Math.sin(t / 1800 + m.p) * 0.25;
    m.y += m.vy;
    if (m.y < -4) {
      m.y = h + 4;
      m.x = Math.random() * w;
    }
    // brighter in the cone of light under the lamp (upper right of this canvas)
    const inLight = lampOn ? Math.max(0, 1 - Math.hypot(m.x - w * 0.62, m.y - h * 0.45) / (w * 0.45)) : 0;
    const tw = (Math.sin(t / 600 + m.p) + 1) / 2;
    c.globalAlpha = lampOn ? 0.15 + inLight * 0.75 * (0.5 + tw / 2) : 0.12 * tw;
    c.fillStyle = lampOn ? "#fff1c9" : "#c9d4ff";
    c.beginPath();
    c.arc(m.x, m.y, m.r + inLight * 0.8, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
}

/* ---------------- dust in the afternoon sunbeams (canvas at half resolution) ---------------- */

const sunMotes = Array.from({ length: 70 }, () => ({
  x: Math.random() * 650,
  y: Math.random() * 400,
  vx: 0.15 + Math.random() * 0.35,
  vy: -0.05 - Math.random() * 0.18,
  r: 0.8 + Math.random() * 1.6,
  p: Math.random() * Math.PI * 2,
}));

/** Specks of dust drifting up and to the right, catching the light as they turn. */
export function drawSunDust(c: Ctx, t: number) {
  const { width: w, height: h } = c.canvas;
  c.clearRect(0, 0, w, h);
  c.fillStyle = "#fff4d6";
  for (const m of sunMotes) {
    m.x += m.vx + Math.sin(t / 1500 + m.p) * 0.3;
    m.y += m.vy + Math.cos(t / 1900 + m.p) * 0.12;
    if (m.x > w + 4) m.x = -4;
    if (m.y < -4) m.y = h + 4;
    const tw = (Math.sin(t / 520 + m.p * 3) + 1) / 2;
    c.globalAlpha = 0.25 + tw * 0.6;
    c.beginPath();
    c.arc(m.x, m.y, m.r * (0.7 + tw * 0.5), 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
}
