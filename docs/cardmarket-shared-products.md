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

## The fix (2026-10-08): `fixSharedProducts` in fetch-set

Cardmarket's product list (`products_singles_6.json`, next to the price guide on their Data page) gives each
`idProduct` its English name and its expansion (`idExpansion`). On every run, after the downloads and before the guide,
each shared product is sorted out against the cards' English names (French cards: `public/sets/en/<set>.json`):

- the card named like the product keeps it (Mew XY192: 5 550 €);
- another card gets the product of its own name in its set's Cardmarket expansion when exactly one is free (ex4's Team
  Aqua and Magma cards: their own products, 200 ids after ex2's; Hoopa EX XY71);
- prints of one card (same name) get the expansion's products of that name in number order, only if that agrees with
  the prints already holding their own product. Checked on the guide's prices: the holo is always the dearer one (Dark
  Dragonite 5: 1 316 €, 22: 24 €);
- anything else gets "—" (no `cmId`, no prices; the link searches by name): Mewtwo XY101, the Gym Badges, Charizard EX
  XY17/XY29…

First run on the files of 2026-10-08: French 569 cards moved to their own product and 395 to "—" (out of 1 571);
English 593 moved, 442 to "—"; Japanese 6 to "—" (no English names to match). No product is shared afterwards.

English cards keep TCGplayer's prices; the guide now also fills their Cardmarket averages (the ↗ ↘ arrow) and, for those
TCGplayer doesn't sell, their converted price. Worth reporting to TCGdex all the same (github.com/tcgdex/cards-database).
