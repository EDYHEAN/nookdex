# Skins et boutique NookDex (lancement : pack Halloween, payant)

Décidé par Johan le 2026-10-14. Point de reprise : ce qui est décidé, ce qu'il faut faire, qui le fait.

## Ce qui est décidé

- On vend des skins NookDex. **Tout ce qui touche à Pokémon reste libre et gratuit** : aucun skin payant ne contient
  d'élément Pokémon (pas de Poké Ball, pas de Pokémon, pas de carte). Le jeu Nook Survivors ne vend rien (ses sprites
  sont CC BY-NC).
- Johan a une micro-entreprise. Cardmarket : aucun souci de leur côté.
- Tout ce qu'il faut pour être en règle : mentions légales (éditeur), CGV, médiateur de la consommation, renonciation
  au droit de rétractation pour le contenu numérique, factures.
- **Halloween est le premier skin, payant** : il lance la boutique. Objectif : en vente vers le 22 octobre (9 jours
  avant Halloween).
- La boutique : **une icône panier bien visible** dans l'en-tête (à côté du son), pas un objet de la scène. Une pastille
  pendant les événements. À l'intérieur, un catalogue façon vente par correspondance 90s. **L'essai sur sa propre pièce
  avant d'acheter**.

## Ce qu'un skin peut changer (du moins cher au plus cher)

- La fenêtre : le ciel est une couche à part (`sky.webp`, `sky-day.webp`).
- La lampe à lave : un thème de plus dans `LAVA_THEMES` (code seulement).
- Les décos : des objets peints seuls sur fond blanc (planche Gemini), découpés et placés dans la scène par le code.
- Warwick : un accessoire (chapeau, écharpe) posé sur ses deux sprites par le code.
- Plus tard : couvertures de classeurs, coques de Game Boy, thèmes de l'OS, une station de radio, des scènes entières.

Une déco ne doit jamais recouvrir ce que le code anime ou rend cliquable : classeurs et étagères, Poké Ball, boîte
mauve, écran du CRT, Game Boy, tasse (vapeur), lampe à lave, lampe de bureau, chat, horloge (aiguilles), tableau en
liège, livres, chaise, carreaux de la fenêtre.

## Pack Halloween : ce qu'il contient

Ciel d'Halloween (nuit et jour), décos (nuit et jour), Warwick en sorcier, lampe à lave citrouille. Prix à fixer
(proposition : 2,99 €).

## Prompts Gemini (Nano Banana Pro, plus haute résolution)

**Pas d'édition de la scène entière** (essai du 2026-10-14) : Gemini repeint tout (≈1024 px au lieu de 2752, objets
déplacés), le découpage par différence devient impossible, et le rendu fait clipart. On fait comme pour les trophées :
les décos peintes **seules, sur fond blanc**, découpées par script puis placées dans la scène par le code (positions,
échelle, lumière de la pièce, lueur des bougies animée). Le ciel, lui, est une image à part : une édition de
`img/sky.jpg` suffit (le cadrage n'a pas besoin d'être identique).

Enregistrer dans `img/halloween/` sous le nom indiqué.

### D1. Planche de décos → `img/halloween/decor-sheet.jpg` (format 4:3, aucune image jointe)

```text
A sheet of 8 small Halloween decorations for a cozy bedroom, each one painted separately, arranged in a neat grid of 4 columns and 2 rows on a plain pure white background, evenly spaced, each object centered in its cell, nothing touching, no shadow on the background.
Painted like the background of a 2000s hand-drawn Japanese animated film: gouache, soft painted edges, visible brushwork, rich textures, warm peach highlights and cool blue-violet shadows. NO black ink outlines, NOT vector clipart, NOT 3D, NOT pixel art.
Row 1, left to right: a carved jack-o'-lantern with a friendly face glowing warmly from inside; a tiny round orange pumpkin with a curly green stem; a cluster of three short melted orange candles with small flames, on a little saucer; a small purple witch hat with an orange band, seen from the front, slightly bent tip.
Row 2, left to right: a dusty white cobweb filling a corner, shaped like a right triangle with its corner at the top left; the same cobweb mirrored, corner at the top right; a black paper bat with open wings; a small glass bowl of wrapped orange and purple candies.
No text, no letters, no logos.
```

### D2. Guirlande → `img/halloween/garland.jpg` (format 16:9, aucune image jointe)

```text
A single long Halloween garland painted alone on a plain pure white background: a thin twine string hanging in a gentle loose curve from the top left corner to the top right corner, with small black paper bats and little white paper ghosts hanging from it by tiny clothespins, alternating, slightly irregular and hand-made, some a bit tilted. Nothing else.
Painted like the background of a 2000s hand-drawn Japanese animated film: gouache, soft painted edges, visible brushwork, warm peach highlights and cool blue-violet shadows. NO black ink outlines, NOT vector clipart, NOT 3D.
No text, no letters, no logos.
```

### S1. Ciel de nuit → `img/halloween/sky.jpg` (joindre `img/sky.jpg`)

```text
Edit the attached image at the highest resolution. Keep the same painting style and the same city. Turn it into a Halloween night: a big low orange full moon, a few small black bat silhouettes crossing in front of it, thin purple clouds, no rain. The city keeps its lights, and a few of its windows glow orange.
No text, no letters, no logos.
```

### S2. Ciel de jour → `img/halloween/sky-day.jpg` (joindre `img/sky-day.jpg`)

```text
Edit the attached image at the highest resolution. Keep the same painting style and the same city. Turn it into a late October golden hour: a warm orange and pink autumn sky, soft glowing clouds, a few orange autumn leaves drifting in the air.
No text, no letters, no logos.
```

Warwick en sorcier : le chapeau de la planche D1, posé sur sa tête par le code (endormi et réveillé).

## À faire

**Johan**
- Les 4 images ci-dessus (D1, D2, S1, S2).
- Un compte Stripe activé avec la micro-entreprise (ou Lemon Squeezy, voir plus bas), puis ses clés dans Vercel.
- Les infos des mentions légales : nom, SIRET, adresse (ou domiciliation), régime de TVA.
- L'adhésion à un médiateur de la consommation (obligatoire pour vendre aux particuliers).
- Lancer le SQL de la table des achats (`docs/supabase.sql`, une fois écrit).

**Claude**
- Le moteur de skins : couches par skin (ciel, décos jour/nuit, chat, lampe à lave), le skin choisi gardé dans la
  sauvegarde et le cloud, l'essai avant achat.
- La boutique (icône panier, catalogue, essai, achat).
- Supabase : table des achats (lecture par le joueur seulement, écriture par le serveur).
- Routes : création du paiement (lié au compte du joueur), webhook signé qui enregistre l'achat.
- Pages : mentions légales, CGV (FR/EN), case de renonciation au droit de rétractation.
- Le découpage des images Halloween (script, sur le modèle de `build-trophies`) et leur placement dans la scène.

## Paiement : Stripe ou un « merchant of record »

- **Stripe** (paiement direct) : frais faibles (de l'ordre de 1,5 % + 0,25 € par carte européenne). Johan facture
  lui-même. En franchise de TVA, sous les seuils, pas de TVA à collecter (« TVA non applicable, art. 293 B du CGI »).
  À confirmer avec un comptable.
- **Lemon Squeezy / Paddle** (ils vendent à sa place) : gèrent TVA et factures partout, mais environ 5 % + 0,50 $ par
  vente, lourd sur un achat à 2-3 €.
- Recommandation : Stripe, tant que Johan est en franchise de TVA.
