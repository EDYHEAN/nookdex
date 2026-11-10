# Veille des sorties (daily routine)

The Claude routine « Veille sorties NookDex » runs every morning (05:30 UTC) and keeps three files up to date, so that a
set's pre-orders and Amazon invites show on nookdex.com the day they open (Johan, 2026-11-10). The blog routine
(docs/blog.md) still does the same on its runs; this one is the quick daily pass, **no post**.

The Action « Alerte sorties » (06:30 UTC, scripts/release-alert.mjs) reads what this routine wrote: a coming set whose
products get their first ASIN sends the « pre-orders are open » mail to the release alert's list. An ASIN is therefore a
promise to people's inboxes: only a real, official listing.

## Each run

1. `git pull` on `main`.
2. **The calendar** (`src/data/releases.json`): the rules of docs/blog.md step 5 (official announcements only, with
   their source, `setId` when predictable, moved dates fixed, entries a month past removed). Set `updated` to today only
   if something changed.
3. **amazon.fr** (`src/data/amazon-products.json`, the rules of docs/blog.md « Keeping the Amazon products up to date »):
   for the worldwide sets coming in the next 90 days and those out in the last 45, look for each product's official
   listing (Elite Trainer Box, display, bundle, tripacks, boxes) with a web search limited to amazon.fr (« site:amazon.fr
   Pokémon <set> Coffret Dresseur d'élite »). Add `asin` from the listing's address (`amazon.fr/dp/<ASIN>`), never a
   guess, never a reseller's listing (the seller must be Amazon or the listing The Pokémon Company's own product). A
   product not listed yet keeps its `q` (a search). Add the products of a newly announced set (`q` only).
4. **amazon.com** (`src/data/amazon-products-us.json`, same shape): the same for the English sets, with a web search
   limited to amazon.com. An ASIN is an official listing only (title « Pokémon TCG: … », The Pokémon Company as the
   maker; never « WAVE 2 », « Bundle of 3 », a reseller's lot). Pictures: `tp:<TCGplayer product id>` from TCGCSV's sealed
   products (tcgcsv.com/tcgplayer/3/<group>/products), as CLAUDE.md says; the daily prices Action downloads them.
5. **Never** open amazon.fr or amazon.com pages with a script, a crawler or a headless browser (Amazon's terms forbid it):
   web search results only. Never anything from pokemon.com behind its bot wall either.
6. Nothing changed: stop there, no commit (each commit on `main` is a production build).
7. Something changed: `npx tsc --noEmit`, then commit on `main` as `Veille sorties: <what>` (e.g. « Veille sorties: me07
   ETB et display sur amazon.fr ») and push.

## What not to do

- No blog post, no change to the code, no other file than the three above.
- No rumor, no leak, no trademark filing: an official announcement or a live listing.
- Don't remove an ASIN because the product is out of stock: invitations and restocks come back.
