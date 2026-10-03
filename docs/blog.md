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
5. Check: `npm ci` if needed, `npx tsc --noEmit`, then `npx next build` must pass.
6. Commit on `main` with the message `Blog: <English title>` and push. Vercel deploys it.

## Subjects

Up next, in this order (take the first one no post covers yet, then go back to the rotation):

1. **The 30th Anniversary set** ("30ᵉ Anniversaire" / "30th Celebration", out September 16, 2026, set id `30th`): what's
   in it, its rarities, the chase cards and their prices. Its 30 classic reprints are not in TCGdex's data yet (shown as
   card backs on the site): talk about them from your sources, but don't `::card` them.
2. **The newest Mega Evolution set** (`me` series in `src/data/catalog.json`, the latest release date): guide and prices.

Then rotate, about one of each kind per month:

- **A set**: a recent or upcoming set explained (release date, size, rarities, notable cards, is it worth opening),
  or the prices of a set (most valuable cards, what rises and falls, the cost of a complete set). Prefer recent sets
  (`me`, `sv`) and the big ones collectors chase. For a new set, only facts confirmed by the official Pokémon site or
  several reliable sources (Pokécardex, PokeBeach, Bulbapedia, pokemon.com); say when something is a rumor.
- **Collector guides**: rarities and their symbols, how to spot a reverse, card conditions (Cardmarket's grades),
  storing and protecting cards, building a master set, buying safely on Cardmarket, French vs English vs Japanese prints.
- **A Pokémon through the TCG**: its most sought-after cards across sets, with their prices.

## Data in the repo (updated every day by the prices Action)

- `public/sets/<setId>.json`: French cards, Cardmarket prices in euros. `public/sets/en/<setId>.json`: English cards,
  TCGplayer prices in dollars (`cm` flag = Cardmarket price converted, say so). `public/sets/ja/`: Japanese, Cardmarket euros.
- A card: `price.trend` (the Cardmarket trend, or the TCGplayer market price for English), `price.low` (cheapest
  offer), `price.avg7` / `price.avg30` (Cardmarket sales averages in euros, all languages mixed), `-Holo` variants for
  reverses. No price = "—", never 0. `unavailable: true` = TCGdex stopped listing it: don't feature it.
- `src/data/catalog.json` (and `-en`, `-ja`): every set, its name, series, release date, card count.
- `pricesUpdated` in a set file: the date to quote ("d'après la tendance Cardmarket du 2 octobre 2026").
- Cardmarket's guide mixes every language of a card: say it whenever a French price is discussed.

## Shape of a post

```markdown
---
title: "Tempête Argentée : les cartes les plus chères en octobre 2026"
description: "One or two sentences, ~150 characters: the search result snippet."
date: 2026-10-03
key: swsh12-top-2026-10
tags: [Tempête Argentée, prix, Cardmarket]
---

> **En bref**
>
> - 3 or 4 bullets: the answers, with their key numbers (AI answers quote this first).

Intro: 2 to 4 sentences that set the scene, in a friendly voice.

::card[swsh12-186]

## A heading per question a reader has
…

::card[swsh12tg-TG14]
::card[swsh12-177]
::card[swsh12tg-TG20]

## Questions fréquentes

### A question as people type it?

The answer in one or two sentences, with its number and date.

## Suivre ta collec

One short paragraph on following this in NookDex.
```

- **En bref** (EN: **In short**): a quote block with 3 or 4 bullets, right after the frontmatter. Always.
- **Cards**: `::card[<card id>]` on its own line. A single one shows the card beside its sheet (set, number, rarity,
  today's price, a link to Cardmarket or TCGplayer): use it once after the intro for the star of the post. Two to four
  lines in a row (nothing but blank lines between them) make a gallery: use it after a section that names several
  cards. 3 to 6 cards per post in all. Ids: French `sv08-001`, `en:sv08-001`, `ja:SV8-033`. No other images.
- **Questions fréquentes** (EN: **FAQ**): 3 questions as `###` headings, each answered in one or two sentences that
  stand on their own (they become FAQ structured data). Always, just before the NookDex paragraph.
- Slug = file name: lowercase, ASCII, words separated by `-`, in the post's language, with the set name and month when
  it's about prices (`tempete-argentee-cartes-les-plus-cheres-octobre-2026`, `silver-tempest-most-valuable-cards-october-2026`).
- `key`: the same in both languages, links the two versions (hreflang).
- Markdown only: `##` / `###` headings, lists, one table when there are numbers to compare, bold. No HTML.

## Voice

- **Talk like a collector to a friend**, not like a press release. French: tutoiement, relaxed and smooth ("Pas de
  surprise", "c'est LA carte que tout le monde veut", "jette un œil", "le bon plan"). English: the same easy tone,
  not a literal translation.
- Short sentences, short paragraphs (4 sentences max). Lead each section with what the reader wants to know, then the
  numbers that prove it. Don't stack figures: a table holds the list, the text tells the story.
- A bit of personality is welcome (a spoiler, a wink, the collector's feeling when a card drops in price), no forced
  jokes, no hype words ("incroyable", "must-have"), no clickbait.
- Still exact: prices with their date, card numbers, release dates. No invented facts, quotes or "experts say". If
  something can't be checked, leave it out. Use each language's official names (Lugia V / Lugia V, Braségali / Blaziken,
  Tempête Argentée / Silver Tempest); French prices in euros from the French files, English prices in dollars from the
  English files.
- 600 to 1,000 words.
- NookDex has no link with Nintendo, Creatures, GAME FREAK or The Pokémon Company: never suggest otherwise.
