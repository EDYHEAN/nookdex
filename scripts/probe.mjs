// Temporary probe (removed before merge)
const API = "https://api.tcgdex.net/v2";
const A = "https://assets.tcgdex.net";
const j = async (u, h) => {
  const r = await fetch(u, h ? { headers: h } : undefined);
  return r.ok ? r.json() : `HTTP ${r.status}`;
};
const head = async (u) => (await fetch(u, { method: "HEAD" })).status;
const short = (x, n = 1500) => JSON.stringify(x).slice(0, n);
for (const lang of ["fr", "en", "de", "it", "es", "pt"]) {
  const s = await j(`${API}/${lang}/sets/30th-c`);
  console.log(`\n## ${lang} sets/30th-c`, typeof s === "string" ? s : short({ ...s, cards: s.cards?.length }));
  if (typeof s !== "string") console.log("cards:", short(s.cards?.slice(0, 4)));
  console.log(`${lang} card 30th-c-001`, short(await j(`${API}/${lang}/cards/30th-c-001`), 2500));
  const m = await j(`${API}/${lang}/sets/30th`);
  if (typeof m !== "string") console.log(`${lang} 30th: ${m.cards.length} cards, ids not numeric:`, m.cards.filter((c) => !/^\d+$/.test(c.localId)).map((c) => c.id + ":" + c.name + ":" + (c.image ?? "noimg")).join(" "), "| noimg:", m.cards.filter((c) => !c.image).length);
  for (const p of [`${lang}/me/30th-c/001`, `${lang}/me/30th/c001`, `${lang}/me/30th-c/1`]) console.log("HEAD", p, await head(`${A}/${p}/low.webp`));
}
for (const lang of ["fr", "en"]) {
  const me = await j(`${API}/${lang}/series/me`);
  console.log(`\n${lang} series me:`, me.sets?.map((s) => `${s.id}(${s.cardCount?.total})`).join(" "));
  const mew = await j(`${API}/${lang}/cards?name=eq:Mew&localId=R`);
  console.log(`${lang} Mew R:`, short(mew, 800));
  console.log(`${lang} 30th-R`, short(await j(`${API}/${lang}/cards/30th-R`), 600));
}
const UA = { "User-Agent": "NookDex/1.0 (+https://nookdex.com)" };
const groups = (await j("https://tcgcsv.com/tcgplayer/3/groups", UA)).results;
for (const g of groups.filter((g) => /30th|celebration/i.test(g.name))) {
  await new Promise((r) => setTimeout(r, 150));
  const p = (await j(`https://tcgcsv.com/tcgplayer/3/${g.groupId}/products`, UA)).results;
  console.log(`\n## TCGCSV ${g.groupId} ${g.name} ${g.abbreviation} ${g.publishedOn}: ${p.length} products`);
  for (const x of p.slice(0, 40)) console.log(" ", x.productId, x.name, "|", x.extendedData?.map((e) => `${e.name}=${String(e.value).slice(0, 30)}`).filter((s) => /Number|Rarity/.test(s)).join(" "), "|", x.imageUrl);
}
