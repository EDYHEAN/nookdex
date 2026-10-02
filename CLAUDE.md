@AGENTS.md

# NookDex — project context

A Pokémon TCG collection tracker drawn as a cosy painted desk (nookdex.com). Owner: Johan (talks in French, prefers short
answers in French). Read this before touching the code: it holds the decisions and the outside setup the code alone
doesn't show.

## Working conventions

- Answer Johan in French, short and concrete. Code, comments and commit messages in English.
- Changes go on a branch, then a PR merged (squash) into `main`. Vercel deploys `main` to nookdex.com and every branch
  to a preview.
- Before a PR: `npx tsc --noEmit`, `npx eslint src`, and for anything visual, look at it (Playwright + Chromium, desktop
  1400×900 and phone 390×800). Dev shortcuts: `?skip`, `?open=<setId>`, `?os`, `?demo` (they also skip the sign-in).
- Match the style around: no reformatting (Prettier with default options reflows whole files: don't run it), comments
  that say why, lines up to ~150 chars.
- Mobile: text fields are ≥ 16 px and the viewport has `maximum-scale=1` (no zoom when typing).

## How it's built

- Next.js (App Router, see AGENTS.md), React, zustand (`src/lib/store.ts`, persisted in localStorage under the old key
  `pokepocket:v1`), motion. The room is client-only (`src/components/App.tsx`).
- `src/app/(desk)/` shares one layout for `/` and the notebook pages (`/a-propos`, `/confidentialite`, `/conditions`,
  `/contact`): the room stays mounted, those pages open as a notebook over it and are server-rendered (Google reads them).
- Card data is static JSON from TCGdex, built by `scripts/fetch-set.mjs` into `public/sets/` (one file per set +
  `index.json` for the free-binder search), `public/logos/`, `src/data/catalog.json`. Binder sets = recent series
  (`me`, `sv`, `swsh`); every other set is `extra` (search only).
- Prices: Cardmarket via TCGdex (`low`, `trend`, `-holo` variants, `avg7`/`avg30` for the ↗ ↘ arrow). A card TCGdex
  doesn't price shows "—", never "0,00 €", and stays out of gains. Cardmarket's guide is per product: it mixes every
  language. No API gives Cardmarket prices per card language (the official API is closed to new apps; the "FR prices"
  of resellers are the seller's country). English cards are priced on TCGplayer instead (see Languages).
- A card TCGdex stops listing is never dropped: kept with its last prices, `unavailable: true`, shown as a painted card
  back stamped "Bientôt de retour" (`CardBack`). The 30 classic cards of the 30th Anniversary are in that state.

## Languages: the site, the cards, the money (three separate things)

- **Site language** (texts): French, or English when the browser isn't French. `lib/lang.ts`: `useLang()`, `useT()` →
  `t("Ranger", "Put away")` (both texts side by side in the component, no key dictionary). Every new UI text needs both.
  Can be forced in NookDex OS → Save (« Langue · Language »): zustand `lang`, mirrored in the `nookdex-lang` cookie,
  the page reloads. Server pages (layout metadata, `/` text, notebook pages) read `lib/serverLang.ts` (cookie, else
  Accept-Language; no header = French). Each notebook page has a French and an English version in the same file;
  `src/data/about.ts` holds the notebook text (`ABOUT`, `ABOUT_EN`). Supabase auth e-mails stay French only.
- **Card language**: chosen per set binder (FR/EN stamps in the new binder sheet, default = site language), and per
  card in a free binder (same stamps in its search). It lives in the ids (`lib/cardLang.ts`): a French card keeps its
  TCGdex id (`sv08-001`, like every older save), an English one is `en:sv08-001`; sets likewise (`sv08`, `en:sv08`,
  that's a set binder's `setId`). `lib/catalog.ts` keys ids as it reads files, so the rest of the code just uses
  `collection[card.id]` and never mixes languages. Never cut a card id by hand: `setIdOfCard`, `langOfKey`, `bareId`.
  A binder not in the site's language wears a small "EN"/"FR" sticker (shelf, NookDex OS); shared lists tag such cards.
- Card data in English: `fetch-set --lang=en` writes `public/sets/en/`, `public/logos/en/`, `src/data/catalog-en.json`
  (same TCGdex ids).
- **Prices follow the card's language**: French cards → Cardmarket (euros), English cards → TCGplayer (US market, English
  cards, dollars: `marketPrice` as the trend, `lowPrice` as the low, `tp` = product id for the link; the arrow keeps
  Cardmarket's averages). An English card TCGplayer doesn't sell (Trainer Galleries, Shiny Vault, 30th for now) gets
  Cardmarket's price converted at the ECB rate (`src/data/eur-usd.json`, refreshed by fetch-set), flagged `cm`.
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
  export from NookDex OS) → 2. nickname → 3. first binder.
- Then the guided tour (`src/components/shelf/Tour.tsx`): a spotlight on elements tagged `data-tour="…"`, can't be
  skipped, waits for the player on the key gestures. Replayable from the shelf notebook. Renaming or removing a
  `data-tour` attribute breaks a step.

## E-mails and forms (Brevo)

- Domain nookdex.com authenticated in Brevo. Vercel env: `BREVO_API_KEY`, optional `CONTACT_TO` (default Johan's
  Gmail), `CONTACT_FROM` (default `contact@nookdex.com`).
- `/api/contact`: contact form → e-mail to Johan (topics are sent in French whatever the visitor's language).
- The English waiting list (Brevo list 12, `BREVO_WAITLIST_LIST_ID`) is gone since the English version exists.

## GitHub Actions

- `prices.yml` (daily 11:00 UTC): `fetch-set --force` then `--force --lang=en` refresh binder-set prices and cards
  in both languages (+ missing extra sets), commit to `main` when something moved.
- `watch.yml` (Mondays): re-checks cards shown with an English scan or as a card back, re-downloads sets with news,
  watches TCGdex for new price fields (French Cardmarket prices would show up there); anything new opens or comments
  the issue labelled `veille`.
- The container Claude runs in on the web can't reach TCGdex: run the scripts through these Actions.
