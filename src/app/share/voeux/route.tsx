import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { SITE_DOMAIN, SITE_NAME } from "@/lib/site";

/**
 * The Advent calendar's 23rd box (lib/advent): a greeting card to send, the room by night with the whole tree (made by
 * scripts/build-skins), « Joyeuses fêtes » and the player's nickname on a paper card. Portrait 1080×1350, the shape phones
 * share best. The nickname comes in the address (?p=), nothing else.
 */
const W = 1080;
const H = 1350;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const en = q.get("l") === "en";
  const name = (q.get("p") ?? "").replace(/[​-‏⁠︎️]/g, "").trim().slice(0, 24);
  const t = (fr: string, english: string) => (en ? english : fr);
  const [vt, press, desk] = await Promise.all([
    // literal paths: a computed one makes the bundler trace the whole project
    readFile(path.join(process.cwd(), "src/assets/fonts/VT323-Regular.ttf")),
    readFile(path.join(process.cwd(), "src/assets/fonts/PressStart2P-Regular.ttf")),
    readFile(path.join(process.cwd(), "src/assets/voeux-desk.jpg")),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", position: "relative", fontFamily: "VT323", color: "#2b2230" }}>
        <img src={`data:image/jpeg;base64,${desk.toString("base64")}`} width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }} alt="" />
        <div
          style={{
            position: "absolute",
            right: 50,
            top: 70,
            width: 560,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "40px 30px 34px",
            background: "#fff6e6",
            borderRadius: 18,
            border: "6px solid #c23b3b",
            boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
            transform: "rotate(2deg)",
          }}
        >
          <div style={{ display: "flex", fontFamily: "Press", fontSize: 22, color: "#2e7d4f" }}>— {SITE_NAME.toUpperCase()} —</div>
          <div style={{ display: "flex", marginTop: 28, fontFamily: "Press", fontSize: 46, color: "#c23b3b", textAlign: "center", lineHeight: 1.3 }}>
            {t("Joyeuses fêtes !", "Happy holidays!")}
          </div>
          {name && (
            <div style={{ display: "flex", marginTop: 24, fontSize: 44, color: "#2b2230" }}>
              {t(`de la part de ${name}`, `from ${name}`)}
            </div>
          )}
          <div style={{ display: "flex", marginTop: 26, fontSize: 32, color: "#6f6280" }}>{SITE_DOMAIN}</div>
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
      // the same address always draws the same picture
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=2592000", "X-Robots-Tag": "noindex" },
    },
  );
}
