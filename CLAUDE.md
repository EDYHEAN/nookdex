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
  1400×900 and phone 390×800). Dev shortcuts: `?skip`, `?open=<setId>`, `?os`, `?demo` (they also skip the sign-in).
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
- Prices: Cardmarket via TCGdex (`low`, `trend`, `-holo` variants, `avg7`/`avg30` for the ↗ ↘ arrow). A card TCGdex
  doesn't price shows "—", never "0,00 €", and stays out of gains. Cardmarket's guide is per product: it mixes every
  language. No API gives Cardmarket prices per card language (the official API is closed to new apps; the "FR prices"
  of resellers are the seller's country). English cards are priced on TCGplayer instead (see Languages).
- A card TCGdex stops listing is never dropped: kept with its last prices, `unavailable: true`, shown as a painted card
  back stamped "Bientôt de retour" (`CardBack`).
- A card TCGdex lists with no scan in any language (the 30th's Classic Collection, `30th-c`) gets TCGplayer's picture,
  found on TCGCSV by set group and name (`scansFromTcgcsv`), made into `public/scans/<card id>/` (sharp: the Actions
  run `npm ci`) and served as `https://nookdex.com/scans/<id>`. TCGdex's own scan wins the day it has one.

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
  sets are search-only). TCGdex has no logos and few scans for them: no MEGA scans yet, so those sets stay out until it
  does (the daily Action picks them up). Names are Japanese: `aka` holds the Pokémon's French and English names
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
- Auth e-mails go through Brevo SMTP as `contact@nookdex.com`; their templates are `docs/emails/*.html` (pasted in
  Supabase → Authentication → Emails → Templates).

## Onboarding

- Welcome (`src/components/shelf/Welcome.tsx`): 1. sign in (or "jouer sans compte", after a warning: no online save,
  export from NookDex OS) → 2. nickname → 3. first binder, or "explore every card first" (NookDex OS → "Toutes les
  cartes"; their first binder from the shelf's + then starts the tour).
- NookDex OS → "Toutes les cartes" (`computer/AllCards.tsx`): every card of the indexes (FR/EN/JAP), filters (rarity
  tiers of `lib/rarity`, year, set, owned) and sorts (price in the player's money first). A card opens its sheet over
  the OS; "Je l'ai !" there asks which binder the copy goes in (`binder/AddTo.tsx`). Plan and next steps (wishlist of
  any card): `docs/search-plan.md`.
- Then the guided tour (`src/components/shelf/Tour.tsx`): a spotlight on elements tagged `data-tour="…"`, can't be
  skipped, waits for the player on the key gestures. Replayable from the shelf notebook. Renaming or removing a
  `data-tour` attribute breaks a step.

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
- `/` is the French home for search engines (they send no language), `/en` the English one (hreflang between them). The
  home text (`HomeText`) carries `WebApplication` JSON-LD; its title is written visibly on the loader's paper (hidden
  once the room is in: `html[data-room]`, set by App). Landing on `/en…` starts the room in English (`resolveLang`).
- Release calendar: `/calendrier-des-sorties` and `/en/release-calendar` (notebook tab "Sorties / Releases",
  `components/ReleaseCalendar.tsx`, `lib/releases.ts`). Coming up = `src/data/releases.json` (official announcements
  only, with their source, kept up to date by the blog routine, see docs/blog.md); the past year = the catalogs'
  binder sets, linked to their pages. Generated FAQ ("next set", "latest set") for AI answers. An entry's `post`
  (`{ fr, en }` slugs) links it to its blog post. The routine writes about releases on its own (docs/blog.md
  "Releases come first": the month's releases on the first run of a month, a set preview 21 days before, its first
  prices 7-30 days after).
- `src/proxy.ts` tags `/en…`, `/extensions…` and `/calendrier-des-sorties` with their language (`x-nookdex-lang`), which `serverLang` reads before
  the cookie: `<html lang>` and metadata follow the address there.

## Sharing a binder

- "Partager ↗" in a set binder's header (once it holds a card) opens `binder/ShareSheet.tsx`: a progress picture drawn by
  `app/share/progress/route.tsx` (1080×1350, next/og; set, count, value, nickname and the 3 best owned cards are all in
  the address and checked against the set's file; noindex), then the phone's share sheet (picture + a link to the set's
  page), or download / copy the link. The picture is fetched before the tap: Safari refuses a share after a wait. Its
  background is `src/assets/share-desk.jpg`, a portrait cut of `img/scene.jpg`.

## Tips (support)

- `SUPPORT_URL` (`lib/site.ts`, Johan's PayPal.me). The cat asks once the player owns 10 cards, in the calm room
  (nothing open, no tour, on `/` or `/en`), 20 s into the visit at the earliest: a pop-in on a computer, a strip at the
  bottom on a phone (`room/SupportCat.tsx`). Then it waits 21 days (180 after a tip); per device, localStorage
  `nookdex:support-next`, outside the save. Also linked from the shelf notebook and `/a-propos`.

## GitHub Actions

- `prices.yml` (daily 11:00 UTC): `fetch-set --force` then `--force --lang=en` / `--lang=ja` refresh binder-set prices
  and cards (+ missing extra sets), then `scripts/price-history.mjs` adds the day's column to
  `public/history/<lang>/<set>.json` (each card's trend, the card sheet's curve: `lib/history.ts`, `binder/PriceChart`),
  commit to `main`. The history started 2026-10-04 (no source keeps old prices: TCGCSV's archive is closed) and grows
  ~120 KB a day: thin old days to weekly if it gets heavy.
- `watch.yml` (Mondays): re-checks cards shown with an English scan or as a card back, re-downloads sets with news,
  watches TCGdex for new price fields (French Cardmarket prices would show up there); anything new opens or comments
  the issue labelled `veille`.
- The container Claude runs in on the web can't reach TCGdex: run the scripts through these Actions.
