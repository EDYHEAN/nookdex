# The blog: how a post is written (guide for the scheduled routine)

The NookDex blog (`/blog`, opened from the cork board above the desk) gets two posts a week, written by a scheduled
Claude routine that follows this file. Its job is SEO and GEO: pages that Google and AI assistants can quote, about
the Pokémon TCG, that lead collectors to the desk. Read the repo's CLAUDE.md first (site, languages, prices).

## One run = one article, in French and English

1. `git pull` on `main`.
2. Pick a subject (see below) that no post in `content/blog/` already covers: read the titles first. Never repeat a
   subject with the same angle; a price update of the same set is fine if a month or more has passed and the numbers moved.
3. Gather the facts. **Every number comes from the repo's data or from a source you read during this run.**
4. Write `content/blog/fr/<slug-fr>.md` and `content/blog/en/<slug-en>.md` (same `key`, same date: today).
5. Check: `npm ci` if needed, `npx tsc --noEmit`, then `npx next build` must pass (it prerenders every post).
6. Commit on `main` with the message `Blog: <English title>` and push. Vercel deploys it.

## Subjects (rotate, about one of each kind per month)

- **Prices of a set**: most valuable cards, what rises and falls (trend vs `avg7` / `avg30`), the cost of a complete
  set. Prefer recent sets (`me`, `sv` series) and the big ones collectors chase.
- **A new or upcoming set**: release date, size, notable cards, what to expect. Only facts confirmed by the official
  Pokémon site or several reliable sources (Pokécardex, PokeBeach, Bulbapedia, pokemon.com); say when a fact is a rumor.
- **Collector guides**: rarities and their symbols, how to spot a reverse, card conditions (Cardmarket's grades),
  how to store and protect cards, building a master set, buying safely on Cardmarket, French vs English vs Japanese prints.
- **A Pokémon through the TCG**: its most sought-after cards across sets, with their prices.

## Data in the repo (updated every day by the prices Action)

- `public/sets/<setId>.json`: French cards, Cardmarket prices in euros. `public/sets/en/<setId>.json`: English cards,
  TCGplayer prices in dollars (`cm` flag = Cardmarket price converted, say so). `public/sets/ja/`: Japanese, Cardmarket euros.
- A card: `price.trend` (the Cardmarket trend, or the TCGplayer market price for English), `price.low` (cheapest
  offer), `price.avg7` / `price.avg30` (Cardmarket sales averages in euros, all languages mixed), `-Holo` variants for
  reverses. No price = "—", never 0. `unavailable: true` = TCGdex stopped listing it: don't feature it.
- `src/data/catalog.json` (and `-en`, `-ja`): every set, its name, series, release date, card count.
- `pricesUpdated` in a set file: the date to quote ("d'après la tendance Cardmarket du 2 octobre 2026").
- Cardmarket's guide mixes every language of a card: write it whenever a French price is discussed.

## File format

```markdown
---
title: "Tempête Argentée : les cartes les plus chères en octobre 2026"
description: "One or two sentences, ~150 characters: the search result snippet."
date: 2026-10-03
key: swsh12-top-2026-10
tags: [Tempête Argentée, prix, Cardmarket]
---

Intro paragraph that answers the question at once (AI answers quote the first lines).

::card[swsh12-186]

## A heading per question a reader has
```

- Slug = file name: lowercase, ASCII, words separated by `-`, in the post's language, with the set name and month when
  it's about prices (`tempete-argentee-cartes-les-plus-cheres-octobre-2026`, `silver-tempest-most-valuable-cards-october-2026`).
- `key`: the same in both languages, links the two versions (hreflang).
- `::card[<card id>]` on its own line draws a card of the site's data with its scan and price: French id (`sv08-001`),
  `en:sv08-001`, `ja:SV8-033`. Use 2 to 4 per post, for the cards the text talks about. No other images.
- Markdown: headings `##` / `###`, lists, tables, bold, links. No HTML.

## Writing

- French: tutoiement, warm and simple, like the rest of the site. English: the same tone, not a literal translation.
  Use each language's official card and set names (Lugia V / Lugia V, Braségali / Blaziken, Tempête Argentée / Silver
  Tempest); French prices in euros from the French files, English prices in dollars from the English files.
- 500 to 900 words. Lead with the answer, then the details. One table when there are numbers to compare.
- Concrete and checkable: exact prices with their date, card numbers, release dates. No filler, no invented quotes,
  no "experts say". If a fact can't be checked, leave it out.
- End with a short paragraph on how to follow this in NookDex (binder per set, daily prices, wishlist), no hard sell.
- NookDex has no link with Nintendo, Creatures, GAME FREAK or The Pokémon Company: never suggest otherwise.
