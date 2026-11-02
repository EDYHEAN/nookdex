// IndexNow (2026-11-02, on Vercel Pro: held back on Hobby for the quotas): tells Bing (and Yandex, Seznam, Naver, which
// share the pings) which pages changed, so they come back for them instead of waiting for their next sitemap pass.
// Google doesn't take part. The changed pages are the sitemaps' own: a card page's lastmod is its last real price move
// (lastMoveOf), a set page's its dearest cards', a blog post's its date, so a day is a few hundred URLs, not 45,000.
//
//   node scripts/indexnow.mjs              the URLs whose lastmod is today or yesterday (UTC), run daily by indexnow.yml
//   node scripts/indexnow.mjs --days=7     a wider window (a first run, a missed day)
//   node scripts/indexnow.mjs --dry        list them, send nothing
//
// The key is public by design: IndexNow checks it at https://nookdex.com/<key>.txt (public/), which proves the site is ours.
const SITE = "https://nookdex.com";
const KEY = "92629a78bae9edbd9ad388cd70132b60";
/** IndexNow takes up to 10,000 URLs a request */
const BATCH = 10000;

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const days = Number(args.find((a) => a.startsWith("--days="))?.slice(7) ?? 2);
const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);

const get = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": "NookDex IndexNow (contact@nookdex.com)" } });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.text();
};

// every sitemap robots.txt names (the site's and the card pages' slices)
const robots = await get(`${SITE}/robots.txt`);
const sitemaps = [...robots.matchAll(/^Sitemap:\s*(\S+)/gim)].map((m) => m[1]);
const urls = new Set();
for (const sm of sitemaps) {
  const xml = await get(sm);
  let n = 0;
  for (const [, block] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
    const mod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
    if (loc && mod && mod.slice(0, 10) >= since) urls.add(loc.replace(/&amp;/g, "&")), n++;
  }
  console.log(`${sm}: ${n} changed since ${since}`);
}

const list = [...urls];
console.log(`${list.length} URLs in all`);
if (dry || !list.length) process.exit(0);

for (let i = 0; i < list.length; i += BATCH) {
  const r = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: list.slice(i, i + BATCH) }),
  });
  // 200: taken, 202: taken, the key is still being checked; 403: the key file isn't there; 422: a URL not of the host
  console.log(`IndexNow: ${r.status} ${await r.text()}`);
  if (r.status >= 300) process.exit(1);
}
