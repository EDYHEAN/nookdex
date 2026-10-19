# Prompts Gemini — visuels NookDex (style film d'animation peint)

Cible : un **photogramme de film d'animation japonais dessiné à la main** (réf. les décors d'Arrietty, Chihiro, Kiki).
Ce qui fait ce style, et que le prompt doit imposer :

- **Décors SANS contours** : tout est construit à la gouache par la couleur et la valeur. Le trait fin est réservé aux éléments « animés » (le chat, la tasse…), peints en aplats de cellulo.
- **Textures peintes** : veinage du bois, plâtre, tissus, papier, feuilles des plantes.
- **Profondeur** : légère perspective, un vrai volume de pièce, de l'air entre les plans.
- **Lumière peinte en couleur** : ombres froides colorées, lumière chaude qui déborde, halo doux, léger grain de pellicule.
- **Couleurs** riches et harmonieuses (beaucoup de verts, bois chauds), jamais criardes.

> Ne tape pas « style Ghibli » tout seul : ça déclenche un filtre générique qui fait IA. On décrit la technique **et on joint une image de référence** (voir ci-dessous) : c'est ce qui marche le mieux.

Modèle : le plus haute résolution disponible (Nano Banana Pro en 2K/4K si tu l'as), **format 16:9**.

## Comment on va s'en servir

1. **Joins 1 ou 2 images de référence de style** (le décor de chambre que tu m'as montré est parfait) avec cette phrase en fin de prompt :
   `Use the attached reference image(s) ONLY for painting technique, rendering, color and light. Do not copy their content, characters or layout.`
2. **Scène maître d'abord.** Itère jusqu'à avoir LA bonne image, envoie-la-moi avant la suite.
3. **Calques par édition de la scène maître** (tu joins la scène maître et demandes une modif). Je découpe chaque élément par différence entre l'original et la version éditée.
4. **Les 14 classeurs sont peints dans la scène** (tranches aux étiquettes blanches vides). Une édition « étagères vides » me permet de découper chaque classeur : ils deviennent cliquables, sortent de l'étagère au survol, et je pose le logo de l'extension sur l'étiquette.
5. L'**écran du CRT** reste un aplat sombre uni (l'OS s'affiche dessus).
6. Toujours **même cadrage, même taille** : si Gemini recadre, redemande.

## Bible de style (en tête de CHAQUE prompt)

```text
STYLE: a still frame from a hand-drawn Japanese animated feature film of the 2000s. The background is painted by hand with poster colors (gouache) on illustration board, the way traditional anime background artists paint: NO outlines on the background, every form is built only with painted color and value, soft painted edges, controlled visible brushwork, rich painted textures (wood grain, plaster wall, woven fabric, paper, leaves).
Only the few small things that could move (the cat, the steam, the mug) are cel-painted: thin clean colored line, flat two-tone shading, placed over the painted background.
Colors are rich but harmonious: deep plant greens, warm honey woods, muted lavender and teal; light is painted with color (warm peach highlights, cool blue-violet shadows), soft painted cast shadows, glow and gentle haze around lights, subtle film grain. Gentle one-point perspective from seated eye level, real depth in the room.
NOT a comic, NOT a sketch, NO black ink outlines, NO cartoon line art, NOT pixel art, NOT 3D, NOT photorealistic, NOT vector flat design. No text, no letters, no logos, no watermark.
```

## 1. Scène maître

```text
[STYLE]

A cozy desk corner in a teenager's bedroom on a rainy night, wide 16:9 frame, camera sitting in front of the desk at seated eye level, looking at the wall, slight one-point perspective. No people.

Light: a warm amber articulated desk lamp on the right of the desk is the main light and pools on the desk; cool blue moonlight and city glow come through the rainy window on the left; a string of warm fairy lights along the top of the wall; the old CRT monitor gives a faint green glow. The room corners fall into blue-violet shadow.

LEFT: a wooden window with small panes, rain streaks and droplets on the glass, a crescent moon behind thin clouds, distant city lights. Thin lavender curtains tied back. A little cactus and a jar candle on the sill. Three polaroid photos pinned on a string under the window.

WALL, CENTER: an old slightly curled poster of a red and white capture ball in a starry sky, held by tape; a round red wall clock.

WALL, RIGHT — IMPORTANT: two long wooden wall shelves, one above the other, spanning the right half of the wall. The top shelf holds a neat row of EXACTLY 6 upright ring binders, the lower shelf a row of EXACTLY 8 upright ring binders, standing side by side, all the same size, in varied soft colors (silver, gold, sky blue, violet, red, green, charcoal, pink, teal). Each binder spine has an EMPTY blank white label area on its upper part and a small finger hole near the bottom. After the binders, at the right end of each shelf only: a small capture ball on a stand, a purple collector box, a tiny succulent, old books with a small green plush, a small frame of pin badges.

DESK (lower third): an old honey-colored wooden desk with drawers, worn and scratched. Left to right: a big monstera plant in a terracotta pot at the left edge; a worn grey 90s boombox; a lava lamp softly glowing pink; a slightly yellowed beige 90s CRT monitor whose screen is a flat, uniform, very dark green glass with nothing on it, a beige keyboard slightly askew, a mouse on a blue pad; a grey handheld game console; a steaming mug; two sealed trading-card booster packs; a small cork board with sticky notes; a black and white tuxedo cat asleep, curled up in the pool of lamp light; a small deck box and a few loose cards in sleeves. Under the desk, in shadow: a beige PC tower with a tiny green light and a small trash bin.

FOREGROUND: bottom center, the top of the backrest of a dark wooden desk chair, closer to us, darker and slightly blurred.

Mood: quiet, warm, nostalgic, staying up late with your collection while it rains.

Use the attached reference image(s) ONLY for painting technique, rendering, color and light. Do not copy their content, characters or layout.
```

Si c'est encore trop « illustration », ajoute : `Make it look exactly like a background painting from a 2000s hand-drawn anime film: remove all outlines from the room and furniture, more painted texture, more depth and atmosphere.`

Variante à tester si la nuit rend mal : remplace « rainy night » par « late rainy afternoon, soft grey-green daylight » (c'est la lumière de ta référence d'Arrietty).

## 2. Calques (éditions de la scène maître)

Joins la scène maître à chaque fois et commence par :
`Edit the attached image. Keep EVERYTHING else exactly identical: same framing, same size, same painting, same lighting. Only change the following:`

| # | Édition demandée | Ce que j'en tire |
| --- | --- | --- |
| E1 | `Remove all the ring binders from both shelves; paint the empty shelf wood and the wall behind them.` | les 14 classeurs, découpés un par un |
| E2 | `Remove the desk chair in the foreground; paint the desk drawers and the dark space that were behind it.` | la chaise = 1er plan du parallax |
| E3 | `Remove the sleeping cat; paint the desk surface and the lamp light where it was.` | le chat, découpé |
| E4 | `Remove the desk, everything on it and under it, the chair and the plant; show only the back wall, the shelves and the window continuing down to the floor, same lighting.` | le mur seul = fond du parallax |
| E5 | `Replace the whole image by the view seen through the window only: the rainy night sky, the moon and the city, extended to fill the entire frame, no window frame, no room.` | le ciel/ville derrière la vitre |
| E6 | `Switch the desk lamp OFF: the room is now lit only by the cool moonlight, the fairy lights and the green glow of the CRT. The lamp bulb is dark.` | version « lampe éteinte » (fondu entre les deux) |
| E7 | `Empty the lava lamp: the glass is filled with a clear dark purple liquid with no lava blobs.` | lampe à lave vide, les blobs sont animés en code |

## 3. Le chat (pas de planche de sprites)

Les générateurs d'images ne savent pas garder le même personnage d'une case à l'autre : on ne demande **jamais** de planche de frames.

- **Chat endormi** : aucun prompt, il sort de la scène maître via l'édition **E3** (je le découpe par différence). Il a donc exactement la bonne lumière.
- **Respiration, oreille qui frétille, Zzz, cœurs** : faits en code, en déformant doucement l'image (pas besoin de frames).
- **Chat réveillé** (quand tu le caresses) : une seule édition de la scène maître, que je découpe aussi par différence :

```text
Edit the attached image. Keep EVERYTHING else exactly identical: same framing, same size, same painting, same lighting. Only change the following:
The sleeping tuxedo cat on the desk wakes up, in the same spot and the same size: it lifts its head, eyes closed happily in a curve, purring, tail curling. Same painting style as the rest of the image.
```

## 4. Logo PokéPocket

Juste la typo + la Poké Ball dans le « o ». Pour l'animer (rebond du texte, Poké Ball qui tourne), redemande ensuite : `Same logo, but deliver 2 separate elements side by side: (1) the text with an empty "o", (2) the capture ball alone.`

> ⚠️ Site public : ne pas imiter le lettrage officiel Pokémon (jaune bordé de bleu).

### Piste A — Carton-titre de film d'animation (assorti au décor)

```text
Title card logo for an animated film, the word "PokéPocket" (exactly this spelling, with the accent on the e) hand-lettered with a brush in a warm playful style, cream letters with a soft vermilion outline and a subtle watercolor texture, the "o" of "Pocket" is a small red and white capture ball. Nothing else: no pocket, no card, no other object, no decoration. Gouache and watercolor on paper, 1990s Japanese animated film title card feeling, nostalgic and joyful. Plain off-white paper background, no other text.
```

### Piste B — Écran titre de jeu 90s (plus pop/retro)

```text
Retro video game title screen logo, the word "PokéPocket" (exact spelling with the accent) in chunky bold custom letters with a gold-orange-pink sunset gradient, thick dark purple outline and hard drop shadow, slightly arched like an arcade title. The "o" of "Pocket" is a small red and white capture ball. Nothing else: no pocket, no card, no other object, no decoration. Flat pure green #00B140 background, no other text.
```

## 5. Les posters du mur (une planche 4×2, 2026-10-19)

Le poster au-dessus du bureau devient au choix du joueur (clic dessus → une fenêtre de vignettes, choix gardé dans la
sauvegarde). Gemini ne peint que **l'illustration intérieure** de chaque poster, à plat, de face ; le script la colle dans le
cadre du poster actuel (même papier, même scotch, même lumière). Illustration intérieure du poster actuel : environ
250×335 px dans `img/scene.jpg`, soit du **3:4 en portrait**. Rien de Pokémon dessus (la Poké Ball s'en va).

Joins `img/scene.jpg` comme référence de style. Format de l'image : le plus grand possible, paysage.

```text
[STYLE de la bible ci-dessus]

A sheet of 8 small painted posters, arranged in a neat grid of 4 columns and 2 rows on a plain pure white background,
with even white gaps between them. Each poster is a flat rectangle seen perfectly from the front, portrait format 3:4,
all exactly the same size, its painting filling it edge to edge: no paper border, no frame, no tape, no shadow, no
perspective. Each one is an art print a teenager would pin above the desk, painted in the same gouache style and the same
palette as the attached room (deep night blues, warm peach lights, honey woods, muted lavender and teal).
Row 1, left to right:
1. a deep blue starry night sky with a big glowing full moon above dark rolling hills, a few shooting stars;
2. a narrow city street in the rain at dusk, glowing warm shop windows, reflections on the wet cobblestones, two small umbrellas;
3. snowy mountains reflected in a still lake at sunrise, pink and gold sky, a tiny wooden pier;
4. a black-and-white tuxedo cat hanging by its front paws from a tree branch, looking worried and funny, soft green background.
Row 2, left to right:
5. a vintage advertisement for a grey handheld game console with a green screen, floating among sparkles and stars, retro 1990s mood;
6. a cozy trading card fair seen from above: wooden tables covered with cards, open card binders, small booster packs, people's hands browsing;
7. an old parchment world map with colored pins and a red string connecting them, a small compass rose;
8. a river path lined with blooming cherry trees in spring, petals drifting, a small red bridge.
No text, no letters, no numbers, no logos, no brand names, no Pokémon or game characters, no grid lines.

Use the attached reference image ONLY for painting technique, rendering, color and light. Do not copy its content or layout.
```

Ensuite : la découpe (détection des 8 rectangles sur le blanc, comme `build-trophies`), le collage dans le cadre du poster
(perspective et inclinaison du poster actuel), le sélecteur dans la pièce. Prochaines étapes notées : **ta carte préférée
au mur** (le scan d'une carte de ta collection dans le cadre), posters gagnés par des trophées, posters saisonniers
(boutique).
