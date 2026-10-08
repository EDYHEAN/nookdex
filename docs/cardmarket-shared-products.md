# Cards sharing one Cardmarket product (bug, found 2026-10-08)

Johan noticed it in NookDex OS → "Toutes les cartes": Mewtwo XY101, Mewtwo EX XY107, Mewtwo-EX XY125 and Mew XY192
(`xyp`) all show 5 550,00 €, and "Voir sur Cardmarket" opens the same page
(cardmarket.com/fr/Pokemon/Products/Singles/XY-Promos/Mew) for all four.

## Why

TCGdex gives several different cards the same Cardmarket product id (`pricing.cardmarket.idProduct`, our `price.cmId`).
fetch-set copies it, and `applyGuide` then gives each of these cards that one product's prices from Cardmarket's guide. The
link uses `cmId` too (`binder/Inspector.tsx`, `lib/blog.ts`). So every card in such a group shows the same price and
opens the same page. At most one of them is the right card, and nothing in our files says which one.

It's TCGdex's data, not our code: worth reporting to them (github.com/tcgdex/cards-database) with the examples below.

## How big (files of 2026-10-08)

French cards: **1 571 cards out of the 18 261 with a `cmId` (8.6 %)**, in 750 shared products.

- **139 groups whose cards have different names**: clearly wrong.
  - `xyp`: 554275 = XY101 Mewtwo, XY107 Mewtwo EX, XY125 Mewtwo-EX, XY192 Mew (5 550 €, Mew's product).
  - `ex2` and `ex4` mixed up number by number: 275778 = ex4 #1 "Cacturne de Team Aqua" and ex2 #1 "Armaldo"; 275782 =
    ex4 #5 "Sharpedo de Team Aqua" and ex2 #5 "Pyroli" (131,91 €)… 91 such pairs across two sets.
  - `xyp` again: 554217 = the seven badges XY203-XY210; 553491 = XY147 Hoopa, XY71 and XY85 Hoopa EX.
- **611 groups whose cards have the same name** but different numbers: two prints of one card. Only one of them has the
  right price.
  - `swsh1`: Rosélia 2 and 3, Badabouin 12 and 13, Gorythmic 14 (holo) and 15.
  - `base5`: the holo and the plain print of each Dark Pokémon (Dracolosse obscur 5 and 22: 1 410,44 € for both).
  - `xy5`: Jungko 8 and 9, Desséliande EX 19 and 145 (the full art).

Most affected sets: `ex2` and `ex4` (91 each), `ecard1` (37), `xy5` (35), `xyp` (27), `swsh1` (23), `bw1` and `bw2` (21).
Recent `sv`/`me` sets: none.

English cards: 794 groups, 1 662 cards, the same sets. Their price comes from TCGplayer, so only the ↗ ↘ arrow (Cardmarket's
`avg7`/`avg30`) is wrong, plus the price of those without TCGplayer (`cm`, converted from Cardmarket).
Japanese cards: 3 groups, 6 cards (`SV9a`).

To count again (from the repo root):

```sh
python3 - <<'EOF'
import json, glob
from collections import defaultdict
g = defaultdict(list)
for f in glob.glob('public/sets/*.json'):  # public/sets/en/*.json, public/sets/ja/*.json
    if f.endswith('index.json'): continue
    d = json.load(open(f))
    for c in d['cards']:
        if (c.get('price') or {}).get('cmId'): g[c['price']['cmId']].append((d['id'], c['num'], c['name']))
shared = {k: v for k, v in g.items() if len(v) > 1}
print(len(shared), 'products,', sum(map(len, shared.values())), 'cards')
EOF
```

## Ways to fix it (to choose)

The fix goes in `scripts/fetch-set.mjs`: a pass over every set file of the language after `applyGuide` and before the
index (`index.json` copies each card's trend). It runs on every Actions run, because `--force` downloads TCGdex's ids
again each day. Note: the Claude container can't reach Cardmarket nor TCGdex, so this has to be tested through the
Actions (or locally at home).

1. **"—" for every card of a shared product** (simplest, can be tested on the files already there): drop `cmId` and the
   prices of each card in a group. No more wrong prices, but the right card of each group (Mew) loses its price too.
   The link falls back to a search by name. The collection values of players owning these cards go down (their
   wrong prices leave the total).
2. **Keep the card whose name matches the product**: download Cardmarket's product catalogue (Data page, "Singles",
   probably `https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json`: to check). It
   gives each `idProduct`'s English name, matched against the card's English name (`public/sets/en/<set>.json`, same
   bare id). Mew keeps its price and the Mewtwos go to "—". Same-name groups can't be split this way: "—" for them,
   as in 1.
3. **Only the groups with different names** (139): the same-name prints keep a price that's sometimes wrong (holo /
   plain of the Wizards sets).

Either way: the history (`scripts/price-history.mjs`) already writes null for a card without a trend, and the English cards only
need `cmId`, `avg7`/`avg30` dropped (plus their prices when flagged `cm`).
