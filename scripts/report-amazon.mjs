// The Amazon block of the weekly report e-mail (Johan, 2026-11-01): the sealed products of the sets out lately or coming
// that still link to a search, or still wait for their picture. amazon.fr turns scripts away (a challenge page), so a
// product's page address (its ASIN) can't be found by a robot: Johan opens the search, and sends the /dp/ link to Claude.
// The pictures come by themselves (the daily prices Action, from Poképédia): listed only so a wait shows.
// Run: node scripts/report-amazon.mjs (prints the block)
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync(new URL("../src/data/amazon-products.json", import.meta.url), "utf8"));
const pics = JSON.parse(fs.readFileSync(new URL("../src/data/amazon-pics.json", import.meta.url), "utf8"));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const DAY = 86400000;

/** the products of the sets out within 45 days or coming within 90, without their page or their picture */
export function amazonTodo(now = Date.now()) {
  const out = [];
  for (const g of data.groups) {
    const t = Date.parse(g.date);
    if (!(t > now - 45 * DAY && t < now + 90 * DAY)) continue;
    for (const p of g.products) {
      const noPage = !p.asin;
      const noPic = !!p.pic && !pics[p.pic];
      if (noPage || noPic) out.push({ set: g.name, date: g.date, name: p.name, q: p.q ?? `Pokémon ${p.name}`, noPage, noPic });
    }
  }
  return out;
}

export function amazonBlock(now = Date.now()) {
  const todo = amazonTodo(now);
  if (!todo.length) return "";
  const day = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const rows = todo
    .map((x, i) => {
      // no tag: these are Johan's own clicks
      const search = `https://www.amazon.fr/s?k=${encodeURIComponent(x.q)}`;
      const what = [x.noPage && `<a href="${search}" style="color:#b8433d;">chercher sa fiche</a>`, x.noPic && "photo en attente (Poképédia)"].filter(Boolean);
      return `
      <tr style="background:${i % 2 ? "#fff6e6" : "#fdeccd"};"><td style="padding:8px 10px;font-size:14px;line-height:1.5;">
        <b>${esc(x.set)}</b> · ${esc(x.name)} <span style="color:#8a7a82;">(${day(x.date)})</span><br>${what.join(" · ")}
      </td></tr>`;
    })
    .join("");
  return `
  <!-- amazon (scripts/report-amazon.mjs, from src/data/amazon-products.json when sent) -->
  <tr><td style="padding:12px 26px;">
    <div style="font-size:16px;font-weight:bold;margin:8px 0;">🛒 Amazon : ce qui manque aux sorties proches</div>
    <div style="font-size:14px;line-height:1.5;color:#6b5560;">« Chercher sa fiche » : le bouton du site mène encore à une recherche. Fiche trouvée : envoie son lien (avec <b>/dp/B0…</b>) à Claude, le bouton ira droit dessus.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="4" style="border-collapse:separate;">${rows}
    </table>
  </td></tr>
`;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(amazonBlock());
