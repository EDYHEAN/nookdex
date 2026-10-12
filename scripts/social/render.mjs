// Renders the social posts (Instagram, TikTok) written as JSON on the `social` branch (docs/social.md) into pictures and
// videos, in the site's look: paper and ink, pixel fonts, the cards full screen for the fun ones.
//
//   node scripts/social/render.mjs --social ../social [--prices] [post-id …]
//
// Without ids: every post whose post.json changed since its last render (renders/<id>/hash.txt). --prices also renders
// again the posts that show prices and come out today or tomorrow (the day's prices). Writes renders/index.json, read
// by nookdex.com/studio. Needs Playwright's Chromium (CHROME_PATH to use another) and ffmpeg for the TikTok videos.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { APP, AVATAR, FONT_FACES, GRAIN, asset, card, dayOf, esc, market, money, setAssets, txt, url } from "./lib.mjs";
import { renderMotion, renderStills } from "./motion.mjs";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : null;
};
const SOCIAL = resolve(opt("--social") ?? "../social");
const PRICES = args.includes("--prices") && args.splice(args.indexOf("--prices"), 1);
const NO_VIDEO = args.includes("--no-video") && args.splice(args.indexOf("--no-video"), 1);
const ONLY = args;
const POSTS = join(SOCIAL, "posts");
const RENDERS = join(SOCIAL, "renders");
setAssets(join(SOCIAL, "assets"));

/* ---------------- the look ---------------- */

const FONTS = `${FONT_FACES}
* { box-sizing: border-box; margin: 0; }
html, body { width: 1080px; height: var(--H); overflow: hidden; }
body { position: relative; font-family: VT, monospace; color: #2b2230; background: #150f1f; }`;

/** the paper card on the desk: information slides */
const PAPER_CSS = `${FONTS}
body { background: url(${url(join(APP, "src/assets/share-desk.jpg"))}) center / cover; }
body::before { content: ""; position: absolute; inset: 0; background: rgba(24, 16, 36, 0.38); }
.card { position: absolute; inset: 54px; display: flex; flex-direction: column; padding: 50px 54px 44px;
  background-color: #f4ecdc; background-image: ${GRAIN}; border: 6px solid #2b2230; border-radius: 22px;
  box-shadow: 14px 16px 0 rgba(20, 12, 28, 0.45); }
.top { display: flex; justify-content: space-between; align-items: center; }
.brand { font-family: Press; font-size: 24px; color: #b8433d; }
.count { font-size: 36px; color: #6f6068; }
h1 { font-family: Press; font-weight: normal; font-size: 50px; line-height: 1.4; margin-top: 34px; overflow-wrap: anywhere; }
h1 em { font-style: normal; color: #b8433d; }
.kicker { font-family: Press; font-size: 22px; color: #a8701a; margin-top: 34px; letter-spacing: 1px; }
.lead { font-size: 46px; line-height: 1.15; margin-top: 22px; }
.soft { color: #6f6068; }
.shot { margin-top: auto; border: 5px solid #2b2230; border-radius: 12px; overflow: hidden; box-shadow: 8px 10px 0 rgba(20, 12, 28, 0.35); }
.shot img { display: block; width: 100%; }
.foot { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; font-family: Press; font-size: 20px; }
.foot span:last-child { color: #6f6068; font-family: VT; font-size: 34px; }
ul { list-style: none; padding: 0; margin-top: 30px; }
li { position: relative; padding-left: 46px; font-size: 46px; line-height: 1.12; margin-bottom: 24px; }
li::before { content: "✦"; position: absolute; left: 0; color: #a8701a; }
.cta { margin-top: 26px; display: inline-block; padding: 22px 30px 18px; border: 5px solid #2b2230; border-radius: 12px;
  background: #ffd35a; font-family: Press; font-size: 30px; box-shadow: 7px 7px 0 #2b2230; }
.row { display: flex; gap: 40px; align-items: center; margin: auto 0; }
.row > div { min-width: 0; }
.scan { width: 430px; flex: none; border-radius: 22px; box-shadow: 10px 14px 0 rgba(20, 12, 28, 0.35), 0 0 0 5px #2b2230; }
.rank { font-family: Press; font-size: 120px; color: #b8433d; line-height: 1; }
.mid { font-size: 44px; line-height: 1.15; }
.big { font-family: Press; font-size: 58px; line-height: 1.3; }
.tag { display: inline-block; margin-top: 26px; padding: 14px 22px 10px; background: #ffd35a; border: 5px solid #2b2230; border-radius: 12px;
  font-family: Press; font-size: 34px; box-shadow: 7px 7px 0 #2b2230; transform: rotate(-4deg); }
.credit { font-size: 30px; color: #6f6068; margin-top: 18px; }
.fan { display: flex; justify-content: center; margin-top: auto; padding-bottom: 10px; }
.fan img { width: 300px; border-radius: 15px; box-shadow: 8px 10px 0 rgba(20, 12, 28, 0.35), 0 0 0 4px #2b2230; }
.fan img:nth-child(1):not(:only-child) { transform: rotate(-9deg) translate(40px, 30px); }
.fan img:nth-child(2) { transform: translateY(-6px); z-index: 2; }
.fan img:nth-child(3) { transform: rotate(9deg) translate(-40px, 30px); }
.fan.two img { width: 360px; transform: none !important; margin: 0 18px; }`;

/** full screen: the cards' own art, blurred, under them */
const FULL_CSS = `${FONTS}
.bg { position: absolute; inset: -80px; display: grid; grid-template-columns: repeat(var(--n), 1fr); filter: blur(46px) saturate(1.25) brightness(0.62); }
.bg div { background-size: cover; background-position: center 30%; }
.dots { position: absolute; inset: 0; background: radial-gradient(rgba(20, 12, 28, 0.28) 1.4px, transparent 1.6px) 0 0 / 14px 14px; }
.pill { position: absolute; z-index: 5; padding: 14px 20px 10px; background: #f4ecdc; border: 5px solid #2b2230; border-radius: 12px;
  box-shadow: 6px 7px 0 rgba(20, 12, 28, 0.55); font-family: Press; font-size: 24px; line-height: 1.3; }
.handle { position: absolute; right: 30px; bottom: 22px; z-index: 5; font-family: Press; font-size: 20px; color: #f4ecdc; text-shadow: 3px 3px 0 #2b2230; }
.cardimg { display: block; width: 100%; border-radius: 4.5%/3.3%; box-shadow: 0 14px 34px rgba(0, 0, 0, 0.55); }
.sticker { position: absolute; z-index: 4; padding: 12px 20px 8px; background: #ffd35a; border: 5px solid #2b2230; border-radius: 12px;
  font-family: Press; box-shadow: 6px 7px 0 #2b2230; white-space: nowrap; }
.grid { position: absolute; display: grid; }
.box { position: absolute; border: 6px solid #ffd35a; border-radius: 8px; box-shadow: 0 0 0 3px #2b2230, inset 0 0 0 3px #2b2230; }
.note { position: absolute; z-index: 5; left: 50px; right: 50px; padding: 18px 24px 14px; background: #f4ecdc; border: 5px solid #2b2230;
  border-radius: 12px; font-size: 30px; line-height: 1.15; box-shadow: 6px 7px 0 rgba(20, 12, 28, 0.55); }
.note b { font-family: Press; font-weight: normal; font-size: 20px; color: #a8701a; }
.mega { position: absolute; z-index: 5; left: 30px; right: 30px; text-align: center; font-family: Press; color: #f4ecdc; line-height: 1.18;
  -webkit-text-stroke: 3px #2b2230; text-shadow: 0 8px 0 #2b2230, 8px 8px 0 #2b2230, -4px 8px 0 #2b2230, 0 0 50px rgba(0, 0, 0, 0.5); }
.mask { position: absolute; left: 3.5%; right: 3.5%; z-index: 3; display: grid; place-items: center; background: #f4ecdc;
  border: 5px solid #2b2230; border-radius: 12px; font-family: Press; font-size: 28px; }
.mark { position: absolute; left: 40px; bottom: 24px; z-index: 5; display: flex; align-items: center; gap: 14px; font-family: Press; font-size: 22px;
  color: #f4ecdc; text-shadow: 3px 3px 0 #2b2230; }
.mark img { width: 54px; border-radius: 50%; box-shadow: 0 0 0 4px #2b2230; }`;

const doc = (css, H, body) =>
  `<!doctype html><html style="--H:${H}px"><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`;
const paper = (count, body) =>
  doc(PAPER_CSS, 1350, `<div class="card"><div class="top"><span class="brand">NOOKDEX</span><span class="count">${count}</span></div>${body}
    <div class="foot"><span>nookdex.com</span><span>@_nookdex</span></div></div>`);
const full = (bg, body, H = 1350) =>
  doc(
    FULL_CSS,
    H,
    `<div class="bg" style="--n:${bg.length}">${bg.map((u) => `<div style="background-image:url(${u})"></div>`).join("")}</div>
     <div class="dots"></div>${body}<span class="handle">@_nookdex</span>`,
  );
const avatar = AVATAR;
const pct = (v, of) => `${(v / of) * 100}%`;

/* ---------------- the slide types (docs/social.md) ---------------- */

const SLIDES = {
  /** a carousel's poster, the picture the feed shows */
  cover(s, H) {
    const cards = (s.cards ?? []).map(card);
    const bg = cards.length ? cards.map((c) => c.hi) : [asset(s.asset)];
    const top = H > 1350 ? 300 : 150;
    const y0 = H > 1350 ? 760 : 540;
    const fan = cards
      .map((c, i) => {
        const d = i - (cards.length - 1) / 2;
        const w = d === 0 ? 400 : 340;
        const ghost = (s.ghosts ?? []).includes(i);
        return `<div style="position:absolute;left:${540 - w / 2 + d * 250}px;top:${(d === 0 ? y0 : y0 + 50) + Math.abs(d) * 10}px;width:${w}px;rotate:${d * 9}deg;z-index:${d === 0 ? 3 : 2}">
          <img class="cardimg" src="${c.hi}" style="${ghost ? "filter:grayscale(.9) sepia(.3) brightness(1.05);opacity:.9" : ""}">
          ${ghost ? `<span class="sticker" style="left:10px;top:10px;font-size:40px;padding:6px 12px 2px">★</span>` : ""}</div>`;
      })
      .join("");
    const shot = s.asset
      ? `<img src="${asset(s.asset)}" style="position:absolute;left:90px;width:900px;top:${y0 + 20}px;rotate:-3deg;border:7px solid #2b2230;border-radius:14px;box-shadow:12px 14px 0 rgba(20,12,28,.55)">`
      : "";
    return full(
      bg,
      `${s.kicker ? `<span class="pill" style="left:50%;top:${top - 100}px;translate:-50% 0;white-space:nowrap">${txt(s.kicker)}</span>` : ""}
       <p class="mega" style="top:${top}px;font-size:${s.size ?? 110}px">${txt(s.title)}</p>
       ${cards.length ? fan : shot}
       ${s.banner ? `<span class="sticker" style="left:50%;top:${H > 1350 ? 1520 : 1150}px;translate:-50% 0;rotate:-2deg;font-size:30px;z-index:6">${txt(s.banner)}</span>` : ""}
       <span class="mark"><img src="${avatar}">NOOKDEX</span>`,
      H,
    );
  },
  /** an information slide on the paper card */
  paper(s, H, n) {
    const cards = (s.cards ?? []).map(card);
    return paper(
      n,
      `${s.kicker ? `<p class="kicker">${txt(s.kicker)}</p>` : ""}
       ${s.title ? `<h1>${txt(s.title)}${s.em ? `<br><em>${txt(s.em)}</em>` : ""}</h1>` : ""}
       ${s.lead ? `<p class="lead">${txt(s.lead)}</p>` : ""}
       ${s.list?.length ? `<ul>${s.list.map((l) => `<li>${txt(l)}</li>`).join("")}</ul>` : ""}
       ${cards.length ? `<div class="fan ${cards.length === 2 ? "two" : ""}">${cards.map((c) => `<img src="${c.hi}">`).join("")}</div>` : ""}
       ${s.asset ? `<div class="shot"><img src="${asset(s.asset)}"></div>` : ""}
       ${s.ending ? `<p class="lead" style="margin-top:${cards.length || s.asset ? 22 : "auto"}px">${txt(s.ending)}</p>` : ""}`,
    );
  },
  /** one card and its price (a top 5) */
  price(s, H, n) {
    const c = card(s.card);
    return paper(
      n,
      `${s.kicker ? `<p class="kicker">${txt(s.kicker)}</p>` : ""}<h1>${esc(c.name)}</h1>
       <div class="row"><img class="scan" src="${c.hi}">
         <div>${s.rank ? `<p class="rank">#${s.rank}</p>` : ""}
           <p class="mid soft" style="margin-top:26px">n° ${esc(c.num)}${c.set.official ? `/${c.set.official}` : ""}<br>${esc(c.rarity ?? "")}</p>
           <span class="tag">${money(c.price.trend, c.set)}</span>
           <p class="credit">prix tendance ${market(c.set)}<br>du ${dayOf(c.set)}</p></div></div>`,
    );
  },
  /** what one card of each of a set costs */
  total(s, H, n) {
    const lang = /^(en|ja):/.exec(s.set)?.[1] ?? "fr";
    const id = s.set.replace(/^(en|ja):/, "");
    const set = JSON.parse(readFileSync(join(APP, "public/sets", lang === "fr" ? "" : lang, `${id}.json`), "utf8"));
    const all = set.cards.reduce((t, c) => t + (c.price.trend ?? 0), 0);
    return paper(
      n,
      `<p class="kicker">${txt(s.kicker ?? "ET POUR TOUT AVOIR ?")}</p><h1>Une carte<br><em>de chaque</em></h1>
       <p class="big" style="margin-top:30px;color:#a8701a">≈ ${money(Math.round(all), set).replace(/,00/, "")}</p>
       <p class="lead soft">les ${set.cards.length} cartes de ${esc(set.name)}, à la cote du ${dayOf(set)}</p>
       ${s.asset ? `<div class="shot"><img src="${asset(s.asset)}"></div>` : ""}
       ${s.ending ? `<p class="lead" style="margin-top:${s.asset ? 22 : "auto"}px">${txt(s.ending)}</p>` : ""}`,
    );
  },
  /** a themed page: 9 cards (or 4, 6) full screen */
  grid(s, H) {
    const cards = s.cards.map(card);
    const cols = cards.length <= 4 ? 2 : 3;
    const w = cols === 2 ? 760 : 922;
    return full(
      cards.filter((_, i) => i % 3 === 0).map((c) => c.hi),
      `${s.label ? `<span class="pill" style="left:40px;top:28px">${txt(s.label)}</span>` : ""}
       <div class="grid" style="left:${(1080 - w) / 2}px;width:${w}px;top:${s.label ? 110 : 24}px;grid-template-columns:repeat(${cols},1fr);gap:14px">
         ${cards.map((c) => `<img class="cardimg" src="${c.hi}">`).join("")}</div>`,
      H,
    );
  },
  /** A or B: which one is worth more */
  duel(s, H) {
    const [a, b] = [card(s.a), card(s.b)];
    return full(
      [a.hi, b.hi],
      `<span class="pill" style="left:40px;top:40px">${txt(s.label ?? "DEVINE LE PRIX")}</span>
       <p class="pill" style="left:50%;top:150px;translate:-50% 0;font-size:30px;white-space:nowrap">${txt(s.question ?? "Laquelle vaut le plus ?")}</p>
       <div class="grid" style="left:40px;right:40px;top:290px;grid-template-columns:1fr 1fr;gap:40px">
         <div style="position:relative"><img class="cardimg" src="${a.hi}"><span class="sticker" style="left:-14px;top:-24px;font-size:56px">A</span></div>
         <div style="position:relative"><img class="cardimg" src="${b.hi}"><span class="sticker" style="right:-14px;top:-24px;font-size:56px">B</span></div>
       </div>`,
      H,
    );
  },
  /** the duels' answers, and where the prices come from */
  duelAnswers(s, H) {
    const rounds = s.rounds.map(([a, b]) => [card(a), card(b)]);
    const set = rounds[0][0].set;
    return full(
      rounds.map(([a]) => a.hi),
      `<span class="pill" style="left:40px;top:40px">${txt(s.label ?? "LES REPONSES")}</span>
       <div class="grid" style="left:40px;right:40px;top:150px;grid-template-columns:repeat(${rounds.length},1fr);gap:30px">
         ${rounds
           .map(([a, b], i) => {
             const [w, l, letter] = (a.price.trend ?? 0) > (b.price.trend ?? 0) ? [a, b, "A"] : [b, a, "B"];
             return `<div style="position:relative"><img class="cardimg" src="${w.hi}">
               <span class="sticker" style="left:50%;top:-22px;translate:-50% 0;font-size:24px">${i + 1} : ${letter}</span>
               <p class="pill" style="position:relative;margin-top:18px;font-size:22px;text-align:center">${money(w.price.trend, w.set)}</p>
               <p style="margin-top:12px;font-size:28px;color:#f4ecdc;text-align:center;text-shadow:2px 2px 0 #2b2230">contre ${esc(l.name)}<br>${money(l.price.trend, l.set)}</p></div>`;
           })
           .join("")}
       </div>
       <p class="note" style="bottom:80px"><b>D'OU VIENNENT CES PRIX ?</b><br>
         C'est le prix tendance ${market(set)} du ${dayOf(set)} : la cote que ${market(set)} calcule à partir des ventes récentes de la
         carte${set.currency === "USD" ? "" : ", toutes langues confondues"}. C'est elle que NookDex affiche, mise à jour chaque jour.</p>`,
      H,
    );
  },
  /** a close-up of a card (never on the head: too easy) */
  zoom(s, H) {
    const c = card(s.card);
    const [x, y, w] = s.rect;
    const k = 1080 / w;
    return full(
      [c.hi],
      `<div style="position:absolute;inset:0;background:url(${c.hi}) no-repeat;background-size:${600 * k}px auto;background-position:-${x * k}px -${y * k}px"></div>
       <span class="pill" style="left:40px;top:40px">${txt(s.label ?? "QUEL POKEMON ?")}</span>
       <span class="sticker" style="right:40px;bottom:80px;font-size:80px">?</span>`,
      H,
    );
  },
  /** find the Pokémon: blurred, the card's name, attacks and flavour text covered */
  find(s, H) {
    const c = card(s.card);
    const [x, y, w, h] = s.blur;
    return full(
      [c.hi],
      `<span class="pill" style="left:40px;top:40px">${txt(s.label ?? "UN POKEMON FLOU SE CACHE ICI")}</span>
       <div style="position:absolute;left:50%;top:130px;width:843px;translate:-50% 0"><img class="cardimg" src="${c.hi}">
         <span class="mask" style="top:2.2%;height:6.6%;font-size:34px">? ? ?</span>
         <span style="position:absolute;left:${pct(x, 600)};top:${pct(y, 825)};width:${pct(w, 600)};height:${pct(h, 825)};border-radius:40%;backdrop-filter:blur(9px)"></span>
         ${s.hideText === false ? "" : `<span class="mask" style="top:59%;height:17%">attaques cachées 🤫</span><span class="mask" style="top:84.5%;height:11%;font-size:24px">et les indices aussi 😈</span>`}
       </div>`,
      H,
    );
  },
  /** the answers of zooms and finds: each card, its framed spot */
  reveal(s, H) {
    const items = s.items.map((it) => ({ ...it, c: card(it.card) }));
    const cols = items.length > 2 ? 2 : items.length;
    return full(
      items.map((it) => it.c.hi),
      `<span class="pill" style="left:40px;top:40px">${txt(s.label ?? "LES REPONSES")}</span>
       <div class="grid" style="left:130px;right:130px;top:120px;grid-template-columns:repeat(${cols},1fr);gap:30px 34px">
         ${items
           .map(
             (it, i) => `<div style="position:relative"><img class="cardimg" src="${it.c.hi}">
               ${it.rect ? `<span class="box" style="left:${pct(it.rect[0], 600)};top:${pct(it.rect[1], 825)};width:${pct(it.rect[2], 600)};height:${pct(it.rect[3], 825)}"></span>` : ""}
               <span class="sticker" style="left:50%;bottom:-18px;translate:-50% 0;font-size:18px">${i + 1} · ${esc(it.name ?? it.c.name)}</span></div>`,
           )
           .join("")}
       </div>`,
      H,
    );
  },
  /** the closing slide: one question, the address */
  end(s, H, n) {
    return paper(
      n,
      `<div style="margin:auto 0;text-align:center">
         ${s.kicker ? `<p class="kicker">${txt(s.kicker)}</p>` : ""}
         <h1 style="margin-top:30px">${txt(s.title ?? "Ta collec, sur un bureau cosy")}</h1>
         ${s.lead ? `<p class="lead soft" style="margin-top:24px">${txt(s.lead)}</p>` : ""}
         <span class="cta" style="margin-top:40px">nookdex.com ▸</span></div>`,
    );
  },
};

/* ---------------- rendering ---------------- */

let browser;
const launch = async () => (await import("playwright")).chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
async function shoot(html, out, H) {
  browser ??= await launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: H } });
  const tmp = out.replace(/\.jpg$/, ".html");
  writeFileSync(tmp, html);
  await page.goto(url(tmp), { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out, type: "jpeg", quality: 90 });
  await page.close();
  rmSync(tmp);
}

/** TikTok: the slides one after the other on a 9:16 screen (each over its own blurred copy), with a short crossfade */
function slideshow(files, out, story) {
  const D = 3.2;
  const F = 0.4;
  const inputs = files.flatMap((f) => ["-loop", "1", "-t", String(D), "-i", f]);
  const prep = files
    .map((_, i) =>
      story
        ? `[${i}:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p[v${i}]`
        : `[${i}:v]split[a${i}][b${i}];[a${i}]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:3,eq=brightness=-0.15[bg${i}];[bg${i}][b${i}]overlay=0:(H-h)/2,setsar=1,fps=30,format=yuv420p[v${i}]`,
    )
    .join(";");
  let chain = "";
  let last = "v0";
  for (let i = 1; i < files.length; i++) {
    chain += `;[${last}][v${i}]xfade=transition=fade:duration=${F}:offset=${(i * (D - F)).toFixed(2)}[x${i}]`;
    last = `x${i}`;
  }
  execFileSync(
    process.env.FFMPEG ?? "ffmpeg",
    ["-y", "-loglevel", "error", ...inputs, "-filter_complex", prep + chain, "-map", `[${last}]`, "-c:v", "libx264", "-crf", "21", "-preset", "medium", "-movflags", "+faststart", "-pix_fmt", "yuv420p", out],
    { stdio: "inherit" },
  );
}

const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
const ids = existsSync(POSTS) ? readdirSync(POSTS).filter((d) => existsSync(join(POSTS, d, "post.json"))) : [];
const index = [];
for (const id of ids.sort()) {
  const dir = join(POSTS, id);
  const raw = readFileSync(join(dir, "post.json"), "utf8");
  const post = JSON.parse(raw);
  const out = join(RENDERS, id);
  mkdirSync(out, { recursive: true });
  const hash = createHash("sha1").update(raw).digest("hex");
  const stamp = (f) => (existsSync(join(out, f)) ? readFileSync(join(out, f), "utf8").trim() : null);
  const fresh = PRICES && post.prices && [today, tomorrow].includes(post.date);
  const asked = ONLY.includes(id);
  const story = post.format === "story";
  // the carousel's pictures (a post made by hand keeps its own; a TikTok-only post has none)
  const carousel = (post.platforms ?? ["instagram"]).includes("instagram");
  if (carousel && !post.prerendered && (asked || (!ONLY.length && (stamp("hash.txt") !== hash || fresh)))) {
    console.log(`${id}: ${post.slides.length} slide(s)`);
    for (const f of readdirSync(out)) if (/^slide-/.test(f)) rmSync(join(out, f));
    const H = story ? 1920 : 1350;
    for (const [i, s] of post.slides.entries()) {
      const make = SLIDES[s.type];
      if (!make) throw new Error(`${id}: unknown slide type ${s.type}`);
      await shoot(make(s, H, `${i + 1}/${post.slides.length}`), join(out, `slide-${String(i + 1).padStart(2, "0")}.jpg`), H);
    }
    writeFileSync(join(out, "hash.txt"), hash + "\n");
  }
  // TikTok in photo mode (`"tiktok": "photos"`): the scenes' last frames, 9:16
  const photos = (post.platforms ?? []).includes("tiktok") && post.tiktok === "photos";
  if (photos && !NO_VIDEO && (asked || (!ONLY.length && (stamp("photos.txt") !== hash || fresh)))) {
    browser ??= await launch();
    for (const f of readdirSync(out)) if (/^photo-/.test(f)) rmSync(join(out, f));
    const n = await renderStills(browser, post, out, join(out, ".stills"));
    console.log(`${id}: ${n} TikTok photos`);
    writeFileSync(join(out, "photos.txt"), hash + "\n");
  }
  // the video (TikTok, Reels): animated from the slides (motion.mjs); a post made by hand without slides gets a slideshow
  const video =
    ((post.platforms ?? []).includes("reels") || ((post.platforms ?? []).includes("tiktok") && !photos)) && !story && !existsSync(join(out, "reel.mp4"));
  if (video && !NO_VIDEO && (post.slides || post.motion) && (asked || (!ONLY.length && (stamp("motion.txt") !== hash || fresh)))) {
    browser ??= await launch();
    const r = await renderMotion(browser, post, join(out, "tiktok.mp4"), join(out, ".frames"));
    console.log(`${id}: video, ${r.scenes} scenes, ${r.seconds.toFixed(1)} s`);
    writeFileSync(join(out, "motion.txt"), hash + "\n");
  } else if (video && !NO_VIDEO && !post.slides && !existsSync(join(out, "tiktok.mp4"))) {
    const pics = readdirSync(out).filter((f) => /^slide-\d+\.(jpg|png)$/.test(f)).sort();
    if (pics.length) slideshow(pics.map((f) => join(out, f)), join(out, "tiktok.mp4"), false);
  }
  const rendered = readdirSync(out).sort();
  index.push({
    id,
    date: post.date,
    time: post.time ?? null,
    platforms: post.platforms ?? ["instagram"],
    kind: post.kind ?? null,
    format: post.format ?? "post",
    title: post.title ?? id,
    note: post.note ?? null,
    caption: post.caption ?? "",
    captionTiktok: post.captionTiktok ?? null,
    prices: !!post.prices,
    slides: rendered.filter((f) => /^slide-\d+\.(jpg|png)$/.test(f)).map((f) => `${id}/${f}`),
    photos: rendered.filter((f) => /^photo-\d+\.jpg$/.test(f)).map((f) => `${id}/${f}`),
    tiktokAs: post.tiktok === "photos" ? "photos" : "video",
    video: rendered.includes("reel.mp4") ? `${id}/reel.mp4` : null,
    tiktok: rendered.includes("tiktok.mp4") ? `${id}/tiktok.mp4` : rendered.includes("reel.mp4") ? `${id}/reel.mp4` : null,
  });
}
await browser?.close();
mkdirSync(RENDERS, { recursive: true });
writeFileSync(join(RENDERS, "index.json"), JSON.stringify({ updated: new Date().toISOString(), posts: index }, null, 1) + "\n");
console.log(`index: ${index.length} posts`);
