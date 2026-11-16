// The shop's pictures of a collection, taken from the room itself (Johan, 2026-11-16: cut-outs on their own didn't sell):
// its window as a day / night loop, its lamp as the room without and with its mood, its decor and pack as a snapshot.
// Needs the dev server (npm run dev, ?skip and ?skin are dev shortcuts) and Playwright's Chromium.
//   node scripts/skin-icons.mjs <collection> [http://localhost:3210]
// -> public/skins/<collection>/icon-sky.webp, icon-lamp.webp (animated), icon-decor.webp, preview.webp
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const set = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3210";
if (!set) throw new Error("usage: node scripts/skin-icons.mjs <collection> [dev server]");
const out = `public/skins/${set}`;
const cache = path.join(".cache", "skin-icons");
fs.mkdirSync(cache, { recursive: true });

/** The room at 1400x900, twice the pixels: what's worn (?skin), by day or night, the strips that float over it hidden */
async function shoot(page, skin, day) {
  const file = path.join(cache, `${skin || "none"}-${day ? "day" : "night"}.png`);
  const url = `${base}/?skip&skin${skin ? `=${skin}` : ""}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate((day) => {
    const v = JSON.parse(localStorage.getItem("pokepocket:v1"));
    v.state.daytime = day;
    localStorage.setItem("pokepocket:v1", JSON.stringify(v));
  }, day);
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.addStyleTag({ content: '[class*="Quest"],[class*="SupportCat"]{display:none!important}' });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: file });
  return file;
}

const browser = await chromium.launch(fs.existsSync(process.env.USERPROFILE + "/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe") ? { executablePath: process.env.USERPROFILE + "/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe" } : {});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
const shots = {
  packDay: await shoot(page, set, true),
  packNight: await shoot(page, set, false),
  bare: await shoot(page, "", true),
  lamp: await shoot(page, `${set}-lamp`, true),
  // the sky alone: the pack's lamp mood would tint it
  skyDay: await shoot(page, `${set}-sky`, true),
  skyNight: await shoot(page, `${set}-sky`, false),
};
await browser.close();

// the boxes, in the 2800x1800 screenshot's px (the room at 1400x900, x2)
// the panes, the sky through them (the sill under them would take the picture)
const WINDOW = { left: 90, top: 70, width: 640, height: 480 };
const DESK = { left: 600, top: 660, width: 920, height: 690 };
const DECOR = { left: 40, top: 500, width: 1120, height: 840 };
const SIZE = { width: 480, height: 360 };

const frame = (file, box) => sharp(file).extract(box).resize(SIZE.width, SIZE.height).removeAlpha().raw().toBuffer();
/** A to B and back, faded: held 1.4 s each way */
async function loop(a, b, file) {
  const [A, B] = await Promise.all([a, b]);
  const steps = 10;
  const frames = [], delay = [];
  const mix = (t) => {
    const f = Buffer.alloc(A.length);
    for (let i = 0; i < A.length; i++) f[i] = Math.round(A[i] * (1 - t) + B[i] * t);
    return sharp(f, { raw: { ...SIZE, channels: 3 } }).png().toBuffer();
  };
  for (const [from, to] of [[0, 1], [1, 0]]) {
    frames.push(await mix(from));
    delay.push(1400);
    for (let k = 1; k < steps; k++) {
      frames.push(await mix(from + ((to - from) * k) / steps));
      delay.push(60);
    }
  }
  await sharp(frames, { join: { animated: true } }).webp({ quality: 80, loop: 0, delay }).toFile(file);
}

await loop(frame(shots.skyDay, WINDOW), frame(shots.skyNight, WINDOW), `${out}/icon-sky.webp`);
await loop(frame(shots.bare, DESK), frame(shots.lamp, DESK), `${out}/icon-lamp.webp`);
await sharp(shots.packDay).extract(DECOR).resize(SIZE.width, SIZE.height).webp({ quality: 84 }).toFile(`${out}/icon-decor.webp`);
await sharp(shots.packNight).extract({ left: 0, top: 60, width: 2800, height: 1575 }).resize(960, 540).webp({ quality: 82 }).toFile(`${out}/preview.webp`);
console.log(`${set}: icon-sky, icon-lamp (loops), icon-decor, preview -> ${out}`);
