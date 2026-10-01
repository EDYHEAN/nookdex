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
  doesn't price shows "—", never "0,00 €", and stays out of gains.
- A card TCGdex stops listing is never dropped: kept with its last prices, `unavailable: true`, shown as a painted card
  back stamped "Bientôt de retour" (`CardBack`). The 30 classic cards of the 30th Anniversary are in that state.

## Languages (French and English)

- The site speaks French, or English when the browser isn't French. `lib/lang.ts`: `useLang()`, `useT()` →
  `t("Ranger", "Put away")` (both texts side by side in the component, no key dictionary). Every new UI text needs both.
- The choice can be forced in NookDex OS → Save (« Langue · Language »): stored in zustand (`lang`), mirrored in the
  `nookdex-lang` cookie, and the page reloads (card data is per language).
- Server pages (layout metadata, `/` text, notebook pages) read `lib/serverLang.ts` (cookie, else Accept-Language;
  no header = French). Each notebook page has a French and an English version in the same file.
- Card data in English: `fetch-set --lang=en` writes `public/sets/en/`, `public/logos/en/`, `src/data/catalog-en.json`
  (same card ids). `lib/catalog.ts` picks the language's files and falls back to the French ones (set missing in
  English, English data not fetched yet). Prices are the same Cardmarket prices, shown as €12.50 in English.
- `src/data/about.ts` holds the notebook text in both languages (`ABOUT`, `ABOUT_EN`).
- Supabase auth e-mails stay French only (one template per kind in Supabase).

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
