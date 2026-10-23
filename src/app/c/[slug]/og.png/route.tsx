import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { type ListCard, getShare, resolveCards } from "@/lib/shareList";
import { SITE_DOMAIN, SITE_NAME } from "@/lib/site";

/**
 * A public list's share picture (Facebook, WhatsApp, Discord), 1200×630: the painted desk dimmed, the most wanted cards
 * fanned on the left, the ones up for trade on the right, and in the middle the pseudo and the two counts. WhatsApp crops
 * it square around the middle: everything that must be read sits there. The page's metadata puts the list's last update in
 * the address (?v=), so a changed list gets a new picture.
 */
const W = 1200;
const H = 630;

async function inline(src: string, ms = 5000): Promise<string | null> {
  try {
    const r = await fetch(src, { signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return `data:${r.headers.get("content-type") ?? "image/png"};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/** the three priciest cards of a side, with a scan, as pictures */
async function best(cards: ListCard[]) {
  const top = cards
    .filter((c) => c.img)
    .sort((a, b) => (b.price ?? -1) - (a.price ?? -1))
    .slice(0, 3);
  return (await Promise.all(top.map((c) => inline(`${c.img}/low.png`)))).filter((s): s is string => !!s);
}

function Fan({ scans, side }: { scans: string[]; side: "left" | "right" }) {
  const tilt = side === "left" ? [-16, -6, 4] : [-4, 6, 16];
  const x = side === "left" ? [0, 70, 140] : [140, 70, 0];
  return (
    <div style={{ display: "flex", position: "relative", width: 360, height: 420 }}>
      {scans.map((src, i) => (
        <img
          key={i}
          src={src}
          width={210}
          height={293}
          alt=""
          style={{
            position: "absolute",
            left: x[i],
            top: 60 + (i === 1 ? -14 : 0),
            borderRadius: 12,
            transform: `rotate(${tilt[i]}deg)`,
            boxShadow: "8px 10px 0 rgba(20, 12, 28, 0.45)",
          }}
        />
      ))}
    </div>
  );
}

export async function GET(req: Request, { params }: RouteContext<"/c/[slug]/og.png">) {
  const row = await getShare((await params).slug);
  if (!row) return new Response("Not found", { status: 404 });
  const en = new URL(req.url).searchParams.get("l") === "en";
  const t = (fr: string, english: string) => (en ? english : fr);
  const [want, give, vt, press, desk] = await Promise.all([
    resolveCards(row.data.want.slice(0, 400).map((key) => ({ key, variant: null, n: 1 }))),
    resolveCards(row.data.give.map(([key, variant, n]) => ({ key, variant, n }))),
    // literal paths: a computed one makes the bundler trace the whole project
    readFile(path.join(process.cwd(), "src/assets/fonts/VT323-Regular.ttf")),
    readFile(path.join(process.cwd(), "src/assets/fonts/PressStart2P-Regular.ttf")),
    readFile(path.join(process.cwd(), "src/app/opengraph-image.jpg")),
  ]);
  const [left, right] = await Promise.all([best(want), best(give)]);
  const wanted = row.data.want.length;
  const offered = row.data.give.length;
  const name = row.name || t("Un dresseur", "A trainer");

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", position: "relative", fontFamily: "VT323", color: "#2b2230" }}>
        <img src={`data:image/jpeg;base64,${desk.toString("base64")}`} width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }} alt="" />
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", background: "rgba(24, 16, 36, 0.55)" }} />
        <div style={{ position: "absolute", left: 10, top: 40, display: "flex" }}>
          <Fan scans={left} side="left" />
        </div>
        <div style={{ position: "absolute", right: 10, top: 40, display: "flex" }}>
          <Fan scans={right} side="right" />
        </div>
        <div
          style={{
            position: "absolute",
            left: 300,
            top: 95,
            width: 600,
            height: 440,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "30px 36px",
            background: "#f4ecdc",
            border: "6px solid #2b2230",
            borderRadius: 14,
            boxShadow: "14px 14px 0 rgba(20, 12, 28, 0.55)",
            transform: "rotate(-1.5deg)",
          }}
        >
          <div style={{ display: "flex", fontFamily: "Press", fontSize: 22, color: "#b8433d" }}>{SITE_NAME.toUpperCase()}</div>
          <div style={{ display: "flex", marginTop: 18, fontSize: name.length > 14 ? 50 : 62, lineHeight: 1, textAlign: "center" }}>
            {t(`La liste de ${name}`, `${name}'s list`)}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 26, fontFamily: "Press", fontSize: 50, color: "#b8433d" }}>
            {String(wanted)}
            <span style={{ marginLeft: 14, fontFamily: "VT323", fontSize: 46, color: "#2b2230" }}>{t("cherchées", "wanted")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 8, fontFamily: "Press", fontSize: 50, color: "#3f8a4f" }}>
            {String(offered)}
            <span style={{ marginLeft: 14, fontFamily: "VT323", fontSize: 46, color: "#2b2230" }}>{t("à échanger", "for trade")}</span>
          </div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 30, color: "#6f6068" }}>{`${SITE_DOMAIN} · ${t("prix du jour", "today's prices")}`}</div>
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
      // the address carries the list's last update: the same address always draws the same picture
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400", "X-Robots-Tag": "noindex" },
    },
  );
}
