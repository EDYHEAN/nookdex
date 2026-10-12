# Instagram and TikTok posts: how the weekly routine works

A scheduled Claude routine prepares NookDex's social posts once a week. **It never publishes**: Johan posts them by
hand from https://nookdex.com/studio on his phone (share the slides to Instagram, the video to TikTok, the caption is
copied on the way). Change the editorial line here, not in the routine's prompt.

## Where things are

- Posts live on the **`social` branch** (never deployed by Vercel), not on `main`:
  - `posts/<YYYY-MM-DD>-<slug>/post.json`: one post (format below). **This is all the routine writes.**
  - `renders/<id>/`: its pictures (`slide-01.jpg`…) and TikTok video (`tiktok.mp4`), drawn by the Action « Rendu des
    posts » (`.github/workflows/rendu.yml` on that branch) with `scripts/social/render.mjs` from `main`, a minute or two
    after the push. `renders/index.json` is what the studio reads.
  - `assets/`: app screenshots and photos a slide may show (`room.jpg`, `wishbinder.jpg`, `case.jpg`, `search.jpg`,
    `wishos.jpg`, `wishpick.jpg`, `toast.jpg`, `me05.jpg`, `carapuce-recto-verso.jpg`, `warwick.png`).
- To work on it: `git fetch origin social && git worktree add ../social social`, write the post, commit, push the
  `social` branch. Read card data from `main` (`public/sets/…`, `src/data/catalog*.json`, `public/history/…`).
- Posts made by hand (Claude in a local session) are `"prerendered": true`: their files are in `renders/` already.

## The week

Run on Sunday morning; prepare **Monday, Wednesday and Friday of the coming week** (3 posts), skipping a day that already
has a post. Every post has a **TikTok video** (`tiktok`), drawn from its slides by `scripts/social/motion.mjs`: each
slide becomes an animated scene (see "The video" below). On Instagram a post is **one** thing, never both:

- `instagram`: the carousel (its pictures). For the posts people keep: NookDex features, news, top 5s, themed pages.
- `reels`: the same video as TikTok, as an Instagram Reel. For the games (devine le prix, zoom, find): they live by
  their motion and reach people who don't follow yet. One or two a week.

So `"platforms": ["instagram", "tiktok"]` or `["reels", "tiktok"]`. Johan may also post a carousel's video as a Reel himself, 3 to 5 days
later, when the subject did well (he adds `reels` to its platforms to tick it in the studio): never plan both the same day. A mix over the week, in this order of priority:

1. **news** (only when there is real news): a set revealed or dated, a product announced, a big tournament result. Check
   `src/data/releases.json` and the sources below. Confirmed by an official source or two reliable ones, else not a post.
   A set coming out within 21 days always earns one (the cards it shows, the date, "prépare ta wishlist").
2. **fact**: a number from our own data: a set's top 5 (`price` slides), what one of each costs (`total`), the card
   that rose the most this week (from `public/history/fr/<set>.json`, only moves on cards worth 10 € or more, and only
   once the history covers 14+ days), the most expensive card of a Pokémon across sets.
3. **fun**: a game or a themed page. Cards full screen, almost no text (Johan, 2026-10-11). Ideas below.
4. **feature**: something NookDex does (wishlists, trophies, the search by printed number, sharing a binder…), from
   the road log (`src/data/changelog.ts`) and the `assets/` screenshots. At most one a week; skip if nothing new.

Never two posts of the same kind in a row. At least one fun post a week.

## Sources for the news

Read them during the run (web fetch / search). Cite nothing on the picture; the caption may name the source.

- pokemon.com: https://www.pokemon.com/fr/actualites-pokemon and https://www.pokemon.com/us/pokemon-news
- PokeBeach (RSS): https://www.pokebeach.com/feed
- Pokécardex: https://www.pokecardex.com
- r/PokemonTCG, top of the week (RSS): https://www.reddit.com/r/PokemonTCG/top/.rss?t=week (for what people talk about;
  never a source of facts)
- NookDex's own blog (RSS): https://nookdex.com/blog/rss.xml, a post of the week can become a carousel.

Rumors and leaks: no.

## post.json

```json
{
  "date": "2026-11-02",
  "time": "18:30",
  "platforms": ["instagram", "tiktok"],
  "kind": "fact",
  "format": "post",
  "title": "Top 5 Règne Delta",
  "note": "Optional line for Johan (what to check, a sticker to add).",
  "prices": true,
  "caption": "Instagram caption (French).",
  "captionTiktok": "Optional shorter caption for TikTok.",
  "slides": [ { "type": "cover", "…": "…" } ]
}
```

- `kind`: `news` | `fact` | `fun` | `feature`. `format`: `post` (1080×1350) or `story` (1080×1920, Instagram only).
- `prices: true` when a slide shows a price: the Action draws it again with the day's prices the day before and the day.
- Card ids are the site's keys: `sv08-238` (French), `en:sv08-238` (English), `ja:SV8-033` (Japanese). Check every id
  exists in `public/sets/…` (sub-sets like `swsh12tg-TG05` live in their main set's file). Use French cards, names as in
  the French files (Chochodile, not Fuecoco).
- Texts may hold `<br>`, `<b>`, `<em>`. Press Start 2P (titles, kickers, banners) has **no accented capitals**: write
  kickers and banners in capitals without accents (`TROPHEES`, `CHERES`), titles in mixed case (accents fine).

### Slide types

| type | fields | for |
| --- | --- | --- |
| `cover` | `kicker`, `title`, `size` (title px, ~100-130), `cards` (3 ids, the middle one in front) or `asset`, `ghosts` (indexes greyed with a ★), `banner` | the first slide of every carousel (what the feed shows) |
| `paper` | `kicker`, `title`, `em` (second line in red), `lead`, `list`, `cards` (1-3), `asset`, `ending` | an information slide |
| `price` | `kicker`, `card`, `rank` | a card and its price (top 5) |
| `total` | `set`, `kicker`, `asset`, `ending` | what one card of each of a set costs |
| `grid` | `cards` (4, 6 or 9), `label` | a themed page, full screen |
| `duel` | `a`, `b`, `label`, `question` | "which one is worth more?" |
| `duelAnswers` | `rounds` (`[[a, b], …]`), `label` | the answers, and where the prices come from (always last) |
| `zoom` | `card`, `rect` `[x, y, w, h]` in the 600×825 scan (w:h = 4:5), `label` | a close-up |
| `find` | `card`, `blur` `[x, y, w, h]`, `label` | a Pokémon to find, blurred, name and texts covered |
| `reveal` | `items` (`[{ card, rect, name }]`), `label` | the answers of zooms / finds |
| `end` | `kicker`, `title`, `lead` | the closing question and the address |

A carousel: `cover`, 2-6 slides, an ending (`end`, `total` or `duelAnswers`). A fun page: a single `grid`. Keep 3-7 slides.

## The video (TikTok, Reels)

Made from the same slides, 1080×1920, 20-35 s, no sound (Johan adds a trending one in the app). Each slide type is a
scene: `cover` (title letter by letter, cards flying in, banner slam), `paper` (the paper card rises, lines pop),
`price` (rank slam, card flip, price counting up), `total` (the sum counting), `grid` (cards popping one by one),
`duel` (cards sliding in, VS, a 3-2-1 bar), `duelAnswers` (one scene a round: loser greyed, winner glowing, then the
source of the prices), `zoom` (close-up, 3-2-1), `find` (blurred, a magnifier wandering), `reveal` (the camera pulls back
from the spot to the whole card), `end` (Warwick, the address, "abonne-toi"). A closing `end` scene is added if the
post has none. A progress bar on top tells how many scenes are left (people stay to the end).

- **A top 5 counts down** in the video: give the `price` slides from #5 to #1 (the carousel shows #1 first: write the
  carousel order in `slides` and the countdown in `"motion"`, a second list of slides used for the video only).
- TikTok and Instagram cover the right edge and the bottom of the screen: the scenes keep their text between y 200 and
  y 1480; don't write long kickers or banners (a banner shrinks past ~26 characters).
- The first two seconds decide: the cover must show the cards and the hook at once.

## Fun posts

- **Themed page** (`grid`, 9 cards): one idea, the most beautiful cards of it (illustration rares and up): a colour,
  a season or holiday, a type, an illustrator, a region, cats, sleeping Pokémon, the sea… Pick by rarity and name from
  the set files; prefer recent sets (their scans are sharp).
- **Devine le prix** (`duel` ×3 + `duelAnswers`): pairs where the answer surprises (an old holo vs a new illustration,
  the same Pokémon in two sets). `prices: true`.
- **Zoom / find**: the routine can't look at the pictures, so it only uses the spots below (checked by eye). Never the
  head (too easy).
  - zoom `sv03.5-174` Nidoking, belly and claws `[270, 250, 128, 160]`
  - zoom `sv03.5-171` Carabaffe, tail `[350, 320, 128, 160]`
  - zoom `sv03.5-179` M. Mime, legs and shoes `[190, 276, 128, 160]`
  - find `sv04-195` Zébibron in the forest, blur `[350, 268, 115, 158]`
  Already used in October (`2026-10-28-zoom`): don't repeat them within two months. New spots are added here by a
  local session that can look at the cards.

## Captions

French, the NookDex voice (warm, a bit playful, tutoiement), 3-8 short lines, one question to the reader, then
`nookdex.com (lien en bio)`, then 6-9 hashtags (`#pokemontcg #cartespokemon #collectionpokemon #pokemonfr` + the
subject's). A price is always "prix tendance Cardmarket du <day>". TikTok caption: one or two lines + 4-6 hashtags.

## After writing

Commit on `social` (`Post <date>: <title>`), push. Check two minutes later that the Action « Rendu des posts » passed;
if it failed (an unknown card id, a typo in a type), fix the post.json and push again.
