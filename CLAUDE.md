@AGENTS.md

# NookDex — project context

A Pokémon TCG collection tracker drawn as a cosy painted desk (nookdex.com). Owner: Johan (talks in French, prefers short
answers in French). Read this before touching the code: it holds the decisions and the outside setup the code alone
doesn't show.

## Working conventions

- Answer Johan in French, short and concrete. Code, comments and commit messages in English.
- Changes go on a branch, then a PR merged (squash) into `main`. Vercel deploys `main` only (nookdex.com): no
  previews (`vercel.json`), the Hobby plan keeps every deploy of the last 30 days within 10 GB of storage.
- Before a PR: `npx tsc --noEmit`, `npx eslint src`, and for anything visual, look at it (Playwright + Chromium, desktop
  1400×900 and phone 390×800). Dev shortcuts: `?skip`, `?open=<setId>`, `?os`, `?demo`, `?game` (they also skip the sign-in).
- Match the style around: no reformatting (Prettier with default options reflows whole files: don't run it), comments
  that say why, lines up to ~150 chars.
- Mobile: text fields are ≥ 16 px and the viewport has `maximum-scale=1` (no zoom when typing).

## How it's built

- Next.js (App Router, see AGENTS.md), React, zustand (`src/lib/store.ts`, persisted in localStorage under the old key
  `pokepocket:v1`), motion. The room is client-only (`src/components/App.tsx`).
- Loader and page speed (PageSpeed only ever sees the loader): its logo is plain HTML (`LoaderStill`, the dynamic
  import's fallback), preloaded from the desk layout, in 3 widths (`logo-paper-{720,1400,2816}.webp`, made by
  build-scene). The room's pictures load after the logo, and the room stays `visibility: hidden` under the loader:
  a picture hidden *behind* it still counts as the page's biggest paint (LCP). Measured 2026-10-02: desktop 61 → 97,
  mobile 44 → 76 (Lighthouse).
- `src/app/(desk)/` shares one layout for `/` and the notebook pages (`/a-propos`, `/confidentialite`, `/conditions`,
  `/contact`): the room stays mounted, those pages open as a notebook over it and are server-rendered (Google reads them).
- Server code reads the sets' files through `lib/setFiles` (async): from disk in dev and at build, else fetched from
  the site's own static files. They're kept out of the functions (next.config `outputFileTracingExcludes`): 30 MB in
  each one: 430 MB of traced files in all, 88 MB without.
- Card data is static JSON from TCGdex, built by `scripts/fetch-set.mjs` into `public/sets/` (one file per set +
  `index.json` for the free-binder search), `public/logos/`, `src/data/catalog.json`. Binder sets = recent series
  (`me`, `sv`, `swsh`) and the Wizards era (`base`, `gym`, `neo`, `lc`, `ecard`: one "Wizards" tab in BinderPicker);
  every other set is `extra` (search only).
- Prices: Cardmarket via TCGdex (`low`, `trend`, `-holo` variants, `avg7`/`avg30` for the ↗ ↘ arrow), then, for French
  and Japanese cards, Cardmarket's own nightly price guide (`price_guide_6.json`, the public download of their Data page,
  same fields) by the card's `cmId` (fetch-set `applyGuide`): TCGdex copies it a day or two late, and it also reaches
  the extra sets. TCGdex sometimes gives several cards one Cardmarket product (Mew and the Mewtwos of the XY promos):
  Cardmarket's product list sorts them out first (`fixSharedProducts`, `docs/cardmarket-shared-products.md`), a card
  left without its own product shows "—". A card TCGdex doesn't price shows "—", never "0,00 €", and stays out of gains. Cardmarket's guide is per product: it mixes every
  language. No API gives Cardmarket prices per card language (the official API is closed to new apps, confirmed by their
  support 2026-10-07, no date to reopen: their answer is in `docs/cardmarket-api.md`; their Data page's price guide files are per product too; the "FR prices"
  of resellers are the seller's country). English cards are priced on TCGplayer instead (see Languages).
  Cardmarket allows this use in writing (Tracy, Head of Marketing, 2026-10-11, `docs/cardmarket-api.md`): every
  place showing their prices says so, their logo only from their downloads kit; no affiliate program.
- A card TCGdex stops listing is never dropped: kept with its last prices, `unavailable: true`, shown as a painted card
  back stamped "Bientôt de retour" (`CardBack`).
- A card TCGdex lists with no scan in any language (the 30th's Classic Collection, `30th-c`) gets TCGplayer's picture,
  found on TCGCSV by set group and name (`scansFromTcgcsv`), made into `public/scans/<card id>/` (sharp: the Actions
  run `npm ci`) and served as `https://nookdex.com/scans/<id>`. TCGdex's own scan wins the day it has one.
- Sets with no scan at all on TCGdex, the trainer kits (`tk-*`, two half decks per TCGplayer group) and the Mega Evolution
  promos (`mep`): `TCGCSV_GROUPS` in fetch-set maps each to its TCGCSV group, cards matched by number and name, shown as
  `/scans/tp/<product>` (not downloaded). A new such set: find its group on tcgcsv.com/tcgplayer/3/groups and add it.

## Languages: the site, the cards, the money (three separate things)

- **Site language** (texts): French, or English when the browser isn't French. `lib/lang.ts`: `useLang()`, `useT()` →
  `t("Ranger", "Put away")` (both texts side by side in the component, no key dictionary). Every new UI text needs both.
  Can be forced in NookDex OS → Save (« Langue · Language »): zustand `lang`, mirrored in the `nookdex-lang` cookie,
  the page reloads. Server pages (layout metadata, `/` text, notebook pages) read `lib/serverLang.ts` (cookie, else
  Accept-Language; no header = French). Each notebook page has a French and an English version in the same file;
  `src/data/about.ts` holds the notebook text (`ABOUT`, `ABOUT_EN`). Supabase auth e-mails stay French only.
- **Card language** (FR, EN, JAP): chosen per set binder (stamps in the new binder sheet, default = site language), and
  per card in a free binder (same stamps in its search). It lives in the ids (`lib/cardLang.ts`): a French card keeps
  its TCGdex id (`sv08-001`, like every older save), an English one is `en:sv08-001`, a Japanese one `ja:SV8-033`;
  sets likewise (`sv08`, `en:sv08`, `ja:SV8`: that's a set binder's `setId`). `lib/catalog.ts` keys ids as it reads files, so the rest of the code just uses
  `collection[card.id]` and never mixes languages. Never cut a card id by hand: `setIdOfCard`, `langOfKey`, `bareId`.
  A binder not in the site's language wears a small "EN"/"FR" sticker (shelf, NookDex OS); shared lists tag such cards.
- Card data in English: `fetch-set --lang=en` writes `public/sets/en/`, `public/logos/en/`, `src/data/catalog-en.json`
  (same TCGdex ids).
- Japanese: `fetch-set --lang=ja` → `public/sets/ja/`, `src/data/catalog-ja.json`. Japanese sets are their own (ids
  `SV8`, `S12a`…; binder series `M`, `SV`, `S`, shown under the site's series names; promos, decks and the "CS"
  sets are search-only). TCGdex has no logos and few scans for them. A Japanese card TCGdex has no scan of (the MEGA
  block, Black Bolt, White Flare: 1,542 cards on 2026-10-07) shows TCGplayer's picture: found on TCGCSV's Pokémon Japan
  category (85) by set code and printed number, the plain print, not its Poké/Master Ball pattern (`scansFromTcgcsvJa`).
  Not downloaded (~150 MB): its `img` is `https://nookdex.com/scans/tp/<TCGplayer product id>`, which next.config
  `redirects` sends to TCGplayer's image server at our two sizes. TCGdex's own scan wins the day it has one. Names are Japanese: `aka` holds the Pokémon's French and English names
  (PokéAPI by dex number) so searches find "pikachu", "dracaufeu", and the card sheet shows them.
- **Prices follow the card's language**: French cards → Cardmarket (euros, all languages mixed), Japanese cards →
  Cardmarket (euros, and for once per language: Japanese prints are products of their own), English cards → TCGplayer (US market, English
  cards, dollars: `marketPrice` as the trend, `lowPrice` as the low, `tp` = product id for the link; the arrow keeps
  Cardmarket's averages). An English card TCGdex doesn't link to TCGplayer (Trainer Galleries, Shiny Vault, 30th…) is
  looked up on TCGCSV (tcgcsv.com, TCGplayer's catalog and prices, daily; matched by set name, number and name; their
  rules: a named User-Agent, ~100 ms between requests, one sync a day). Still nothing: Cardmarket's price converted at
  the ECB rate (`src/data/eur-usd.json`, refreshed by fetch-set), flagged `cm`. TCGCSV has no French cards.
- **The player's money** (`currency` in zustand and in the save, NookDex OS → Save « Devise »): purchase prices are typed
  in it; values, totals and gains are added up in it (`priceOf` converts). Only the card sheet's price table shows the
  card's own market price and currency (`marketPrice`). Switching the currency converts the purchase prices.
- Saves v3 and older (before card languages): on the English site their cards were English → migrated to `en:` keys,
  and their currency set to the site's (store `migrate` and `importBackup`, also for an older cloud save).

## Accounts and data (Supabase)

- Project `xwqhucccldraieyiycvt`. URL and publishable key are in `src/lib/cloud.ts` (public, fine). Table `saves`
  (one row per player, the export JSON) with RLS: `docs/supabase.sql` (safe to run again).
- Sign-in: magic link (e-mail) or Google. Google OAuth client in Google Cloud (brand verified), redirect URI
  `https://xwqhucccldraieyiycvt.supabase.co/auth/v1/callback`. Supabase redirect URLs: nookdex.com/**, localhost:3000/**.
- Sync (`src/lib/cloud.ts`): pull on sign-in and on tab focus, push 1.5 s after a change, three-way compare with the
  last agreed state (localStorage `nookdex:cloud-base:<userId>`) and a "keep which one?" choice on conflict.
- Players count: SQL function `player_count()` (docs/supabase.sql, security definer, returns the number only), read by
  `lib/players` for the loader's tagline (rounded down to tens, cached 1 h, hidden under 50) and by the welcome
  (`usePlayers`, exact). If the function is missing, nothing shows.
- Funnel (`lib/funnel.ts`, 2026-10-17: since the welcome asks no account, the players without one were invisible): a
  random id per device (localStorage `nookdex:device`, redrawn after 13 months), its first source (utm_source, else the
  referrer's site by one name: instagram, linkedin, google…, else "direct"; a player from before it: "existing"), its
  landing page, the days it came back and its steps (profile, binder, cards10, account, game). Supabase `funnel` behind
  `funnel_ping` (writes) and `funnel_stats(since)` (counts by source), docs/supabase.sql; production on nookdex.com only.
  Nothing personal, nothing tied to the account (/confidentialite says so). Vercel Analytics' referrers (Johan's dashboard,
  no API) give the visits; this gives what they do.
- Weekly report (2026-10-17): Mondays 02:17 UTC (GitHub delays scheduled runs by hours) the Action « Chiffres de la semaine » (`scripts/analytics.mjs`: funnel_stats,
  growth_stats, activity_stats, Search Console with the `GSC_SERVICE_ACCOUNT` secret) writes `docs/reports/data/<date>.json`; the
  Claude routine « Rapport de la semaine NookDex » writes `docs/reports/<date>.md` and its e-mail `<date>.html` (from
  `docs/reports/mail-template.html`); « Mail du rapport » sends that to contact@nookdex.com via Brevo (`BREVO_API_KEY` secret).
- Auth e-mails go through Brevo SMTP as `contact@nookdex.com`; their templates are `docs/emails/*.html` (pasted in
  Supabase → Authentication → Emails → Templates).

## Onboarding

- Welcome (`src/components/shelf/Welcome.tsx`): 1. nickname → 2. first binder, or "explore every card first" (NookDex OS
  → "Toutes les cartes"; their first binder from the shelf's + then starts the tour). No account asked first (Johan,
  2026-10-13: it held people back); "Déjà un compte ?" on the nickname card signs a returning player in.
- The account comes later (`room/SavePrompt.tsx`): a player without one who owns 10 cards gets a short card in the calm
  room (after any trophy toast; Google or an e-mail link). "Plus tard" waits for 15 more cards and 3 days (localStorage
  `nookdex:save-ask`, per device); the cat's tip waits for another visit. NookDex OS → Save signs in at any time.
- NookDex OS → "Toutes les cartes" (`computer/AllCards.tsx`): every card of the indexes (FR/EN/JAP), filters (rarity
  tiers of `lib/rarity`, year, set, owned) and sorts (price in the player's money first). A card opens its sheet over
  the OS; "Je l'ai !" there asks which binder the copy goes in (`binder/AddTo.tsx`). Plan and next steps (wishlist of
  any card): `docs/search-plan.md`.
- Then the guided tour (`src/components/shelf/Tour.tsx`): a spotlight on elements tagged `data-tour="…"`, can't be
  skipped, waits for the player on the key gestures. Replayable from the shelf notebook. Renaming or removing a
  `data-tour` attribute breaks a step.

## The poster

- The poster above the desk is the player's pick (Johan, 2026-10-19), clicked through like the lava lamp (`POSTER_*` in
  PaintedRoom, kept on the device: localStorage `nookdex:poster`); the first, a moonlit night, replaces the painted Poké
  Ball. Gemini paints only the artworks, on one sheet (`img/posters.jpg`, prompt in docs/prompts-gemini.md §5);
  `scripts/build-posters.mjs` cuts them, covers a painted brand, and pastes each into the poster of each plate (night,
  day): inside the artwork's own shape (its torn corner and the tape kept), projected onto its corners, lit like the paper
  around it -> `public/scene/posters/<id>-{night,day,thumb}.webp`, `src/data/posters.json`. A new sheet: same grid, ids in
  the script's `IDS`, the brand cover measured again if needed. Next ideas: your favourite card on the wall, posters won
  by trophies, seasonal ones in the shop.

## The box

- The purple box on the top shelf, by the Poké Ball (`BOX` in PaintedRoom, `room/Box.tsx`), holds the cards no binder
  holds: copies kept by their set (no `at`) whose set binder isn't on the shelf, extra sets' included (`boxOf` in
  lib/binders; nothing stored for it, a set binder put back takes its cards again). Its label shows how many. On narrow
  screens (phones, 1440×900) it's half out of frame: NookDex OS → Accueil has a « La boîte » row that opens it.
- Removing a binder that holds cards asks (`RemoveChoice`): into the box (a free binder's copies leave their pockets),
  or deleted. "Je l'ai !" offers the box when the card's set has no binder on the shelf. Planned use: the Pokécardex
  import's small sets.

## The trade mat

- NookDex OS → « Échange », or « ⇄ Échanger » on the sheet of a card owned (that card on the player's side): a playmat over
  nearly the whole screen (`trade/TradeMat`, `lib/trade`, opened through `openTrade`), Gemini's painting cut out by
  `scripts/build-trade-mat.mjs` (the zones are placed in % of it: measure again if the picture changes). « Je donne » /
  « Je reçois », one bar telling which way the trade leans (±5 %: fair). A card's value: its trend less an estimate for its
  condition (EX −15 % … PO −70 %: Cardmarket gives one price), or the price typed for a graded card (no source gives
  PSA prices). « Échange accepté » takes the given copies out and puts the received ones in (kept by their set). The mat
  is kept in localStorage `nookdex:trade` (a phone killing the tab at a fair). Past what a zone holds, its cards overlap like a hand
  (`useHand`: 2 rows on a computer, 1 on a phone, always inside the zone), the + slot a round button in its corner.

## Wishlists

- A wishlist is a free binder with `wish: true` (shelf label "★ name", the picker's "★ Wishlist" tab, not offered for the
  very first binder). Its `wants` (pocket -> card key, any language, in the save and the cloud with the binders) are
  ghosts: never owned, never in a value or a set's completion. "Je l'ai !" on a ghost (`obtainWish`) makes it a copy
  kept in that pocket like any free binder's; it never shows up in its set's binder (Johan, 2026-10-11: a wishlist is
  a way of filing cards, ticking Lugia there must not file it elsewhere). A card owned elsewhere stays wanted, tagged
  "déjà à toi".
- ☆ Wishlist on every card sheet (`binder/WishButton`), NookDex OS → Wishlist lists every ghost (total cost, copy the
  list) and makes a wishlist of a set binder's missing cards. Wishlists share the 12 shelf slots (an idea for later: a
  Collection / Wishlist switch of the shelf).

## Trophies

- `lib/trophies.ts` (the 92: 60 for the desk and the collection, 32 for Nook Survivors won in the game and not needed
  for "all"; `factsOf` worked out from the collection), won by `useTrophyWatch` (debounced, waits for the
  cloud) or by `unlock(id)` on a gesture (room easter eggs, OS, share, combo, tip links). Kept in their own store
  (`lib/trophyStore`, localStorage `nookdex:trophies`), ride in the save (`Backup.trophies`) and the cloud, merged and never
  in the conflict fingerprint. Toasts `room/TrophyToast` (4+ at once = one summary), case `room/TrophyCase` from the
  Poké Ball hotspot on the top shelf (`data-tour="trophies"`).
- Their pictures: painted trinkets drawn by Gemini on white sheets (`img/trophies.jpg` 10×6, `img/trophies-game.jpg` 4×4,
  `img/trophies-defi.jpg` and `img/trophies-beyond.jpg` 4×2, in the order of `ORDER` / `ORDER_GAME` / `ORDER_GAME2` /
  `ORDER_GAME3` in `scripts/build-trophies.mjs`), cut out by that script into `public/trophies.webp` + `src/data/trophy-art.json`. A new
  trophy needs its trinket: a new sheet (same style prompt) and the script run again.

## Versions and the road log

- `src/data/changelog.ts` (`CHANGELOG`, newest first, FR + EN): the version shown in the room's bottom-left corner
  (`APP_VERSION`) and the « Carnet de route » it opens (`room/RoadLog.tsx`, also linked from the shelf notebook).
- A returning player (a profile on that device) gets the notebook once per version, in the calm room; a newcomer
  starts on the current version (localStorage `nookdex:seen-version`, outside the save).
- A PR players would notice adds a line to the top version (written for the player, not how it's built). A new version
  number (0.8, …) only when the release is worth popping the notebook for: every bump shows it to everyone. Pure fixes
  don't bump.

## E-mails and forms (Brevo)

- Domain nookdex.com authenticated in Brevo. Vercel env: `BREVO_API_KEY`, optional `CONTACT_TO` (default Johan's
  Gmail), `CONTACT_FROM` (default `contact@nookdex.com`).
- Receiving: nookdex.com has its DNS at Vercel, which doesn't forward mail. **ImprovMX** (free, Johan's account) forwards
  `*@nookdex.com` to Johan's Gmail: MX `mx1.improvmx.com` (10) and `mx2.improvmx.com` (20), and SPF TXT
  `v=spf1 include:spf.improvmx.com include:spf.brevo.com ~all` in Vercel DNS. Don't remove them: before 2026-10-07 the
  domain had no MX and every mail to contact@ bounced. Johan sends as contact@ from Gmail through Brevo SMTP
  (`smtp-relay.brevo.com:587`, its own SMTP key "Gmail"; Supabase's auth e-mails use another key, leave it alone).
  His Gmail signature is `docs/emails/signature.html` (open in Chrome, copy, paste in Gmail's settings); Warwick's
  picture is `public/email/warwick.png`.
- `/api/contact`: contact form → e-mail to Johan (topics are sent in French whatever the visitor's language).
- The English waiting list (Brevo list 12, `BREVO_WAITLIST_LIST_ID`) is gone since the English version exists.

## Blog (SEO/GEO)

- `/blog` (index, the visitor's language) and `/blog/<slug>` (one post, its own language), notebook pages like
  `/a-propos`, opened from the cork board above the desk (`BOARD` hotspot in PaintedRoom) and the notebook's "Blog" tab.
- Posts are Markdown files: `content/blog/<fr|en>/<slug>.md`, frontmatter `title, description, date, key, tags`; the
  two languages of a post share `key` (hreflang). `::card[<id>]` on its own line draws a card sheet from `public/sets`
  with today's price and a link to its market; 2-4 such lines in a row make a gallery. A quote block is the "En bref"
  sticky note; a "Questions fréquentes" / "FAQ" section becomes FAQPage JSON-LD. `lib/blog.ts` reads posts at request
  time (next.config traces `content/blog`, `public/sets`, the fonts and the share picture).
  Also: `BlogPosting` + breadcrumb JSON-LD, a share image per post (`/blog/<slug>/og.png`, pixel fonts from
  `src/assets/fonts`), related posts, sitemap entries, RSS (`/blog/rss.xml`, `/blog/rss-en.xml`), `/llms.txt`.
- Written by a scheduled Claude routine, twice a week, straight to `main`, following `docs/blog.md` (subjects, data,
  format, tone). Change the editorial line there, not in the routine's prompt.

## Set pages and addresses with a language (SEO)

- One notebook page per set, from the same files as the binders (prices of the day): `/extensions/<slug>` (French
  cards, Cardmarket €) and `/en/sets/<slug>` (English cards, TCGplayer $), indexes `/extensions` and `/en/sets` (the
  notebook's "Extensions / Sets" tab). Slug = the set's name in that language (`lib/setPath.ts`); the two pages of a set
  share its TCGdex id (hreflang). Card list, rarities, most expensive cards, "one of each" value, generated FAQ
  (FAQPage), blog posts showing its cards (`lib/setPages.ts`, `components/SetPageView.tsx`). No pages for Japanese sets.
  Blog card sheets link to their set's page.
- **Card pages** (2026-10-17, for « <carte> <numéro> prix »): one per card under its set's page, `/extensions/<set>/<card>`
  and `/en/sets/<set>/<card>` (card slug = name + number, `lib/cardPages`, `CardPageView`): scan, today's price per version,
  the curve from `public/history`, the same Pokémon in the other sets, prev/next, FAQ (FAQPage), hreflang to the twin card.
  ~45 000 pages: drawn on each visit like the rest of the site (the root layout reads the visitor's language: a
  `revalidate` or `generateStaticParams` there asks for a static page and breaks in production, DYNAMIC_SERVER_USAGE), linked from the set page's card list, listed in
  `/cartes/sitemap/fr.xml` and `en.xml` (built with the deploy, named in robots.txt).
- `/` is the French home for search engines (they send no language), `/en` the English one (hreflang between them). The
  home text (`HomeText`) carries `WebApplication` JSON-LD; its title is written visibly on the loader's paper (hidden
  once the room is in: `html[data-room]`, set by App). Landing on `/en…` starts the room in English (`resolveLang`).
- Release calendar: `/calendrier-des-sorties` and `/en/release-calendar` (notebook tab "Sorties / Releases",
  `components/ReleaseCalendar.tsx`, `lib/releases.ts`). Coming up = `src/data/releases.json` (official announcements
  only, with their source, kept up to date by the blog routine, see docs/blog.md); the past year = the catalogs'
  binder sets, linked to their pages. An « En bref » answer on top (the next set, in how many days), the coming releases
  by month (« Sorties Pokémon de novembre 2026 »), a generated FAQ (next set, next releases, each month's, next year's, latest
  set, Japanese sets) for search and AI answers (2026-10-17, from the first weekly report). An entry's `post`
  (`{ fr, en }` slugs) links it to its blog post. The routine writes about releases on its own (docs/blog.md
  "Releases come first": the month's releases on the first run of a month, a set preview 21 days before, its first
  prices 7-30 days after).
- `src/proxy.ts` tags `/en…`, `/extensions…` and `/calendrier-des-sorties` with their language (`x-nookdex-lang`), which `serverLang` reads before
  the cookie: `<html lang>` and metadata follow the address there.

## Amazon affiliate

- Club Partenaires Amazon.fr (Johan, 2026-10-19), tag `nookdex-21` (`lib/amazon`): searches on amazon.fr for sealed products, on
  French pages only (the tag pays on amazon.fr): « Précommander sur Amazon » on the calendar's coming sets and products,
  a line on the set pages of sets out within two years, one link at most in a French blog post (docs/blog.md; the tag and
  `rel="sponsored"` added by `tagAmazonLinks`). The program's sentence (`AMAZON_NOTICE`) on each of those pages and on
  /a-propos. The account closes without 3 sales in its first 180 days. Never for single cards (Cardmarket).
- The products (Johan, 2026-10-19: put them forward, a call to action wherever they show): `src/data/amazon-products.json`
  (a group per set, `setId` = its FR id; a product = `asin` -> amazon.fr/dp, else a search), `lib/amazonShop`, cards drawn by
  `ShopShelf` (official picture, kind, name, a big yellow button: « Demander l'invitation », Amazon sells sealed Pokémon
  by invitation; « Précommander » before the release). On `/invitations-amazon` (a notebook tab, French only, FAQ), on a
  set's page (its 4 most looked-for) and under a coming set in the calendar. Pictures: the official ones from Poképédia
  (`scripts/fetch-amazon-pics.mjs` -> `public/amazon/`, `src/data/amazon-pics.json`; the daily prices Action fetches the
  missing ones; `lib/shop` is the skins shop, not this). The blog routine keeps the products up to date (docs/blog.md).
  Clicks counted by page (`watchAmazonClicks`, Supabase `amazon_clicks`, the weekly report). A tracking id per place
  (`AMAZON_TAGS`: invit, extension, calendrier, blog; Amazon's reports split the sales by them). In a French blog post,
  `::amazon[<group id>]` draws the cards (« Où acheter … ? » section, docs/blog.md).

## Sharing a binder

- "Partager ↗" in a set binder's header (once it holds a card) opens `binder/ShareSheet.tsx`: a progress picture drawn by
  `app/share/progress/route.tsx` (1080×1350, next/og; set, count, value, nickname and the 3 best owned cards are all in
  the address and checked against the set's file; noindex), then the phone's share sheet (picture + a link to the set's
  page), or download / copy the link. The picture is fetched before the tap: Safari refuses a share after a wait. Its
  background is `src/assets/share-desk.jpg`, a portrait cut of `img/scene.jpg`.

## Tips (support)

- `SUPPORT_URL` (`lib/site.ts`, buymeacoffee.com/nookdex since 2026-10-19, PayPal.me before). The cat asks once the player owns 10 cards, in the calm room
  (nothing open, no tour, on `/` or `/en`), 20 s into the visit at the earliest: a pop-in on a computer, a strip at the
  bottom on a phone (`room/SupportCat.tsx`). Then it waits 21 days (180 after a tip); per device, localStorage
  `nookdex:support-next`, outside the save. Also linked from the shelf notebook and `/a-propos`.

## NookBoy (the game in the Game Boy)

- The Game Boy painted by the mug (`GAMEBOY` in PaintedRoom) runs Nook Survivors, a survivors-like (a name of our own: no brand in the game's title): a starter (Bulbasaur,
  Charmander, Squirtle, Pikachu; they evolve mid-run) against waves of wild Pokémon (15 s a wave up to 24, 20 s to 49, then 30 s: `waveLength` / `waveStart` / `waveAt` in lib/game/data, XP and
  gold scaled up on short waves so a wave gives as much; Clément 2026-10-18), a boss every 5th,
  candies → levels → 3 cards (31 moves of 17 types, auto-cast or keys 1-4, 4 at most; 17 held items; once all is maxed,
  stacking bonuses). A move at level 5 + its item (`evo` in lib/game/data) offers its evolution first (16 of them).
  Statuses (wet, burnt, poisoned, asleep/frozen, slowed, charmed: Fairy, the foe goes for its neighbours; Dark makes them
  flinch) and `COMBOS` (17; the pause lists the run's own and its live stats, `statsOf`; the menu's « Guide » lists statuses, combos, evolutions and items, `STATUSES` in lib/game/data) are what the moves play on (Hex, Poltergeist hit the statused).
  A cooldown never gets under 30 % of its own (`HASTE_FLOOR`; no PP Up offered once there, « vitesse max » in the pause). A blow takes at most 30 % of the max HP (`HIT_CAP`, Johan 2026-10-18: no one-shot, running through the crowd wears down). Foes' HP and damage grow with the square of the wave up to 100, in a straight line past it, and the XP curve steepens
  past level 15 (Johan, 2026-10-12: wave 23 was too easy). Balance is tuned with a god-mode bot driving `window.nookboy`
  through Playwright (damage taken per second / max HP, a boss's time to fall, a move's damage per second alone). Score
  = the wave reached. The Game Boy on the desk names the classic ladder's number one now and then (`room/GbBubble`).
  Computers only: on a phone the Game Boy is out of frame (its tip says so).
- In the room it's a CSS loop (`public/game/attract.png`, 8 frames, no script). The game (`components/game/NookBoy`,
  `lib/game/*`: engine, gfx, audio, data, scores) is a lazy chunk, loaded on click with its sprite atlas
  (`public/game/sprites.png`, ~900 KB since the daily challenge's Pokémon). Fixed 60 Hz step on a 320×288 canvas, scaled by a whole number in a CSS
  Game Boy. Select (Tab) swaps palettes (colours, DMG green, Pocket, lofi violet: the atlas re-shaded once).
  `?game` opens it, `window.nookboy` is the engine in dev.
- Sprites: PMD SpriteCollab (CC BY-NC 4.0: credits in the game's Crédits screen, non-commercial use only), downloaded,
  trimmed and packed by `npm run build-game` (`scripts/build-game.mjs`, cache `.cache/`), which also writes
  `src/data/game-sprites.json` and the room's loop. A new Pokémon: add its dex number to the script's ROSTER, run it.
- Ladder: Supabase `game_scores` behind `game_top2` / `game_submit2` (v4 at the end of docs/supabase.sql: plausibility
  checks, the short waves' timing (v5), up to wave 200, one run per name every 20 s, best run per name), open to everyone, account
  or not. A board per mode
  (classic, daily then defi, coop) and period (the month's season, the daily's UTC day, all time); `game_top` / `game_submit` are
  the v1 the client falls back on.
- Economy: gold (Nuggets, ~10 % of foes, more from elites, bosses, Chansey) goes in a **purse** kept from run to run
  (`lib/pensionStore` `gold`, in the save and the cloud, the latest wins). A run starts with **no gold** (Johan,
  2026-10-17: a 47k purse bought Kecleon's whole stall and made wave 92 easy); all it picks up goes to the purse at the
  end (game over, or the console put away mid-run). The purse buys the **Pension** (15 permanent boosts in one scrolling
  grid, capped, dearer each level, merged by the higher level; a **2nd rank**, half as many levels again, once wave 100 is
  reached) from the menu or the game over. The best classic/coop wave is kept among the Pension's levels as `wave`
  (`bestWave`, merged the same way). A click beside the console mid-run only pauses it.
- **Beyond wave 100** (Johan, 2026-10-17): classic and coop runs go on to wave 200 (`MAX_WAVE`; the 100th boss gives
  the "Centenaire" trophy and the run goes on), titans walk among the foes from wave 50 (`TITANS_FROM`, more often past 100: `BEYOND`), a 5th move and item slot once the 50th
  boss has fallen (`SLOT5_WAVE`, `moveSlots`), bosses up to x2.5 HP past wave 25 (`BOSS_LATE_HP`), the starter's type twice as likely in the
  draws and the types it combos with a bit more (`affinity`; Clément, 2026-10-18: the late game was only boosts), every 10th wave is a
  giga boss of the daily challenge's, Mega Mewtwo Y the 200th (won when it falls). **Start tiers**: a run may start at 25,
  50 … 175 once that wave was reached (`TIERS`, `tierLevel`, `tierPicks` in the engine): the level a played run has there
  (`TIER_LEVEL`, from the ladder: 42 at 25, 110 at 50; 80 at 50 was too weak, a friend 2026-10-18),
  evolved, a card per level (past a full build: stacking boosts), all of them as a build pack picked out of 3 (`PACKS` in lib/game/data: 15 builds of
  4 moves + 4 items, drawn by rarity, legendaries rare and broken, Johan 2026-10-18: luck, not a build menu; the moves raised and evolved first, then the items); a ramp then (`RAMP`: foes trickle in, the full crowd after 60 s, the tier's boss after 30 s, 3 s
  untouchable at first, Johan 2026-10-18: cornered at once otherwise); its clock starts there (the ladder's time check holds) and the ladder shows "↱50"
  (`start`, `game_submit2` v4). The old
  daily (`dailyOf`, a wave to reach) ran until 2026-10-14; the **daily challenge** below replaced it. A moment after each boss falls, a **break**: the field is cleared, then the
  Pokémon Center's heal (no screen: forgetting moves was dropped, Johan 2026-10-13), the levels won, Kecleon's stall (cards, heal, reroll, swap: give a move or an item, take one of 3 drawn at its level; prices up 12 % a wave),
  a 3-2-1. Statuses and combos: `COMBOS` in lib/game/data.
- Rewards: Supabase `game_rewards` (docs/supabase.sql, given by hand with an insert, read by the player only), e.g.
  `skin-mewtwo`: **Mewtwo**, a fifth Pokémon on the starter screen (`MEWTWO` in lib/game/data, `roster` in the engine),
  godlike on purpose (Johan, 2026-10-13): Psycho Cut blades, Psystrike on the whole screen every few seconds (`stepSig`),
  more HP, damage growing 3 % a level, Mega Mewtwo Y at 16 (a form: dex 10150, `FORMS` in build-game). `skin-gengar`:
  **Gengar** (`GENGAR`, Johan 2026-10-14, as godlike): homing Shadow Balls, Phantom Force (sinks out of reach, bursts
  out and puts the survivors to sleep for the Ghost nightmare combo), Curse (each foe it knocks out sends a wisp at the
  next), Mega Gengar at 16 (dex 10094) and its Shadow Tag slow. Both in `REWARD_STARTERS`. Never in the daily. The
  ladder takes starters 150 and 94 (`game_submit2` in docs/supabase.sql).
- **Daily challenge** (mode `defi`, from `DEFI_FROM` = 2026-10-15, Johan 2026-10-14; all of it in `docs/defi.md`):
  10 waves, each over at its last KO (`stepDefi`, `DEFI_QUOTA`), a boss of its own at wave 5 and a giga boss at 10 (a
  Mega form drawn twice as big, three phases with a roar and its guards: `gigaAct`); beating it wins, the ladder is the
  time (a win is sent as wave 11; `game_top2` / `game_submit2` v3 at the end of docs/supabase.sql). One Pokémon per UTC
  weekday, never a starter, each with its basic attack and talent (`DEFI_DAYS` in `lib/game/defi.ts`), themed foes
  (`DEFI_WILD`), titans from wave 3; x1.5 damage, x1.8 XP, seeded cards, no purse nor Pension. Gold: 12 a wave cleared,
  250 on the day's first win.
- Local coop (two Game Boys side by side, WASD + mouse for P1, the arrows for P2, auto-aim): the engine's player state is
  a `Player` (`players`, `cur`); the Game's accessors reach the current one, switched to whoever acts (their move, a
  foe's nearest target, who picks up, the screen drawn: `draw(ctx, viewer)`). A downed player is got up by standing by
  them 3 s; both down = game over. Menus show on the screen of the player they're for.
- **Fields and weather** (Johan, 2026-10-19: variety without hurting readability): a new field every 10 waves, round and round
  (`BIOMES` in lib/game/data: meadow, beach, forest, cave, snow, volcano; the grass tiles redrawn in its colours, `Gfx.tilesFor`;
  its own wild Pokémon more often among the wave's), and a weather drawn per wave from the field's chances (`WEATHERS`: rain,
  sun, hail, sand, each a ±20-25 % on some types; light particles; named in the wave's banner, the pause and the guide). Never in
  the daily challenge. Night has no rain of its own any more: rain is a weather.
- **Starters to unlock** (Johan, 2026-10-19): `UNLOCK_STARTERS` in lib/game/data, the starter screen's second row (a silhouette
  and what opens it until then): Nidoran♂ (Poison, wave 30 with Bulbasaur), Geodude (Ground, wave 30 with Squirtle), Cleffa
  (Fairy, 3 daily challenges won), Dratini (Dragon, wave 75 with any). Progress rides in the Pension's levels: `w<dex>` the
  best wave with a starter (waves played, not a start tier's), `defis` the days a daily challenge was won (`unlockProgress`).
  The ladder takes their dex (`game_submit2`).
- Sounds: the room's synth (`synth` in lib/sound, muted with it); the room's radio pauses while the console is out.

## Social posts (Instagram, TikTok)

- On the `social` branch (never deployed): `posts/<date>-<slug>/post.json` (written by the weekly routine, rules and
  format in `docs/social.md`), `renders/` (pictures + TikTok video, drawn by its Action « Rendu des posts » with
  `scripts/social/render.mjs` from main; `social-prix.yml` on main redraws the price posts each day), `assets/`.
- The videos (TikTok, Instagram Reels) are animated from the slides by `scripts/social/motion.mjs`: one scene per
  slide type, frames drawn at exact times (Web Animations paused), ffmpeg. Platforms: Instagram gets the carousel
  (`instagram`) and the Reel (`reels`, the video) on Mon/Wed/Fri; TikTok (`tiktok`) is its own line on Tue/Thu/Sun:
  no features or news, only instant numbers, games and themed pages (Johan, 2026-10-12), as a video or a photo
  carousel (`"tiktok": "photos"`: each scene's last frame, 9:16).
- `/studio` (noindex, Johan's accounts only: hashes in `STUDIO_EMAIL_HASHES`; `?dev` in dev) lists them from
  raw.githubusercontent.com: swipe the slides, share them or the video from the phone (caption copied on the way), tick
  « publié » (Supabase `social_done`, docs/supabase.sql). Posts made by hand are `prerendered`.

## GitHub Actions

- `prices.yml` (daily 11:00 UTC): `fetch-set --force` then `--force --lang=en` / `--lang=ja` refresh binder-set prices
  and cards (+ missing extra sets) and apply Cardmarket's guide; on Mondays (or "Run workflow" with « all ») `--all`
  downloads the extra sets again too (new cards, the `cmId` the guide needs, English TCGplayer prices), then `scripts/price-history.mjs` adds the day's column to
  `public/history/<lang>/<set>.json` (each card's trend, the card sheet's curve: `lib/history.ts`, `binder/PriceChart`),
  commit to `main`. The history started 2026-10-04 (no source keeps old prices: TCGCSV's archive is closed) and grows
  ~120 KB a day: thin old days to weekly if it gets heavy.
- `watch.yml` (Mondays): re-checks cards shown with an English scan or as a card back, re-downloads sets with news,
  watches TCGdex for new price fields (French Cardmarket prices would show up there); anything new opens or comments
  the issue labelled `veille`.
- The container Claude runs in on the web can't reach TCGdex: run the scripts through these Actions.
