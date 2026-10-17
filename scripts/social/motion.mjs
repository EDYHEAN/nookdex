// TikTok (and Instagram Reels) videos of a post, 1080×1920, made from the same slides as its carousel but animated: each
// slide type has its own scene (cards flying in, prices counting up, a countdown from #5 to #1, duels with a VS and a
// 3-2-1, zooms that pull back to the whole card…). Every frame is drawn at an exact time (Web Animations paused and set),
// so the video is smooth whatever the machine. Safe zone: every text stays in the middle band, y 280 to 1250 (Johan,
// 2026-10-13: TikTok and Instagram put their header on top, their caption and buttons at the bottom); only pictures go
// past it.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AVATAR, DESK, FONT_FACES, GRAIN, asset, card, curveSvg, dayOf, dayShort, esc, historyOf, market, plain, setOf, txt, url } from "./lib.mjs";

const FPS = 30;
const W = 1080;
const H = 1920;

/* ---------------- the look and the moves ---------------- */

const CSS = `${FONT_FACES}
* { box-sizing: border-box; margin: 0; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
body { position: relative; font-family: VT, monospace; color: #2b2230; background: #150f1f; }
.bg { position: absolute; inset: -120px; display: grid; grid-template-columns: repeat(var(--n), 1fr);
  filter: blur(50px) saturate(1.3) brightness(0.55); animation: kb 14s linear both; }
.bg div { background-size: cover; background-position: center 30%; }
.dots { position: absolute; inset: 0; background: radial-gradient(rgba(20, 12, 28, 0.3) 1.6px, transparent 1.8px) 0 0 / 16px 16px; }
.stage { position: absolute; inset: 0; }
.shake { animation: shake 0.45s var(--at, 0s) both; }
.top { position: absolute; left: 0; right: 0; top: 0; height: 230px; z-index: 19; background: linear-gradient(rgba(10, 6, 16, .55), transparent); }
.bar { position: absolute; left: 40px; right: 40px; top: 46px; z-index: 20; display: flex; gap: 8px; }
.bar i { flex: 1; height: 8px; border-radius: 4px; background: rgba(244, 236, 220, 0.3); overflow: hidden; }
.bar i.done { background: #f4ecdc; }
.bar i b { display: block; height: 100%; background: #ffd35a; transform-origin: left; animation: fill var(--d) linear both; }
.handle { position: absolute; left: 44px; top: 76px; z-index: 20; display: flex; align-items: center; gap: 12px; font-family: Press; font-size: 20px;
  color: #f4ecdc; text-shadow: 3px 3px 0 #2b2230; }
.handle img { width: 52px; border-radius: 50%; box-shadow: 0 0 0 4px #2b2230; }
.pill { position: absolute; z-index: 6; padding: 16px 24px 12px; background: #f4ecdc; border: 5px solid #2b2230; border-radius: 14px;
  box-shadow: 7px 8px 0 rgba(20, 12, 28, 0.55); font-family: Press; font-size: 28px; line-height: 1.35; white-space: nowrap; }
.sticker { position: absolute; z-index: 7; padding: 14px 24px 10px; background: #ffd35a; border: 6px solid #2b2230; border-radius: 14px;
  font-family: Press; box-shadow: 8px 9px 0 #2b2230; white-space: nowrap; }
.mega { position: absolute; z-index: 6; left: 30px; right: 30px; text-align: center; font-family: Press; color: #f4ecdc; line-height: 1.2;
  -webkit-text-stroke: 3px #2b2230; text-shadow: 0 9px 0 #2b2230, 9px 9px 0 #2b2230, -4px 9px 0 #2b2230, 0 0 60px rgba(0, 0, 0, 0.55); }
.mega .w { display: inline-block; white-space: nowrap; animation: none; }
.mega .w span, .mega > span:not(.w) { display: inline-block; animation: drop 0.55s var(--at) cubic-bezier(.3, 1.6, .5, 1) both; }
.cardimg { display: block; width: 100%; border-radius: 4.5%/3.3%; box-shadow: 0 18px 44px rgba(0, 0, 0, 0.6); }
.float { animation: float 3.2s var(--at, 0s) ease-in-out infinite; }
.glint { position: absolute; inset: 0; border-radius: 4.5%/3.3%; overflow: hidden; pointer-events: none; }
.glint::after { content: ""; position: absolute; inset: -30%; background: linear-gradient(115deg, transparent 40%, rgba(255,255,255,.55) 50%, transparent 60%);
  animation: glint 1.1s var(--at, 1s) ease-in-out both; }
.spark { position: absolute; z-index: 8; color: #ffd35a; font-size: 44px; text-shadow: 0 0 12px rgba(255, 210, 90, 0.9);
  animation: spark 0.9s var(--at) ease-out both; }
.paper { position: absolute; left: 60px; right: 60px; top: 290px; max-height: 960px; overflow: hidden; z-index: 5; display: flex; flex-direction: column; padding: 56px 56px 44px;
  background-color: #f4ecdc; background-image: ${GRAIN}; border: 7px solid #2b2230; border-radius: 26px; box-shadow: 16px 18px 0 rgba(20, 12, 28, 0.5);
  animation: rise 0.6s cubic-bezier(.2, 1.3, .4, 1) both; }
.kicker { font-family: Press; font-size: 26px; color: #a8701a; letter-spacing: 1px; }
.paper h1 { font-family: Press; font-weight: normal; font-size: 54px; line-height: 1.38; margin-top: 30px; overflow-wrap: anywhere; }
.paper h1 em { font-style: normal; color: #b8433d; }
.lead { font-size: 48px; line-height: 1.15; margin-top: 22px; }
.paper ul { list-style: none; padding: 0; margin-top: 30px; }
.paper li { position: relative; padding-left: 50px; font-size: 46px; line-height: 1.12; margin-bottom: 20px; animation: popl 0.45s var(--at) cubic-bezier(.3, 1.6, .5, 1) both; }
.paper li::before { content: "✦"; position: absolute; left: 0; color: #a8701a; }
.shot { margin-top: 40px; border: 6px solid #2b2230; border-radius: 14px; overflow: hidden; box-shadow: 9px 11px 0 rgba(20, 12, 28, 0.35);
  animation: tilt 0.7s var(--at) cubic-bezier(.2, 1.3, .4, 1) both; }
.shot img { display: block; width: 100%; }
.stat { margin-top: 34px; padding: 30px 34px 26px; border: 6px solid #2b2230; border-radius: 18px; background: #fbf5e8; box-shadow: 9px 10px 0 rgba(20, 12, 28, 0.3); }
.stat b { display: block; font-family: Press; font-weight: normal; font-size: 80px; line-height: 1.1; color: #a8701a; white-space: nowrap; }
.stat > span { display: block; margin-top: 10px; font-size: 42px; line-height: 1.05; }
.stat.hero { margin-top: 40px; background: #ffd35a; }
.stat.hero b { font-size: 130px; color: #2b2230; text-shadow: 8px 8px 0 rgba(184, 67, 61, 0.45); }
.stat.hero > span { font-family: Press; font-size: 34px; line-height: 1.35; }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0 28px; }
.stats .stat:nth-child(even) b { color: #b8433d; }
.stats .stat:last-child:nth-child(odd) { grid-column: 1 / -1; }
.timer { position: absolute; left: 120px; right: 120px; z-index: 7; height: 26px; border: 5px solid #2b2230; border-radius: 14px; background: #f4ecdc; overflow: hidden; }
.timer b { display: block; height: 100%; background: #b8433d; transform-origin: left; animation: unfill var(--d) var(--at) linear both; }
.box { position: absolute; border: 8px solid #ffd35a; border-radius: 10px; box-shadow: 0 0 0 4px #2b2230, inset 0 0 0 4px #2b2230;
  animation: pop 0.45s var(--at) cubic-bezier(.3, 1.8, .5, 1) both; }
.mask { position: absolute; left: 3.5%; right: 3.5%; z-index: 3; display: grid; place-items: center; background: #f4ecdc;
  border: 6px solid #2b2230; border-radius: 14px; font-family: Press; font-size: 30px; }
.ring { position: absolute; z-index: 4; width: 260px; height: 260px; margin: -130px 0 0 -130px; border-radius: 50%; border: 10px solid #f4ecdc;
  box-shadow: 0 0 0 5px #2b2230, inset 0 0 0 5px #2b2230; animation: wander 3.6s 0.4s ease-in-out both; }
.ring::after { content: ""; position: absolute; right: -66px; bottom: -66px; width: 90px; height: 22px; background: #2b2230; border-radius: 10px; rotate: 45deg; }

@keyframes kb { from { transform: scale(1.06); } to { transform: scale(1.22) translate(-20px, -30px); } }
@keyframes fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes unfill { from { transform: scaleX(1); } to { transform: scaleX(0); } }
@keyframes drop { from { transform: translateY(-160px) scale(.4); opacity: 0; } 60% { opacity: 1; } to { transform: none; opacity: 1; } }
@keyframes slam { 0% { transform: scale(3.2) rotate(-10deg); opacity: 0; } 50% { transform: scale(.9) rotate(var(--r, 0deg)); opacity: 1; }
  72% { transform: scale(1.07) rotate(var(--r, 0deg)); } 100% { transform: scale(1) rotate(var(--r, 0deg)); opacity: 1; } }
@keyframes fly { from { transform: translate(var(--fx, 0), 1500px) rotate(calc(var(--r, 0deg) + 30deg)); }
  72% { transform: translate(0, -24px) rotate(var(--r, 0deg)); } to { transform: translate(0, 0) rotate(var(--r, 0deg)); } }
@keyframes side { from { transform: translateX(var(--fx)) rotate(calc(var(--r) * 3)); } 70% { transform: translateX(calc(var(--fx) * -0.04)) rotate(var(--r)); }
  to { transform: translateX(0) rotate(var(--r)); } }
@keyframes flip { from { transform: perspective(1400px) rotateY(95deg) scale(.5); opacity: 0; } 15% { opacity: 1; }
  70% { transform: perspective(1400px) rotateY(-12deg) scale(1.04); } to { transform: perspective(1400px) rotateY(0) scale(1); opacity: 1; } }
@keyframes pop { 0% { transform: scale(0) rotate(var(--r, 0deg)); opacity: 0; } 65% { transform: scale(1.14) rotate(var(--r, 0deg)); opacity: 1; }
  100% { transform: scale(1) rotate(var(--r, 0deg)); opacity: 1; } }
@keyframes popl { from { transform: translateX(-60px) scale(.8); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes rise { from { transform: translateY(1400px) rotate(6deg); } to { transform: none; } }
@keyframes tilt { from { transform: translateY(500px) rotate(-14deg); opacity: 0; } to { transform: rotate(-2deg); opacity: 1; } }
@keyframes float { 0%, 100% { translate: 0 0; } 50% { translate: 0 -16px; } }
@keyframes glint { from { translate: -70% 0; } to { translate: 70% 0; } }
@keyframes spark { from { transform: translate(0, 0) scale(0); opacity: 1; } 60% { opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.3); opacity: 0; } }
@keyframes shake { 0%, 100% { translate: 0 0; } 15% { translate: -18px 8px; } 30% { translate: 16px -10px; } 45% { translate: -12px 6px; }
  60% { translate: 10px -4px; } 80% { translate: -4px 2px; } }
@keyframes pulse { 0%, 100% { transform: scale(1) rotate(var(--r, 0deg)); } 50% { transform: scale(1.1) rotate(var(--r, 0deg)); } }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes lose { to { filter: grayscale(1) brightness(.6); transform: scale(.86) rotate(var(--r)); } }
@keyframes win { 0% { transform: rotate(var(--r)); } 60% { transform: scale(1.12) rotate(0deg); } 100% { transform: scale(1.07) rotate(0deg); } }
@keyframes halo { 0%, 100% { box-shadow: 0 0 0 10px #ffd35a, 0 0 60px 20px rgba(255, 211, 90, .5); } 50% { box-shadow: 0 0 0 14px #ffd35a, 0 0 90px 34px rgba(255, 211, 90, .7); } }
@keyframes cam { from { transform: var(--from); } to { transform: none; } }
@keyframes wander { 0% { left: 25%; top: 30%; } 25% { left: 72%; top: 26%; } 50% { left: 30%; top: 62%; } 75% { left: 66%; top: 70%; } 100% { left: 50%; top: 45%; } }
@keyframes drift { from { transform: scale(1); } to { transform: scale(1.08); } }
.chart .line { stroke-dasharray: 1; animation: draw 1.8s 1.1s linear both; }
.chart .dot { animation: pop .3s var(--at) cubic-bezier(.3, 1.8, .5, 1) both; }
.chart .lbl { animation: fade .3s var(--at) both; }
@keyframes draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
`;

/** what moves without CSS: counters and typing, set at each frame's time */
const TICK = `<script>
window.tick = (t) => {
  for (const el of document.querySelectorAll("[data-count]")) {
    const [to, t0, t1] = [+el.dataset.count, +el.dataset.t0, +el.dataset.t1];
    const k = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const v = to * (1 - Math.pow(1 - k, 3));
    el.textContent = el.dataset.fmt === "pct" ? (v < 0 ? "-" : "+") + Math.abs(Math.round(v)) + "%"
      : el.dataset.fmt === "usd" ? "$" + v.toFixed(2) : el.dataset.fmt === "int" ? Math.round(v).toLocaleString("fr-FR").replace(/\u202f/g, "\u00a0")
      : v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }
  for (const el of document.querySelectorAll("[data-type]")) {
    el.__full ??= el.dataset.type;
    const [t0, t1] = [+el.dataset.t0, +el.dataset.t1];
    const n = Math.round(el.__full.length * Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
    el.textContent = el.__full.slice(0, n);
    el.style.visibility = n ? "visible" : "hidden";
  }
  for (const el of document.querySelectorAll("[data-left]")) {
    const left = Math.ceil(+el.dataset.left - (t - +el.dataset.t0));
    el.textContent = t < +el.dataset.t0 ? "" : left > 0 ? left + "…" : el.dataset.end;
  }
};
</script>`;

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
/** a burst of ✦ around (x, y) at a time */
const sparks = (x, y, at, n = 12) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.4;
    const d = 140 + rnd() * 160;
    return `<i class="spark" style="left:${x - 20}px;top:${y - 24}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--at:${(at + rnd() * 0.1).toFixed(2)}s">✦</i>`;
  }).join("");
/** a title written letter by letter, each one dropping in */
const letters = (s, at, step = 0.045) => {
  let i = 0;
  return txt(s)
    .split(/(<br>|<\/?b>|<\/?em>)/)
    .map((part) =>
      part.startsWith("<")
        ? part
        : part
            .split(" ")
            .map((w) => `<span class="w">${[...w].map((ch) => `<span style="--at:${(at + step * i++).toFixed(2)}s">${ch}</span>`).join("")}</span>`)
            .join(" "),
    )
    .join("");
};
const priceAttrs = (n, set, t0, t1) => `data-count="${n ?? 0}" data-t0="${t0}" data-t1="${t1}" data-fmt="${set.currency === "USD" ? "usd" : "eur"}"`;

/** one scene: the blurred art behind, the progress bar, the handle, the content */
const page = (bg, body, i, n, dur, bar = true) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
  <div class="bg" style="--n:${bg.length}">${bg.map((u) => `<div style="background-image:url(${u})"></div>`).join("")}</div><div class="dots"></div>
  <div class="top"></div>${bar ? `<div class="bar">${Array.from({ length: n }, (_, k) => `<i class="${k < i ? "done" : ""}">${k === i ? `<b style="--d:${dur}s"></b>` : ""}</i>`).join("")}</div>` : ""}
  <div class="handle"><img src="${AVATAR}">@nookdex</div>
  ${body}${TICK}</body></html>`;

/* ---------------- the scenes, one per slide type ---------------- */

const SCENES = {
  cover(s) {
    const cards = (s.cards ?? []).map(card);
    const fan = cards
      .map((c, i) => {
        const d = i - (cards.length - 1) / 2;
        const w = d === 0 ? 400 : 330;
        const ghost = (s.ghosts ?? []).includes(i);
        return `<div style="position:absolute;left:${540 - w / 2 + d * 250}px;top:${(d === 0 ? 650 : 700) + Math.abs(d) * 14}px;width:${w}px;z-index:${d === 0 ? 3 : 2};
            --r:${d * 9}deg;--fx:${d * 300}px;animation:fly 0.8s ${(0.6 + i * 0.14).toFixed(2)}s cubic-bezier(.2,1.2,.4,1) both">
          <div class="float" style="--at:${(i * 0.4).toFixed(1)}s"><img class="cardimg" src="${c.hi}" style="${ghost ? "filter:grayscale(.9) sepia(.3);opacity:.9" : ""}">
          ${ghost ? "" : `<div class="glint" style="--at:${(1.6 + i * 0.15).toFixed(2)}s"></div>`}</div></div>`;
      })
      .join("");
    const shot = s.asset
      ? `<img src="${asset(s.asset)}" style="position:absolute;left:90px;width:900px;top:690px;border:7px solid #2b2230;border-radius:16px;--r:-3deg;
          box-shadow:12px 14px 0 rgba(20,12,28,.55);animation:fly 0.8s 0.6s cubic-bezier(.2,1.2,.4,1) both">`
      : "";
    return {
      dur: 3.4,
      bg: cards.length ? cards.map((c) => c.hi) : [asset(s.asset)],
      body: `<div class="stage shake" style="--at:1.55s">
        ${s.kicker ? `<span class="pill" style="left:50%;top:290px;translate:-50% 0;animation:drop .5s .05s cubic-bezier(.3,1.6,.5,1) both">${txt(s.kicker)}</span>` : ""}
        <p class="mega" style="top:390px;font-size:${Math.round((s.size ?? 110) * 0.95)}px">${letters(s.title, 0.2)}</p>
        ${cards.length ? fan : shot}
        ${s.banner ? `<span class="sticker" style="left:50%;top:1160px;translate:-50% 0;font-size:${Math.min(34, Math.floor(880 / s.banner.length))}px;--r:-2deg;animation:slam .5s 1.5s both">${txt(s.banner)}</span>` : ""}
      </div>`,
    };
  },

  paper(s) {
    const cards = (s.cards ?? []).map(card);
    const list = s.list ?? [];
    const t = 1.1;
    return {
      dur: Math.min(7, 2.6 + list.length * 0.55 + (cards.length ? 2 : s.asset ? 1.6 : 0)),
      bg: cards.length ? cards.map((c) => c.hi) : [DESK],
      body: `<div class="paper">
        ${s.kicker ? `<p class="kicker" style="animation:fade .3s .5s both">${txt(s.kicker)}</p>` : ""}
        ${s.title ? `<h1>${letters(s.title, 0.6, 0.03)}${s.em ? `<br><em>${letters(s.em, 0.9, 0.03)}</em>` : ""}</h1>` : ""}
        ${s.lead ? `<p class="lead" style="animation:fade .5s ${t}s both">${txt(s.lead)}</p>` : ""}
        ${list.length ? `<ul>${list.map((l, i) => `<li style="--at:${(t + 0.3 + i * 0.5).toFixed(2)}s">${txt(l)}</li>`).join("")}</ul>` : ""}
        ${
          cards.length
            ? `<div style="display:flex;justify-content:center;margin-top:44px">${cards
                .map((c, i) => {
                  const d = i - (cards.length - 1) / 2;
                  return `<img class="cardimg" src="${c.hi}" style="width:${cards.length > 2 ? 250 : cards.length === 2 ? 320 : 350}px;margin:0 -12px;z-index:${d === 0 ? 2 : 1};--r:${d * 8}deg;
                    animation:fly .7s ${(t + 0.4 + list.length * 0.5 + i * 0.12).toFixed(2)}s cubic-bezier(.2,1.2,.4,1) both">`;
                })
                .join("")}</div>`
            : ""
        }
        ${s.asset ? `<div class="shot" style="--at:${(t + 0.4 + list.length * 0.5).toFixed(2)}s"><img src="${asset(s.asset)}"></div>` : ""}
        ${s.ending ? `<p class="lead" style="margin-top:30px;animation:fade .4s ${(t + 0.8 + list.length * 0.5).toFixed(2)}s both">${txt(s.ending)}</p>` : ""}
      </div>`,
    };
  },

  /** a top's card: its rank slams, it flips in, its price counts up */
  price(s) {
    const c = card(s.card);
    return {
      dur: 3.6,
      bg: [c.hi],
      body: `<div class="stage shake" style="--at:.4s">
        ${s.rank ? `<p class="mega" style="top:270px;font-size:160px;color:#ffd35a;animation:slam .55s .05s both">#${s.rank}</p>` : ""}
        <div style="position:absolute;left:290px;width:500px;top:470px;animation:flip .8s .35s cubic-bezier(.2,1,.4,1) both">
          <div class="float" style="--at:1.2s"><img class="cardimg" src="${c.hi}"><div class="glint" style="--at:1.3s"></div></div></div>
        <span class="pill" style="left:50%;top:1010px;translate:-50% 0;font-size:30px;animation:drop .45s .9s cubic-bezier(.3,1.6,.5,1) both"><span data-type="${esc(s.name ?? c.name)}" data-t0="1" data-t1="1.5"></span></span>
        <span class="sticker" style="left:50%;top:1080px;translate:-50% 0;font-size:58px;--r:-3deg;animation:slam .5s 1.15s both"><span ${priceAttrs(c.price.trend, c.set, 1.2, 2.3)}></span></span>
        ${sparks(540, 1130, 2.3)}
        <p style="position:absolute;left:0;right:0;top:1200px;text-align:center;font-size:32px;color:#f4ecdc;text-shadow:2px 2px 0 #2b2230;animation:fade .4s 2.4s both">
          prix tendance ${market(c.set)} du ${dayOf(c.set)}</p>
      </div>`,
    };
  },

  /** a card's price curve: the card flips in, the line draws itself day by day, the three numbers count */
  curve(s) {
    const hist = historyOf(s.card, s.from);
    const { c, first, last, chg } = hist;
    const days = Math.round((Date.parse(last.day) - Date.parse(first.day)) / 864e5);
    const tile = (left, at, inner, cls = "pill") =>
      `<div class="${cls}" style="left:${left}px;top:1075px;width:300px;text-align:center;white-space:normal;--r:${cls === "sticker" ? -3 : 0}deg;animation:${cls === "sticker" ? "slam" : "pop"} .45s ${at}s both">${inner}</div>`;
    return {
      dur: 5.6,
      bg: [c.hi],
      body: `<div class="stage shake" style="--at:3.4s">
        <span class="pill" style="left:50%;top:290px;translate:-50% 0;animation:drop .5s .05s cubic-bezier(.3,1.6,.5,1) both">${txt(s.kicker ?? plain(c.set.name))}</span>
        <p class="mega" style="top:380px;font-size:${c.name.length > 14 ? 50 : 62}px">${letters(c.name, 0.2, 0.035)}</p>
        <div style="position:absolute;left:46px;top:560px;width:370px;animation:flip .8s .4s cubic-bezier(.2,1,.4,1) both"><img class="cardimg" src="${c.hi}"><div class="glint" style="--at:1.3s"></div></div>
        <div class="chart" style="position:absolute;left:440px;top:540px;padding:18px 18px 6px;background:#f4ecdc;border:6px solid #2b2230;border-radius:20px;
          box-shadow:10px 12px 0 rgba(20,12,28,.5);animation:pop .5s .7s cubic-bezier(.3,1.6,.5,1) both">${curveSvg(hist, 560, 440, { t0: 1.1, t1: 2.9 })}</div>
        ${tile(40, 3, `<span style="font-size:24px">le ${dayShort(first.day)}</span><br><span ${priceAttrs(first.v, c.set, 3, 3.5)}></span>`)}
        ${tile(390, 3.35, `<span style="font-size:24px">${days} jours</span><br><span style="color:${chg >= 0 ? "#3d8b2f" : "#b8433d"};font-size:40px" data-count="${chg.toFixed(1)}" data-t0="3.4" data-t1="4.2" data-fmt="pct"></span>`, "sticker")}
        ${tile(740, 3.2, `<span style="font-size:24px">le ${dayShort(last.day)}</span><br><span ${priceAttrs(last.v, c.set, 3.2, 3.8)}></span>`)}
        ${sparks(540, 1120, 4.2, 12)}
        <p style="position:absolute;left:0;right:0;top:1220px;text-align:center;font-size:32px;color:#f4ecdc;text-shadow:2px 2px 0 #2b2230;animation:fade .4s 4.3s both">
          prix tendance ${market(c.set)}, chaque jour</p>
      </div>`,
    };
  },

  /** what one card of each costs: the sum counts up */
  total(s) {
    const set = setOf(s.set);
    const all = Math.round(set.cards.reduce((t, c) => t + (c.price.trend ?? 0), 0));
    const top = [...set.cards].sort((a, b) => (b.price.trend ?? 0) - (a.price.trend ?? 0)).slice(0, 3);
    return {
      dur: 3.8,
      bg: top.map((c) => `${c.img}/high.webp`),
      body: `<div class="stage shake" style="--at:2.05s">
        <span class="pill" style="left:50%;top:290px;translate:-50% 0;animation:drop .5s .05s cubic-bezier(.3,1.6,.5,1) both">${txt(s.kicker ?? "ET POUR TOUT AVOIR ?")}</span>
        <p class="mega" style="top:380px;font-size:76px">${letters("Une carte<br>de chaque", 0.25)}</p>
        ${top.map((c, i) => `<img class="cardimg" src="${c.img}/high.webp" style="position:absolute;left:${340 + (i - 1) * 220}px;top:${620 + Math.abs(i - 1) * 40}px;width:400px;z-index:${i === 1 ? 3 : 2};--r:${(i - 1) * 10}deg;animation:fly .7s ${(0.6 + i * 0.12).toFixed(2)}s cubic-bezier(.2,1.2,.4,1) both">`).join("")}
        <span class="sticker" style="left:50%;top:1040px;translate:-50% 0;font-size:76px;--r:-3deg;animation:slam .5s 1.2s both">≈ <span data-count="${all}" data-t0="1.25" data-t1="2.05" data-fmt="int"></span> ${set.currency === "USD" ? "$" : "€"}</span>
        ${sparks(540, 1100, 2.05, 16)}
        <p style="position:absolute;left:0;right:0;top:1190px;text-align:center;font-size:38px;color:#f4ecdc;text-shadow:2px 2px 0 #2b2230;animation:fade .4s 2.2s both">
          les ${set.cards.length} cartes de ${esc(set.name)}, cote du ${dayOf(set)}</p>
      </div>`,
    };
  },

  /** big numbers: the paper rises, the tiles slam in one by one and their numbers count up */
  stats(s) {
    const [hero, ...rest] = s.items;
    const t = 0.9;
    const num = (it, at) =>
      typeof it.n === "number" ? `<span data-count="${it.n}" data-t0="${at.toFixed(2)}" data-t1="${(at + 0.9).toFixed(2)}" data-fmt="int"></span>` : esc(String(it.n));
    return {
      dur: 3 + rest.length * 0.55,
      bg: [DESK],
      body: `<div class="paper">
        ${s.kicker ? `<p class="kicker" style="animation:fade .3s .5s both">${txt(s.kicker)}</p>` : ""}
        ${s.title ? `<h1>${letters(s.title, 0.6, 0.03)}</h1>` : ""}
        <div class="stat hero" style="--r:-1.5deg;animation:slam .5s ${t}s both"><b>${num(hero, t + 0.1)}</b><span>${txt(hero.label)}</span></div>
        <div class="stats">${rest
          .map((it, i) => {
            const at = t + 0.9 + i * 0.5;
            return `<div class="stat" style="--r:${i % 2 ? 1.2 : -1.2}deg;animation:slam .45s ${at.toFixed(2)}s both"><b>${num(it, at + 0.05)}</b><span>${txt(it.label)}</span></div>`;
          })
          .join("")}</div>
        ${s.ending ? `<p class="lead" style="margin-top:36px;animation:fade .4s ${(t + 1.1 + rest.length * 0.5).toFixed(2)}s both">${txt(s.ending)}</p>` : ""}
      </div>${sparks(540, 760, t + 1)}`,
    };
  },

  /** a themed page: the cards pop in one by one, then the camera leans in */
  grid(s) {
    const cards = s.cards.map(card);
    const cols = cards.length <= 4 ? 2 : 3;
    const w = cols === 2 ? 760 : 920;
    return {
      dur: 2.2 + cards.length * 0.12,
      bg: cards.filter((_, i) => i % 3 === 0).map((c) => c.hi),
      body: `${s.label ? `<span class="pill" style="left:50%;top:290px;translate:-50% 0;animation:drop .5s .05s cubic-bezier(.3,1.6,.5,1) both">${txt(s.label)}</span>` : ""}
        <div style="position:absolute;left:${(W - w) / 2}px;width:${w}px;top:${s.label ? 400 : 300}px;display:grid;grid-template-columns:repeat(${cols},1fr);gap:16px;
          animation:drift ${(2.2 + cards.length * 0.12).toFixed(1)}s 1.2s linear both">
          ${cards.map((c, i) => `<img class="cardimg" src="${c.hi}" style="--r:${((rnd() - 0.5) * 8).toFixed(1)}deg;animation:pop .45s ${(0.25 + i * 0.12).toFixed(2)}s cubic-bezier(.3,1.6,.5,1) both">`).join("")}
        </div>`,
    };
  },

  /** A or B: the two cards slide in, VS slams, a 3-2-1 to answer */
  duel(s) {
    const [a, b] = [card(s.a), card(s.b)];
    return {
      dur: 5.2,
      bg: [a.hi, b.hi],
      body: `<div class="stage shake" style="--at:.95s">
        <span class="pill" style="left:50%;top:290px;translate:-50% 0;animation:drop .5s .05s cubic-bezier(.3,1.6,.5,1) both">${txt(s.label ?? "DEVINE LE PRIX")}</span>
        <p class="mega" style="top:380px;font-size:54px">${letters(s.question ?? "Laquelle vaut le plus ?", 0.2, 0.025)}</p>
        <div style="position:absolute;left:90px;top:580px;width:420px;--fx:-1100px;--r:-4deg;animation:side .7s .3s cubic-bezier(.2,1.2,.4,1) both">
          <img class="cardimg" src="${a.hi}"><span class="sticker" style="left:-16px;top:-30px;font-size:70px;animation:pop .4s 1.1s cubic-bezier(.3,1.8,.5,1) both">A</span></div>
        <div style="position:absolute;left:570px;top:580px;width:420px;--fx:1100px;--r:4deg;animation:side .7s .45s cubic-bezier(.2,1.2,.4,1) both">
          <img class="cardimg" src="${b.hi}"><span class="sticker" style="right:-16px;top:-30px;font-size:70px;animation:pop .4s 1.2s cubic-bezier(.3,1.8,.5,1) both">B</span></div>
        <p class="mega" style="top:780px;font-size:140px;color:#ffd35a;animation:slam .5s .9s both">VS</p>
        <div class="timer" style="top:1170px;--d:3.6s;--at:1.5s;animation:fade .3s 1.5s both"><b></b></div>
        <span class="pill" style="left:50%;top:1190px;translate:-50% 0;font-size:28px;animation:fade .3s 1.5s both">ta réponse en commentaire <span data-left="3" data-t0="1.5" data-end="!"></span></span>
      </div>`,
    };
  },

  /** the answers, one round a scene: the loser fades, the winner glows, both prices count */
  duelAnswers(s) {
    const rounds = s.rounds.map(([a, b]) => [card(a), card(b)]);
    const set = rounds[0][0].set;
    const scenes = rounds.map(([a, b], i) => {
      const aWins = (a.price.trend ?? 0) > (b.price.trend ?? 0);
      const side = (c, left, wins, letter) => `<div style="position:absolute;left:${left}px;top:560px;width:430px;--r:${left < 400 ? -4 : 4}deg;
          animation:${wins ? "win" : "lose"} .6s .6s cubic-bezier(.3,1.4,.5,1) both">
          <img class="cardimg" src="${c.hi}" style="${wins ? "animation:halo 1.2s 1s ease-in-out infinite;border-radius:24px" : ""}">
          <span class="sticker" style="${left < 400 ? "left:-16px" : "right:-16px"};top:-30px;font-size:60px">${letter}</span>
          <span class="${wins ? "sticker" : "pill"}" style="left:50%;top:500px;translate:-50% 0;font-size:${wins ? 42 : 30}px;z-index:4"><span ${priceAttrs(c.price.trend, c.set, 0.3, 1.4)}></span></span></div>`;
      return {
        dur: 3.2,
        bg: [a.hi, b.hi],
        body: `<span class="pill" style="left:50%;top:290px;translate:-50% 0">REPONSE ${i + 1}/${rounds.length}</span>
          <p class="mega" style="top:380px;font-size:100px;color:#ffd35a;animation:slam .5s .1s both">${aWins ? "A" : "B"} !</p>
          ${side(a, 50, aWins, "A")}${side(b, 560, !aWins, "B")}
          ${sparks(aWins ? 285 : 795, 860, 1.1, 14)}`,
      };
    });
    scenes.push({
      dur: 4.2,
      bg: rounds.map(([a]) => a.hi),
      body: `<div class="paper" style="bottom:auto">
        <p class="kicker">D'OU VIENNENT CES PRIX ?</p>
        <p class="lead" style="margin-top:34px;font-size:48px">C'est le <b>prix tendance ${market(set)}</b> du ${dayOf(set)} : la cote que ${market(set)}
          calcule à partir des ventes récentes de la carte${set.currency === "USD" ? "" : ", toutes langues confondues"}.</p>
        <p class="lead" style="margin-top:30px;font-size:48px;animation:fade .4s 1.6s both">C'est elle que NookDex affiche, mise à jour chaque jour.</p>
        <p class="lead" style="margin-top:44px;font-family:Press;font-size:30px;color:#b8433d;animation:fade .4s 2.4s both">T'as eu combien ?</p>
      </div>`,
    });
    return scenes;
  },

  /** a close-up, the camera drifting, a 3-2-1 */
  zoom(s) {
    const c = card(s.card);
    const [x, y, w, h] = s.rect;
    // the spot fills the height of the screen (it is 4:5, the screen 9:16: it overflows the width a little)
    const k = H / h;
    return {
      dur: 4.4,
      bg: [c.hi],
      body: `<div style="position:absolute;inset:0;overflow:hidden"><div style="position:absolute;inset:0;background:url(${c.hi}) no-repeat;
          background-size:${600 * k}px auto;background-position:${-(x * k) + (W - w * k) / 2}px ${-y * k}px;animation:drift 4.4s linear both"></div></div>
        <span class="pill" style="left:50%;top:290px;translate:-50% 0;animation:drop .5s .05s cubic-bezier(.3,1.6,.5,1) both">${txt(s.label ?? "QUEL POKEMON ?")}</span>
        <span class="sticker" style="left:50%;top:1000px;translate:-50% 0;font-size:110px;--r:-4deg;animation:slam .5s .5s both, pulse 1s 1s ease-in-out infinite">?</span>
        <span class="pill" style="left:50%;top:1170px;translate:-50% 0;font-size:34px;animation:fade .3s 1.2s both"><span data-left="3" data-t0="1.2" data-end="dis-le en commentaire !"></span></span>`,
    };
  },

  /** a Pokémon to find: blurred, a magnifier wandering, a 3-2-1 */
  find(s) {
    const c = card(s.card);
    const [x, y, w, h] = s.blur;
    const pct = (v, of) => `${(v / of) * 100}%`;
    return {
      dur: 4.6,
      bg: [c.hi],
      body: `<span class="pill" style="left:50%;top:280px;translate:-50% 0;animation:drop .5s .05s cubic-bezier(.3,1.6,.5,1) both">${txt(s.label ?? "UN POKEMON FLOU SE CACHE ICI")}</span>
        <div style="position:absolute;left:240px;top:360px;width:600px;animation:flip .7s .1s cubic-bezier(.2,1,.4,1) both"><img class="cardimg" src="${c.hi}">
          <span class="mask" style="top:2.2%;height:6.6%;font-size:38px">? ? ?</span>
          <span style="position:absolute;left:${pct(x, 600)};top:${pct(y, 825)};width:${pct(w, 600)};height:${pct(h, 825)};border-radius:40%;backdrop-filter:blur(10px)"></span>
          ${s.hideText === false ? "" : `<span class="mask" style="top:59%;height:17%">attaques cachées 🤫</span><span class="mask" style="top:84.5%;height:11%;font-size:26px">et les indices aussi 😈</span>`}
          <span class="ring"></span></div>
        <span class="pill" style="left:50%;top:1195px;translate:-50% 0;font-size:30px;animation:fade .3s 1.4s both"><span data-left="3" data-t0="1.4" data-end="lequel ? en commentaire !"></span></span>`,
    };
  },

  /** the answers of zooms and finds: the camera pulls back from the spot to the whole card */
  reveal(s) {
    return s.items.map((it, i) => {
      const c = card(it.card);
      const [rx, ry, rw, rh] = it.rect ?? [0, 0, 600, 825];
      const cw = 620;
      const L = (W - cw) / 2;
      const T = 370;
      const p = cw / 600;
      const S = (H / (rh * p)) * 0.95;
      const cx = (rx + rw / 2) * p;
      const cy = (ry + rh / 2) * p;
      const from = `translate(${(540 - L - S * cx).toFixed(1)}px, ${(960 - T - S * cy).toFixed(1)}px) scale(${S.toFixed(3)})`;
      const pct = (v, of) => `${(v / of) * 100}%`;
      return {
        dur: 3.4,
        bg: [c.hi],
        body: `<div style="position:absolute;left:${L}px;top:${T}px;width:${cw}px;transform-origin:0 0;--from:${from};animation:cam 1.3s .5s cubic-bezier(.65,0,.35,1) both">
            <img class="cardimg" src="${c.hi}">
            ${it.rect ? `<span class="box" style="left:${pct(rx, 600)};top:${pct(ry, 825)};width:${pct(rw, 600)};height:${pct(rh, 825)};--at:1.85s"></span>` : ""}</div>
          <span class="pill" style="left:50%;top:280px;translate:-50% 0">${txt(s.label ?? "LA REPONSE")} ${s.items.length > 1 ? `${i + 1}/${s.items.length}` : ""}</span>
          <span class="sticker" style="left:50%;top:1150px;translate:-50% 0;font-size:56px;--r:-3deg;animation:slam .5s 1.9s both">${esc(it.name ?? c.name)} !</span>
          ${sparks(540, 1190, 2.3, 14)}`,
      };
    });
  },

  end(s) {
    return {
      dur: 3.2,
      bg: [DESK],
      body: `<img src="${AVATAR}" style="position:absolute;left:50%;top:300px;width:260px;margin-left:-130px;border-radius:50%;box-shadow:0 0 0 9px #2b2230,14px 16px 0 9px rgba(20,12,28,.5);
          animation:pop .6s .1s cubic-bezier(.3,1.6,.5,1) both">
        <p class="mega" style="top:620px;font-size:62px">${letters(s.title ?? "Ta collec, sur un bureau cosy", 0.4, 0.03)}</p>
        ${s.lead ? `<p style="position:absolute;left:80px;right:80px;top:860px;text-align:center;font-size:46px;color:#f4ecdc;text-shadow:3px 3px 0 #2b2230;animation:fade .4s 1.2s both">${txt(s.lead)}</p>` : ""}
        <span class="sticker" style="left:50%;top:1010px;translate:-50% 0;font-size:46px;--r:-3deg;animation:slam .5s 1.5s both, pulse 1.2s 2.1s ease-in-out infinite">nookdex.com ▸</span>
        <span class="pill" style="left:50%;top:1140px;translate:-50% 0;font-size:28px;animation:fade .4s 2s both">gratuit · sans pub · abonne-toi ✦</span>`,
    };
  },
};

/* ---------------- drawing ---------------- */

/** the post's scenes: one per slide (a slide type may give several), a closing scene if the post has none */
export function scenesOf(post) {
  const list = post.motion ?? post.slides;
  const out = list.flatMap((s) => {
    const make = SCENES[s.type];
    if (!make) throw new Error(`no motion for slide type ${s.type}`);
    return [make(s)].flat();
  });
  if (!list.some((s) => s.type === "end")) out.push(SCENES.end({ title: post.endTitle ?? "Ta collec Pokémon,<br>sur un bureau cosy" }));
  return out;
}

export async function renderMotion(browser, post, outFile, tmp) {
  seed = 7;
  const scenes = scenesOf(post);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const tab = await browser.newPage({ viewport: { width: W, height: H } });
  let n = 0;
  for (const [i, sc] of scenes.entries()) {
    const html = join(tmp, "scene.html");
    writeFileSync(html, page(sc.bg, sc.body, i, scenes.length, sc.dur));
    await tab.goto(url(html), { waitUntil: "networkidle", timeout: 90000 });
    await tab.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((im) => im.decode().catch(() => {})));
      for (const a of document.getAnimations()) a.pause();
    });
    const frames = Math.round(sc.dur * FPS);
    for (let f = 0; f < frames; f++) {
      await tab.evaluate((ms) => {
        for (const a of document.getAnimations()) a.currentTime = ms;
        window.tick(ms / 1000);
      }, (f / FPS) * 1000);
      await tab.screenshot({ path: join(tmp, `f${String(n++).padStart(5, "0")}.jpg`), type: "jpeg", quality: 88 });
    }
  }
  await tab.close();
  execFileSync(
    process.env.FFMPEG ?? "ffmpeg",
    ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(tmp, "f%05d.jpg"), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outFile],
    { stdio: "inherit" },
  );
  rmSync(tmp, { recursive: true, force: true });
  return { scenes: scenes.length, seconds: scenes.reduce((t, s) => t + s.dur, 0) };
}

/**
 * TikTok's photo mode: the same scenes as the video, each one caught at its last frame (everything in place), 1080×1920,
 * without the progress bar (TikTok draws its own dots). Writes photo-01.jpg… in outDir.
 */
export async function renderStills(browser, post, outDir, tmp) {
  seed = 7;
  const scenes = scenesOf(post);
  mkdirSync(tmp, { recursive: true });
  const tab = await browser.newPage({ viewport: { width: W, height: H } });
  for (const [i, sc] of scenes.entries()) {
    const html = join(tmp, "still.html");
    writeFileSync(html, page(sc.bg, sc.body, i, scenes.length, sc.dur, false));
    await tab.goto(url(html), { waitUntil: "networkidle", timeout: 90000 });
    await tab.evaluate(async (ms) => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((im) => im.decode().catch(() => {})));
      for (const a of document.getAnimations()) {
        a.pause();
        a.currentTime = ms;
      }
      window.tick(ms / 1000);
    }, (sc.still ?? sc.dur - 0.05) * 1000);
    await tab.screenshot({ path: join(outDir, `photo-${String(i + 1).padStart(2, "0")}.jpg`), type: "jpeg", quality: 90 });
  }
  await tab.close();
  rmSync(tmp, { recursive: true, force: true });
  return scenes.length;
}
