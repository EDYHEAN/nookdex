# Instagram & TikTok: plan

Ideas noted with Johan on 2026-10-07 (80 players then). Nothing is built yet. Read the repo's CLAUDE.md first.

## Why it fits

The painted desk, the lofi music, cards filed in binders: the "cosy" look that works on both networks. Everything we
need is already in the site (daily prices, price history, release calendar, blog, share picture).

## Content ideas

- **Short screen recordings of the app** (phone, with the sounds): opening a binder, filing a card, the celebration when
  a set is complete, riffling through pages, the cat. No heavy editing needed.
- **Numbers from our own prices** (the daily files in `public/sets/`, history in `public/history/` since 2026-10-04):
  - "The 5 most expensive cards of <set>"
  - "The cards that went up the most this week" (and down)
  - "What a complete <set> costs, one of each"
- **Releases**: `src/data/releases.json` and the blog give a subject a week (the month's releases, a set preview 21 days
  before, its first prices after). Recycle each blog post as a post / carousel.
- **The players**: the "Partager ↗" picture of a binder is already 1080×1350 (Instagram portrait). Repost players'
  progress, with their OK.
- Accounts named `@nookdex` (not "pokemon…" in the handle: a trademark complaint can take an account down).

## On the site (to do once the accounts exist)

- Links to the accounts: shelf notebook (`AboutBook`), `/a-propos`, and `sameAs` in the home's `WebApplication`
  JSON-LD (`HomeText`) so search engines tie the accounts to the site.
- The @ on the share picture (`app/share/progress/route.tsx`).
- **Weekly ready-to-post visuals**, same engine as the share picture (next/og): story / TikTok 1080×1920 and portrait
  1080×1350. "Top risers of the week", "most expensive set", "next release". Either a route per visual (noindex), or a
  weekly Action that writes the PNGs somewhere Johan picks them up.

## Rights and money (notes, not legal advice)

- Already in place: "unofficial fan project, not affiliated with Nintendo, Creatures, GAME FREAK or The Pokémon
  Company" in `/conditions`, `/a-propos` and the shelf notebook. Keep it, and put it in the social bios too.
- Card scans and names belong to The Pokémon Company. Showing them to identify cards (a tracker, a price guide) is
  what Cardmarket, TCGplayer, PriceCharting, Collectr… all do and is tolerated, not licensed. France has no "fair use".
- Money changes how a rights holder looks at a fan project. From low to high risk:
  1. Tips (PayPal.me, the cat): low.
  2. Affiliate links to Cardmarket / TCGplayer: low, common in the hobby; check each program's terms.
  3. Ads: medium (money made next to their pictures).
  4. A paid plan: fine if it sells NookDex's own features (sync, stats, alerts), never access to the cards' pictures.
  5. Merch or anything showing Pokémon, Pokéballs or card art: no.
- Things to keep in mind: the painted scene shows Pokéballs and Pokémon boosters; "Nook" also evokes Animal Crossing
  (Tom Nook, Nintendo). Fine for a fan project, worth a look before earning real money.
- Data sources: TCGdex (open API; scans © The Pokémon Company), Cardmarket prices through TCGdex, TCGplayer prices
  through TCGCSV. Check their terms for commercial use before ads or a paid plan.
- Money in France: regular income (tips, affiliates, ads) is taxable; a micro-entreprise is the simple frame. PayPal
  asks for a business account for a commercial activity.
- Before monetising for real: a lawyer specialised in IP for a one-off review (a few hundred euros) is worth it.
