import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { findCard, formatDate, postBySlug } from "@/lib/blog";
import { SITE_NAME } from "@/lib/site";

/**
 * A post's share image (social networks, messaging apps): the painted desk dimmed, a sticky note with the post's title in
 * the site's pixel fonts, and the first cards it talks about. A fixed address (the page's metadata and its structured data
 * both point here); fonts and picture ship with the blog's functions (next.config).
 */
const size = { width: 1200, height: 630 };

export async function GET(_: Request, { params }: RouteContext<"/blog/[slug]/og.png">) {
  const post = postBySlug((await params).slug);
  if (!post) return new Response("Not found", { status: 404 });
  const [vt, press, desk] = await Promise.all([
    // literal paths: a computed one makes the bundler trace the whole project
    readFile(path.join(process.cwd(), "src/assets/fonts/VT323-Regular.ttf")),
    readFile(path.join(process.cwd(), "src/assets/fonts/PressStart2P-Regular.ttf")),
    readFile(path.join(process.cwd(), "src/app/opengraph-image.jpg")),
  ]);
  const cards = post.cards
    .map((key) => findCard(key)?.card)
    .filter((c) => !!c?.img)
    .slice(0, 2);
  const title = post.title;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: "VT323" }}>
        <img src={`data:image/jpeg;base64,${desk.toString("base64")}`} width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630 }} alt="" />
        <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, display: "flex", background: "rgba(24, 16, 36, 0.62)" }} />
        <div
          style={{
            position: "absolute",
            left: 70,
            top: 80,
            width: cards.length ? 660 : 1060,
            minHeight: 420,
            display: "flex",
            flexDirection: "column",
            padding: "44px 48px",
            background: "#f4ecdc",
            border: "5px solid #2b2230",
            boxShadow: "14px 14px 0 rgba(20, 12, 28, 0.55)",
            transform: "rotate(-1.5deg)",
          }}
        >
          <div style={{ display: "flex", fontFamily: "Press", fontSize: 20, color: "#b8433d", letterSpacing: 1 }}>{`${SITE_NAME} · BLOG`}</div>
          <div style={{ display: "flex", marginTop: 22, fontSize: title.length > 60 ? 58 : 68, lineHeight: 1.05, color: "#2b2230" }}>{title}</div>
          <div style={{ display: "flex", marginTop: "auto", paddingTop: 24, fontSize: 30, color: "#6f6068" }}>{formatDate(post.date, post.lang)}</div>
        </div>
        {cards.map((card, i) => (
          <img
            key={card!.id}
            src={`${card!.img}/high.png`}
            width={300}
            height={418}
            alt=""
            style={{
              position: "absolute",
              top: i ? 150 : 95,
              left: cards.length === 1 ? 810 : i ? 850 : 735,
              borderRadius: 14,
              transform: `rotate(${i ? 7 : -4}deg)`,
              boxShadow: "10px 12px 0 rgba(20, 12, 28, 0.5)",
            }}
          />
        ))}
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "VT323", data: vt, style: "normal", weight: 400 },
        { name: "Press", data: press, style: "normal", weight: 400 },
      ],
    },
  );
}
