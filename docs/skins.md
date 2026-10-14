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
- Les décos : une couche par-dessus la scène, découpée par différence (comme le chat) : une édition de la scène
  maître avec les décos ajoutées, moins la scène maître. Une version nuit et une version jour.
- Warwick : ses deux sprites (endormi, réveillé) redécoupés depuis une édition avec un costume.
- Plus tard : couvertures de classeurs, coques de Game Boy, thèmes de l'OS, une station de radio, des scènes entières.

Une déco ne doit jamais recouvrir ce que le code anime ou rend cliquable : classeurs et étagères, Poké Ball, boîte
mauve, écran du CRT, Game Boy, tasse (vapeur), lampe à lave, lampe de bureau, chat, horloge (aiguilles), tableau en
liège, livres, chaise, carreaux de la fenêtre.

## Pack Halloween : ce qu'il contient

Ciel d'Halloween (nuit et jour), décos (nuit et jour), Warwick en sorcier, lampe à lave citrouille. Prix à fixer
(proposition : 2,99 €).

## Prompts Gemini (Nano Banana Pro, plus haute résolution)

Toujours joindre l'image de départ indiquée, et garder le cadrage et la taille. Enregistrer les résultats dans
`img/halloween/` sous le nom indiqué.

### H1. Décos, nuit → `img/halloween/decor.jpg` (joindre `img/scene.jpg`)

```text
Edit the attached image. Keep EVERYTHING else exactly identical: same framing, same size, same painting, same lighting, every object in the same place. Only ADD these Halloween decorations, painted in exactly the same hand-painted style and light as the rest of the room:
1. A string of small black paper bats and little white paper ghosts hanging in a gentle curve on the bare wall, from the right end of the curtain rod to just left of the top shelf, above the poster and the clock, not touching them.
2. A small carved jack-o'-lantern glowing warmly from a candle inside, on the window sill, between the cactus and the jar.
3. A tiny orange pumpkin sitting on top of the beige computer monitor, on its left corner.
4. Three tiny black paper bats clipped on the photo string, between the polaroids.
5. A thin dusty cobweb in the top left corner of the window frame, and another one high in the top right corner of the wall, above the purple box.
6. A small cluster of three orange candles with tiny flames on the desk, in front of the boombox, near the front edge of the desk.
Do NOT change, move or cover: the ring binders, the shelves and everything on them, the poster, the clock, the computer screen, the Game Boy, the mug and its steam, the lava lamp, the desk lamp, the sleeping cat, the cork board, the books, the chair, the window panes and the view through them.
No text, no letters, no logos.
```

### H2. Décos, jour → `img/halloween/decor-day.jpg` (joindre `img/day.jpg`, puis le résultat de H1)

```text
Edit the first attached image. Keep EVERYTHING else exactly identical: same framing, same size, same painting, same daylight, every object in the same place. Only ADD the same Halloween decorations as in the second attached image, at exactly the same spots and the same size, painted in the daylight of the first image (the jack-o'-lantern and the candles are not lit): the paper bats and ghosts garland on the wall, the jack-o'-lantern on the window sill, the tiny pumpkin on the monitor, the paper bats on the photo string, the two cobwebs, the three candles in front of the boombox.
Use the second image ONLY to know what to add and where. Do NOT change, move or cover anything else.
No text, no letters, no logos.
```

### H3. Ciel de nuit → `img/halloween/sky.jpg` (joindre `img/sky.jpg`)

```text
Edit the attached image. Keep the same framing, the same size, the same painting style and the same city. Turn it into a Halloween night: a big low orange full moon, a few small black bat silhouettes crossing in front of it, thin purple clouds, no rain. The city keeps its lights, and a few of its windows glow orange.
No text, no letters, no logos.
```

### H4. Ciel de jour → `img/halloween/sky-day.jpg` (joindre `img/sky-day.jpg`)

```text
Edit the attached image. Keep the same framing, the same size, the same painting style and the same city. Turn it into a late October golden hour: a warm orange and pink autumn sky, soft glowing clouds, a few orange autumn leaves drifting in the air.
No text, no letters, no logos.
```

### H5. Warwick endormi en sorcier → `img/halloween/cat-sleep.jpg` (joindre `img/scene.jpg`)

```text
Edit the attached image. Keep EVERYTHING else exactly identical: same framing, same size, same painting, same lighting. Only change the following:
The sleeping black and white tuxedo cat on the desk wears a small purple witch hat with an orange band, slightly tilted on its head between its ears. The cat keeps exactly the same pose, the same size and the same place, still asleep. Same painting style as the rest of the image.
```

### H6. Warwick réveillé en sorcier → `img/halloween/cat-awake.jpg` (joindre `img/cat-awake.jpg`)

```text
Edit the attached image. Keep EVERYTHING else exactly identical: same framing, same size, same painting, same lighting. Only change the following:
The black and white tuxedo cat on the desk wears a small purple witch hat with an orange band, slightly tilted on its head between its ears. The cat keeps exactly the same pose, the same size and the same place. Same painting style as the rest of the image.
```

Si Gemini recadre ou déplace des objets : redemander, en rappelant « same framing, every object in the same place ».

## À faire

**Johan**
- Les 6 images ci-dessus.
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
- Le découpage des images Halloween (script, sur le modèle de `build-scene`).

## Paiement : Stripe ou un « merchant of record »

- **Stripe** (paiement direct) : frais faibles (de l'ordre de 1,5 % + 0,25 € par carte européenne). Johan facture
  lui-même. En franchise de TVA, sous les seuils, pas de TVA à collecter (« TVA non applicable, art. 293 B du CGI »).
  À confirmer avec un comptable.
- **Lemon Squeezy / Paddle** (ils vendent à sa place) : gèrent TVA et factures partout, mais environ 5 % + 0,50 $ par
  vente, lourd sur un achat à 2-3 €.
- Recommandation : Stripe, tant que Johan est en franchise de TVA.
