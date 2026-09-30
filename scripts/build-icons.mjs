// Site icons and share image, from the capture ball of the logo and the painted room.
//
//   npm run build-icons
//
// Output (Next.js picks the app/ files up and writes the <link> / <meta> tags itself):
//   src/app/favicon.ico            16, 32, 48 px (what Google and old browsers ask for at /favicon.ico)
//   src/app/icon.png               192 px (Google recommends a multiple of 48 px, square)
//   src/app/apple-icon.png         180 px, on paper (iOS doesn't do transparency)
//   public/icon-512.png            for the web app manifest
//   public/icon-maskable-512.png   same, with the safe zone Android's round masks need
//   src/app/opengraph-image.jpg    1200 x 630, the sunny room, for shared links
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const INK = "#2b2230";
const PAPER = "#f3ead9";
const ball = await sharp("public/scene/logo-ball.webp").trim().toBuffer();

/** The ball alone, transparent around. Small sizes get an ink ring so it reads on light and dark tabs. */
async function roundIcon(size) {
  const ring = size <= 48 ? Math.max(1, Math.round(size / 16)) : 0;
  const inner = size - ring * 2;
  const b = await sharp(ball).resize(inner, inner).png().toBuffer();
  const circle = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 0.3}" fill="${INK}"/></svg>`);
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([...(ring ? [{ input: circle }] : []), { input: b, left: ring, top: ring }])
    .png()
    .toBuffer();
}

/** The ball on a square of paper (ratio = ball size / square size). */
async function paperIcon(size, ratio, rounded) {
  const inner = Math.round(size * ratio);
  const b = await sharp(ball).resize(inner, inner).png().toBuffer();
  const r = rounded ? size * 0.22 : 0;
  const bg = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="${PAPER}"/></svg>`);
  return sharp(bg)
    .composite([{ input: b, left: Math.round((size - inner) / 2), top: Math.round((size - inner) / 2) }])
    .png()
    .toBuffer();
}

/** .ico with PNG entries (supported everywhere since Windows Vista). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

const small = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await roundIcon(size) })));
await writeFile("src/app/favicon.ico", ico(small));
await writeFile("src/app/icon.png", await roundIcon(192));
await writeFile("src/app/apple-icon.png", await paperIcon(180, 0.78, false));
await writeFile("public/icon-512.png", await paperIcon(512, 0.8, true));
await writeFile("public/icon-maskable-512.png", await paperIcon(512, 0.6, false));

// share image: the sunny room, with the logo on a strip of paper taped over it
{
  const W = 1200, H = 630;
  const room = await sharp("public/scene/day.webp").extract({ left: 250, top: 120, width: 2400, height: 1260 }).resize(W, H).toBuffer();
  const lw = 560, lh = Math.round((lw * 600) / 2260);
  const logo = await sharp("img/logo.jpg").extract({ left: 290, top: 470, width: 2260, height: 600 }).resize(lw, lh).toBuffer();
  const pad = 18;
  const card = { w: lw + pad * 2, h: lh + pad * 2 };
  const cx = Math.round((W - card.w) / 2), cy = 34;
  const shadow = Buffer.from(
    `<svg width="${W}" height="${H}"><rect x="${cx + 8}" y="${cy + 10}" width="${card.w}" height="${card.h}" rx="6" fill="rgba(40,20,30,0.35)"/>` +
      `<rect x="${cx}" y="${cy}" width="${card.w}" height="${card.h}" rx="6" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>` +
      `<rect x="${W / 2 - 55}" y="${cy - 12}" width="110" height="26" fill="rgba(255,226,150,0.8)" transform="rotate(-3 ${W / 2} ${cy})"/></svg>`,
  );
  await sharp(room)
    .composite([{ input: shadow }, { input: logo, left: cx + pad, top: cy + pad }])
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile("src/app/opengraph-image.jpg");
}

console.log("icons: favicon.ico (16/32/48), icon.png 192, apple-icon.png 180, icon-512, icon-maskable-512, opengraph-image.jpg");
