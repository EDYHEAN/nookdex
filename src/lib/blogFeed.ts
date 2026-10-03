import { postsIn, type BlogLang } from "./blog";
import { SITE_NAME, SITE_URL } from "./site";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** RSS 2.0 of the blog in one language (readers, and AI crawlers that follow feeds). */
export function rss(lang: BlogLang) {
  const en = lang === "en";
  const items = postsIn(lang)
    .slice(0, 50)
    .map(
      (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE_URL}/blog/${p.slug}</link>
      <guid>${SITE_URL}/blog/${p.slug}</guid>
      <pubDate>${new Date(`${p.date}T08:00:00Z`).toUTCString()}</pubDate>
      <description>${esc(p.description)}</description>
    </item>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${SITE_NAME} · Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>${en ? "Pokémon TCG news, set guides and card prices." : "Actus du JCC Pokémon, guides des extensions et prix des cartes."}</description>
    <language>${lang}</language>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
