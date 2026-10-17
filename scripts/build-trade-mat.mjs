// The trade mat's two pictures (Gemini, img/trade-mat-desk.jpg and img/trade-mat-phone.jpg): the playmat cut out of its
// wooden desk (the wood reached from the picture's edges goes transparent, up to the mat's dark outline), trimmed to the
// mat and saved as public/trade/mat-desk.webp and mat-phone.webp. The zones of components/trade/TradeMat.module.css are
// placed in % of these trimmed pictures: run this again only with the same pictures, or measure the zones again.
// Run: node scripts/build-trade-mat.mjs
import sharp from "sharp";

for (const [name, width] of [
  ["desk", 1600],
  ["phone", 900],
]) {
  const { data, info } = await sharp(`img/trade-mat-${name}.jpg`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  // wood: warm (red over green and blue); the mat is teal
  const wood = (i) => {
    const [r, g, b] = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
    // (warm even in the dark vignette of the corners; the mat and its rim are teal: green over red)
    return r > g + 8 && r > b + 10;
  };
  const out = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const i = stack.pop();
    if (out[i] || !wood(i)) continue;
    out[i] = 1;
    const x = i % W;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (i >= W) stack.push(i - W);
    if (i < W * (H - 1)) stack.push(i + W);
  }
  // only the mat: what is left in one piece with the middle of the picture (a dark spot in the wood goes too)
  const keep = new Uint8Array(W * H);
  stack.push(((H >> 1) * W) + (W >> 1));
  while (stack.length) {
    const i = stack.pop();
    if (keep[i] || out[i]) continue;
    keep[i] = 1;
    const x = i % W;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (i >= W) stack.push(i - W);
    if (i < W * (H - 1)) stack.push(i + W);
  }
  for (let i = 0; i < W * H; i++) out[i] = keep[i] ? 0 : 1;
  // the mat's box, and a soft edge (a pixel next to the wood half see-through)
  let [x0, y0, x1, y1] = [W, H, 0, 0];
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i - x) / W;
    let a = out[i] ? 0 : 255;
    if (a && ((x > 0 && out[i - 1]) || (x < W - 1 && out[i + 1]) || (y > 0 && out[i - W]) || (y < H - 1 && out[i + W]))) a = 140;
    if (a) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    rgba[i * 4] = data[i * 3];
    rgba[i * 4 + 1] = data[i * 3 + 1];
    rgba[i * 4 + 2] = data[i * 3 + 2];
    rgba[i * 4 + 3] = a;
  }
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize({ width })
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(`public/trade/mat-${name}.webp`);
  console.log(`mat-${name}: box ${x0},${y0} ${x1 - x0 + 1}×${y1 - y0 + 1} (ratio ${((x1 - x0 + 1) / (y1 - y0 + 1)).toFixed(3)})`);
}
