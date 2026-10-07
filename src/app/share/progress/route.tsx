import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import rawEn from "@/data/catalog-en.json";
import rawFr from "@/data/catalog.json";
import rawJa from "@/data/catalog-ja.json";
import { findCard } from "@/lib/blog";
import { bareId, type CardLang, langOfKey } from "@/lib/cardLang";
import { setFile } from "@/lib/setFiles";
import { INSTAGRAM_HANDLE, SITE_DOMAIN, SITE_NAME } from "@/lib/site";
import type { CatalogSet } from "@/lib/types";

/**
 * A player's progress in a set binder, as a picture to share (stories, WhatsApp, Discord): the painted desk dimmed, a paper
 * card with the set's logo, "142 / 245", a pixel progress bar, the collection's value and the three best cards owned.
 * Everything comes in the address (the binder's share sheet builds it): the server only checks it against the set's file.
 * Portrait 1080×1350, the shape phones share best.
 */
const W = 1080;
const H = 1350;
const SEGMENTS = 20;

const CATALOGS: Record<CardLang, CatalogSet[]> = { fr: rawFr as CatalogSet[], en: rawEn as CatalogSet[], ja: rawJa as CatalogSet[] };

/**
 * A picture fetched before drawing, as a data URL: the drawing waits for it with a time limit, and a picture that doesn't
 * come is left out (an image the renderer fetches itself and misses is drawn as an empty frame).
 */
async function inline(src: string, ms = 5000): Promise<string | null> {
  try {
    const r = await fetch(src, { signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return `data:${r.headers.get("content-type") ?? "image/png"};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams;
  const key = q.get("s") ?? "";
  const lang = langOfKey(key);
  const set = CATALOGS[lang].find((s) => s.id === bareId(key));
  const data = set && (await setFile(lang, set.id));
  if (!set || !data) return new Response("Unknown set", { status: 404 });

  const en = q.get("l") === "en";
  const total = data.cards.length;
  const owned = Math.max(0, Math.min(total, Math.round(Number(q.get("n")) || 0)));
  // rounded like the binder's summary page
  const pct = total ? Math.round((owned / total) * 100) : 0;
  const currency = q.get("c") === "USD" ? "USD" : "EUR";
  const value = Math.max(0, Number(q.get("v")) || 0);
  const name = (q.get("p") ?? "").trim().slice(0, 24);
  // only cards of this set, with a scan
  const cards = (await Promise.all((q.get("k") ?? "").split(",").slice(0, 3).map((k) => findCard(k.trim()))))
    .filter((f) => f && f.set.id === set.id && f.card.img)
    .map((f) => f!.card);
  // the small scans (245 px wide) are enough for cards drawn 200 px wide, and come fast
  const scans = (await Promise.all(cards.map(async (card) => ({ id: card.id, src: await inline(`${card.img}/low.png`) })))).filter(
    (c): c is { id: string; src: string } => !!c.src,
  );

  const [vt, press, desk] = await Promise.all([
    // literal paths: a computed one makes the bundler trace the whole project
    readFile(path.join(process.cwd(), "src/assets/fonts/VT323-Regular.ttf")),
    readFile(path.join(process.cwd(), "src/assets/fonts/PressStart2P-Regular.ttf")),
    // the painted desk, cut portrait (made once from img/scene.jpg)
    readFile(path.join(process.cwd(), "src/assets/share-desk.jpg")),
  ]);
  // the binders' logos are the site's own files (served from public/), the older sets' are TCGdex's
  const logo = set.logo ? await inline(set.logo.startsWith("/") ? `${url.origin}${set.logo}.png` : `${set.logo}.png`) : null;
  const money = new Intl.NumberFormat(en ? "en-US" : "fr-FR", { style: "currency", currency, maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value);
  const t = (fr: string, english: string) => (en ? english : fr);
  const full = Math.round((owned / Math.max(1, total)) * SEGMENTS);

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", position: "relative", fontFamily: "VT323", color: "#2b2230" }}>
        <img
          src={`data:image/jpeg;base64,${desk.toString("base64")}`}
          width={W}
          height={H}
          style={{ position: "absolute", top: 0, left: 0 }}
          alt=""
        />
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", background: "rgba(24, 16, 36, 0.45)" }} />
        <div
          style={{
            position: "absolute",
            left: 70,
            top: 80,
            width: W - 140,
            height: H - 160,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "48px 56px 40px",
            background: "#f4ecdc",
            border: "6px solid #2b2230",
            borderRadius: 14,
            boxShadow: "16px 18px 0 rgba(20, 12, 28, 0.55)",
            transform: "rotate(-1deg)",
          }}
        >
          <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", fontFamily: "Press", fontSize: 26, color: "#b8433d" }}>{SITE_NAME.toUpperCase()}</div>
            {name && <div style={{ display: "flex", fontSize: 38, color: "#6f6068" }}>{t(`le classeur de ${name}`, `${name}'s binder`)}</div>}
          </div>

          {logo ? (
            <img src={logo} height={190} style={{ marginTop: 40, maxWidth: 760, objectFit: "contain" }} alt="" />
          ) : (
            <div style={{ display: "flex", marginTop: 50, fontFamily: "Press", fontSize: 40, textAlign: "center" }}>{set.name}</div>
          )}
          {logo && <div style={{ display: "flex", marginTop: 14, fontSize: 40, color: "#6f6068" }}>{set.name}</div>}

          <div style={{ display: "flex", alignItems: "baseline", marginTop: 34, fontFamily: "Press", fontSize: 88 }}>
            <span style={{ color: "#b8433d" }}>{owned}</span>
            <span style={{ fontSize: 54, margin: "0 18px", color: "#6f6068" }}>/</span>
            <span>{total}</span>
          </div>
          <div style={{ display: "flex", marginTop: 8, fontSize: 44, color: "#6f6068" }}>{t("cartes dans mon classeur", "cards in my binder")}</div>

          {/* the loader's pixel bar */}
          <div style={{ display: "flex", marginTop: 34, padding: 8, gap: 6, border: "6px solid #c9502f", borderRadius: 12, background: "#fffaf0" }}>
            {Array.from({ length: SEGMENTS }, (_, i) => (
              <div key={i} style={{ display: "flex", width: 30, height: 34, borderRadius: 4, background: i < full ? "#e0673d" : "rgba(201, 80, 47, 0.14)" }} />
            ))}
          </div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 52 }}>
            <span style={{ color: "#b8433d" }}>{pct} %</span>
            {value > 0 && <span style={{ marginLeft: 26, color: "#a8701a" }}>{`· ${money}`}</span>}
          </div>

          {scans.length > 0 && (
            <div style={{ display: "flex", position: "relative", width: 640, height: 300, marginTop: "auto" }}>
              {scans.map((card, i) => {
                const spot = scans.length === 1 ? [220] : scans.length === 2 ? [115, 325] : [20, 220, 420];
                const tilt = scans.length === 1 ? [-3] : scans.length === 2 ? [-6, 5] : [-9, -1, 8];
                return (
                  <img
                    key={card.id}
                    src={card.src}
                    width={200}
                    height={279}
                    alt=""
                    style={{
                      position: "absolute",
                      left: spot[i],
                      top: i === 1 && scans.length === 3 ? 0 : 14,
                      borderRadius: 14,
                      transform: `rotate(${tilt[i]}deg)`,
                      boxShadow: "8px 10px 0 rgba(20, 12, 28, 0.35)",
                    }}
                  />
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", marginTop: scans.length ? 26 : "auto", fontFamily: "Press", fontSize: 24, color: "#2b2230" }}>
            {SITE_DOMAIN} · {INSTAGRAM_HANDLE}
          </div>
          <div style={{ display: "flex", marginTop: 8, fontSize: 32, color: "#6f6068" }}>
            {t("ta collection de cartes Pokémon, rangée sur ton bureau", "your Pokémon card collection, filed on your desk")}
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: "VT323", data: vt, style: "normal", weight: 400 },
        { name: "Press", data: press, style: "normal", weight: 400 },
      ],
      // everything is in the address: the same address always draws the same picture
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=2592000", "X-Robots-Tag": "noindex" },
    },
  );
}
