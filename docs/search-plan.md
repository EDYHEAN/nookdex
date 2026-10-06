# Search and wishlist over every card: plan

Handoff for the next session (VS Code). Read the repo's CLAUDE.md first. Decided with Johan on 2026-10-06 (his answers
are in "Decisions" at the end). Status: **steps 1 and 2 are built** (PR "All cards"), the wishlist (step 3) is next.

## Built (2026-10-06)

- `lib/search.ts`: `rowsOf(index)` (rows read once per index, memoised), `matcher`, `relevance`, `searchRows` (CardPicker).
- The index rows carry the rarity: `[key, name, num, set, img, trend, rarity, aka?]` (fetch-set; `aka` moved to the end).
- `lib/rarity.ts`: the binder sort's rank ladder (0-13, -1 unknown) grouped in 9 tiers (`RARITY_TIERS`) for the filter.
- NookDex OS tab "Toutes les cartes / All cards" (`computer/AllCards.tsx`, replaces "Recherche"): card grid, FR/EN/JAP
  toggles, menus Tri / Rareté / Année / Extension / Collection. The year and set menus only list what the search and
  the other filters leave. Opens on "most valuable first". Search and filters are kept while the page lives.
- Card sheet over the OS for any card (`App` `openCards`, Inspector without `onAdd`): arrows walk the result list,
  in colour (not greyed), "Ouvrir son classeur ▸" when a binder holds it. "Je l'ai !" asks where the copy goes
  (`binder/AddTo.tsx`): its set binder, a free binder (first empty pocket), a new set binder (not for extra sets), or a
  new free binder "Mes cartes". `goToCard` falls back to that sheet.
- Welcome, step 3: "Pas encore de collection ? Explore d'abord toutes les cartes" opens the OS on that tab. Their first
  binder, from the shelf's +, then starts the guided tour.
- Not done: drop rates (no source gives them per card; a hand-made table per recent set, maybe later).

## Why

NookDex OS → "Recherche" only finds the cards of the player's own binders. A player who wants to look up a card's
price (to buy, to speculate) finds nothing unless the card's set is already on their shelf. The "Wishlist" tab has the
same limit: it can only list the cards missing from the player's set binders.

What we want:
- Search reaches every card we have, in French, English and Japanese (about 43,000).
- It sorts, by price above all.
- From a result, the player can open the card's sheet even when it's in none of their binders.
- The wishlist can hold any card, in any language, and sorts the same way.

## Where things are today

| What | Where | Notes |
| --- | --- | --- |
| OS tabs | `src/components/computer/Computer.tsx` | `TABS`, `Search`, `Wishlist`, `CardRow`; `entries` = cards of the set binders + owned cards only |
| Card search of the free binders | `src/components/binder/CardPicker.tsx` | already searches **every** card of a language: `loadIndex(lang)` + `search()` (name, number, set code / name, Japanese `aka`) |
| Search index | `public/sets[/en,/ja]/index.json`, built at the end of `scripts/fetch-set.mjs` | rows `[key, name, num, setKey, imgPath, trend, aka?]`; FR 18,888 cards (285 KB gzip), EN 20,011 (296 KB), JA 3,882 (87 KB) |
| Loading | `src/lib/catalog.ts` | `loadIndex(lang)` (on demand, keyed ids), `loadSet(key)`, `setIdOfCard(key)` |
| Prices | `src/lib/price.ts` | `priceOf` converts to the player's currency; `convert` (EUR ↔ USD at `src/data/eur-usd.json`) is private |
| Card sheet | `src/components/binder/Inspector.tsx` | props `card, binderId, onClose, onNavigate, onAdd`: made for a card inside a binder |
| "Go to card" | `App.tsx` `goToCard` | opens the card's binder; **does nothing** when no binder holds the card |
| Save | `src/lib/store.ts` (`version: 4`, `makeBackup`, `isBackup`, `importBackup`, `migrate`), `src/lib/cloud.ts` (syncs the backup JSON) | |

Index trends are in the card's own currency: FR and JA rows in euros, EN rows in dollars (extra EN sets are already
converted when the index is built). About 2,000 cards have no price: they show "—" and go last in a price sort.

## What we're building

### 1. A shared search (`src/lib/search.ts`)
- Move `norm`, `setsInfo` and `search()` out of CardPicker into a lib, used by CardPicker and the OS.
- Search several languages at once: run the same matcher over each loaded index and merge the results.
- Normalise names once per index (memoised), not on every keystroke. Use `useDeferredValue(q)` in the component.
  40k rows is fine on a phone that way.
- Sorts:
  - relevance (exact name first, then starts-with, then contains; ties: newest set first);
  - price ↓ and price ↑, compared in the player's currency (export a `convertPrice(n, from, to)` from `price.ts`;
    a row's currency = `currencyOf(langOfKey(key))`);
  - newest set (`catalogSet(setKey).releaseDate`);
  - number.
- No cap before sorting (sort first, then show 100 with "voir plus"); keep a cap for CardPicker (it never sorts).

### 2. The "Recherche" tab
- Same field (≥ 16 px on mobile), plus:
  - language stamps that can be combined (FR / EN / JAP; default = **the site's language**: Johan's call,
    2026-10-06). Reuse `LangStamps` if it can take several values, else small toggles;
  - a sort button that cycles like the wishlist's ("Tri : pertinence / prix ↓ / prix ↑ / récentes");
  - a filter "toutes / possédées / manquantes".
- Row: scan, set code + number, name, a small language tag when it isn't the site's (`langLabel`), price in the
  player's currency, "✓" when owned, and a ★ to add it to the wishlist.
- Empty field + a price sort = "the most expensive cards" (a free speculation view). Cheap to offer.
- Every text in both languages (`tr("…", "…")`).

### 3. A card sheet for any card
- Click on a result:
  - if a binder holds the card, keep today's `goToCard`;
  - else `await loadSet(setIdOfCard(key))` and open the Inspector over the OS in a **browse** mode.
- Browse mode: `binderId` null and no binder actions. Shown: price table, curve, market link, ★ wishlist, and
  "+ Ajouter à ma collection" with a choice of where the copy goes (see "Adding from the sheet" below).
- `onNavigate` walks the result list.
- Fix `goToCard`'s silent `return` at the same time: it should open the browse sheet.

### 4. A wishlist of any card
- Store: `wishlist: string[]` (card keys, any language, newest first) in zustand, `toggleWish(key)`.
  - Persisted (`version: 5`, `migrate`: `wishlist: []`).
  - Added to `makeBackup` (version 5), `isBackup` (accept 2-5) and `importBackup`.
  - `cloud.ts` syncs the backup JSON, so it follows. Check its fingerprint includes the new field.
- A card leaves the wishlist when a copy of it is added (in the store's add-copy action): wanted, then got. A toast
  says so with an undo ("Retirée de ta wishlist · annuler"), rather than a pop-up that asks: one tap less for the
  usual case, and the rare "I want a second one" is one tap to undo.
- "Wishlist" tab = ★ cards + the cards missing from set binders. Filter "tout / ★ / manquantes de mes classeurs",
  the same sorts, total cost in the player's currency, "Copier la liste" (with `langNote`).
- Draw rows from the index rows (name, scan, trend), not set files: no need to download every wished card's set.
  Load the indexes of the languages the wishlist uses when the tab opens.
- Keep `data-tour="tab-wish"` (the guided tour clicks it).

### 5. Later, for speculation
- A 7-day move per card in the index (`avg7 / avg30`, the card sheet's ↗ ↘ rule). Gives a "plus fortes hausses" sort.
  Changes the index rows: a new last field, with `aka` moved or kept at its index. Rebuilt by the daily Action
  (the web container can't reach TCGdex).
- Or from `public/history/<lang>/<set>.json` (the daily trend since 2026-10-04): real moves over 7 / 30 days, once
  there's enough history.
- Filters by set / rarity (rarity isn't in the index yet).

## Order of work (one PR each, squash)

1. `lib/search.ts` + "Recherche" over every card, sorts, languages, filters. Clicking an unowned card does nothing
   new yet.
2. Inspector browse mode + `goToCard` fallback.
3. Wishlist in the store / save / cloud + ★ in search and in the card sheet + the new Wishlist tab.
4. (later) price moves in the index.

## Pitfalls

- Never cut ids by hand: `setIdOfCard`, `langOfKey`, `bareId`, `keyOf`.
- Same bare id in FR and EN (`sv08-001` vs `en:sv08-001`): two different cards, two rows. Don't dedupe them.
- Japanese cards: Japanese names; search also hits `aka` (French and English names).
- Prices: never "0,00 €" for an unpriced card. It's "—", sorted last.
- Loading three indexes is ~670 KB gzip: only on demand (when a language is ticked), never at boot. PageSpeed only
  sees the loader, so the boot must stay as light as it is.
- The OS keyboard shortcuts (digits switch tabs) must not fire while typing (already handled for INPUT).
- Before each PR: `npx tsc --noEmit` (run `npx next typegen` first on a fresh clone), `npx eslint src`, and
  screenshots at 1400×900 and 390×800 (`?skip&os` opens the OS).

## Adding from the sheet: where the copy goes

How copies work today (`Copy.at`, `lib/binders.ts`): a copy lives in **one** place. Without `at` it's in its own set's
binder; with `at: { binder, pocket }` it sits in a free binder's pocket. A set binder still shows a card as owned when
its only copy is in a free binder, tagged "dans <free binder>" (`tagOf` in BinderView). Totals count the copy once.

So "+ Ajouter à ma collection" asks where the copy goes:
- **"Dans son classeur <set>"**, when the player has that set's binder in the card's language. Default when it exists.
- **"Dans un classeur libre : <name>"**, one line per free binder. The copy goes in the first empty pocket.
- No set binder and no free binder: offer to create the set's binder (same as the "new binder" sheet does).

Johan's example: the Silver Tempest binder (French) is on the shelf, and he puts his alt-art Lugia in a free binder
"Favorites". The copy sits in "Favorites"; the Silver Tempest binder shows the Lugia as owned, tagged "dans Favorites".
It counts once in the value and in the set's completion. A second copy can go in the set binder: the sheet then shows
×2, one in each.

## Decisions (Johan, 2026-10-06)

- A wishlist card leaves the wishlist once owned (with the undo toast above).
- Search languages: the site's language by default (French site → FR cards, English site → EN cards); the others one tap away.
- "Add to my collection" in the browse sheet from v1, with the choice of binder above.
