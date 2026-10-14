# Le défi du jour de Nook Survivors (v2, depuis le 2026-10-15)

Demandé par Johan le 2026-10-14. Ce fichier sert de point de reprise : ce qui est fait, comment c'est construit, ce
qui reste à faire.

## Ce que veut Johan

- Un mode à part, plus court, plus fun, plus puissant qu'une partie normale.
- **10 vagues**, et pas de vagues au temps : **une vague finit quand son dernier ennemi tombe**, la suivante arrive
  ensuite. D'où le classement au chrono.
- Un boss différent du mode normal à la vague 5. Un **giga boss** à la vague 10, avec des mécaniques intéressantes.
  **Gagner le défi, c'est battre le giga boss.**
- Récompense en or. **Classement à part, au temps.**
- **Un Pokémon du jour qui n'est jamais un starter**, chacun avec ses propres talents, et une rotation variée.
- Ennemis plus originaux, plus gros.
- En plus : le mode normal s'arrête à la vague 100.
- Il actualisera ce soir (2026-10-14) chez lui pour reprendre. Nouveaux trophées à faire ce soir (prompt plus bas).

## Comment c'est construit

- `src/lib/game/defi.ts` : toutes les données. `DEFI_FROM` (le 2026-10-15, jour UTC : avant, le menu garde l'ancien
  défi), `DEFI_QUOTA` (les ennemis à battre par vague), les 7 Pokémon, `DEFI_DAYS` (indexé par le jour UTC de la
  semaine, 0 = dimanche), `defiOf(day)` (le défi d'un jour, avec sa graine), l'or, `DEFI_WILD` (les nouveaux ennemis),
  `TITAN`.
- `src/lib/game/engine.ts` :
  - `mode: "defi"`, `setup.defi` ;
  - `stepDefi` (vague nettoyée → pause de 1,6 s → la suivante), `defiWave`, `spawnDefi` (des groupes, les titans,
    les gardes du boss) ;
  - `gigaAct` (les phases du giga boss), les coups `rain`, `spiral`, `fan` dans `bossAct` ;
  - `bossDown` (boss de la vague 5 : la moitié des PV rendus ; giga boss ou 100e vague : victoire, puis `finish(true)`) ;
  - les talents : `stepTalent` (Vitesse Extrême, Surf glacé, Ultralaser), `teleport`, Riposte et Repos dans `hurt` ;
  - `defiPower` (×1,5, plus Adaptabilité et Cran), l'XP ×1,8 (et ×1,5 de plus pour Magicarpe) ;
  - les nouvelles attaques de base dans `attack` : `swift`, `icy`, `splash`, `punch`, `slam`, `psyorb` ;
  - `evoBasic` : une attaque de base qui change à l'évolution (Évoli, Léviator) ;
  - `MAX_WAVE = 100` pour le mode normal et la coop.
- `src/components/game/NookBoy.tsx` : l'écran du défi (`screen === "daily" && defiNow()`), la fin de partie (victoire,
  vagues nettoyées, or), le classement au temps (`Ladder timed`), `boardOf` (l'onglet « Défi du jour » lit le mode
  `defi` à partir de `DEFI_FROM`).
- Classement : mode `defi` dans `game_scores`. Une victoire est envoyée en **vague 11**. `game_top2` et `game_submit2`
  (bloc « v3 » à la fin de `docs/supabase.sql`) classent ce mode par vague puis par temps. Ils vérifient au moins 6 s
  par vague, au moins 90 s pour une victoire, 1 h au plus. Ils acceptent les Pokémon du défi (dex de leur 1re forme).
  Le mode normal a un plafond de 100 vagues, et un combat de boss à la 100e peut dépasser les 30 s.
- Or (`settle`) : 12 or par vague nettoyée à chaque partie, plus 250 or à la 1re victoire du jour (`dailyPaid`).
- Sprites : `npm run build-game` (ROSTER de `scripts/build-game.mjs` : ennemis, boss, Pokémon du jour en
  `PLAYER_LITE`, formes Méga dans `FORMS`). L'atlas passe de 480 à 896 Ko (2048×5160). Il reste chargé seulement au
  clic sur la console. S'il devient trop lourd : un 2e atlas chargé seulement pour le défi.

## La rotation (jour UTC)

| Jour | Pokémon | Talent | Ennemis | Boss vague 5 | Giga boss vague 10 |
|---|---|---|---|---|---|
| Lundi | Évoli → Aquali, Voltali ou Pyroli au N.12 (selon le jour) | Adaptabilité : +10 % de dégâts par vague nettoyée | Normaux | Tauros | Méga-Kangourex |
| Mardi | Caninos → Arcanin (N.11) | Vitesse Extrême : fonce à travers la meute et brûle | Nuit toxique (Spectre, Poison) | Grotadmorv | Méga-Ectoplasma |
| Mercredi | Lokhlass | Surf glacé : une vague mouille, la suivante gèle ; coups reçus -25 % | Volcan (Feu) | Galopa | Méga-Dracaufeu X |
| Jeudi | Magicarpe → Léviator (N.8) | Colère : Magicarpe +50 % d'XP ; Léviator : Ultralaser, coups reçus -25 % | Fossiles (Roche) | Rhinoféros | Méga-Ptéra |
| Vendredi | Machoc → Machopeur (9) → Mackogneur (18) | Riposte : chaque coup reçu renvoie une onde de choc ; Cran sous 50 % | Psys | Hypnomade | Méga-Alakazam |
| Samedi | Ronflex | Repos : sous 35 % il dort 2 s et se soigne tout (25 s) ; qui le touche se blesse | Marée (Eau) | Krabboss | Méga-Flagadoss |
| Dimanche | Abra → Kadabra (10) → Alakazam (20) | Téléport : esquive un coup, laisse une mine psy (2,5 s) | Le labo (Électrik, Dragon, Porygon…) | Draco | Méga-Mewtwo Y |

- **Giga boss** : une forme Méga dessinée deux fois plus grande. À 66 % et 33 % de ses PV, il **rugit** : il ne prend
  plus de dégâts, appelle 4 puis 7 gardes dorés, puis lâche une onde de choc. Ensuite il est plus rapide, tape plus
  souvent et ses attaques grossissent. Ses coups : `rain` (une pluie de frappes annoncées autour du joueur), `spiral`
  (des bras de tirs qui tournent), `fan` (une étoile de rayons annoncés), plus les coups des boss normaux.
- **Titans** : à partir de la vague 3, un ennemi « late » du thème, 1,8 fois plus grand, avec 10 fois plus de PV
  (1 par vague, 2 à partir de la 7e, aucun aux vagues de boss).

## Réglages (bot du 2026-10-14)

Mesuré avec un bot Playwright : il esquive, ramasse les bonbons, prend toujours la 1re carte et vise le plus proche.
Le script était dans le scratchpad de la session, il n'est pas dans le repo. Il remplace `g.step` pour piloter, puis
appelle `g.tick` en boucle pour accélérer. Il passe par `window.nookboy` et `window.nookdefi` (exposés en dev).

- Parties de 3 à 9 min. Niveau 28 à 37 à la fin.
- Les PV des boss sont réglés jour par jour : environ 30 s pour le boss de la vague 5 et environ 50 s pour le giga
  boss (Ronflex est plus lent, autour de 80 s).
- Johan veut des combats de boss « rudes, mais pas impossibles ». Leurs dégâts ont donc été relevés (boss 26-28, giga
  32-34). Sans invincibilité, le bot meurt parfois contre le giga boss (lundi) ou dans une vague tardive. Il finit souvent
  la vague 10 avec presque plus de PV.
- Un humain esquive moins bien que le bot, mais choisit mieux ses cartes : à revoir avec les premiers retours (les
  classements du jour donnent les temps).

## À faire (prochaines fois)

- **Trophées du défi** (ce soir) : la planche Gemini (prompt ci-dessous), puis les ajouter dans `lib/trophies.ts`,
  `ORDER_GAME2` dans `scripts/build-trophies.mjs` (nouvelle planche `img/trophies-defi.jpg`), et les `unlock()` dans
  le moteur (`bossDown`, `finish`).
- Retirer l'ancien défi (`dailyOf`, `DAILY_MODS`, `game-daily`…) une fois le 15 passé et son classement plus utile.
- Régler avec les retours des joueurs : `DEFI_QUOTA`, les PV des boss dans `DEFI_DAYS`, l'XP ×1,8, `defiPower` ×1,5.
- Idées : un 2e Pokémon par jour (le joueur choisit), des règles du jour en plus (comme l'ancien défi), une
  médaille de temps (or, argent, bronze) sur l'écran de fin.

## Prompt Gemini des trophées du défi (une planche 4×2)

Ordre de la planche, de gauche à droite et de haut en bas (ids proposés) :

1. `defi-first` (bronze) « Premier chrono » : gagne un défi du jour → **un chronomètre de poche doré**.
2. `defi-fast` (argent) « Sur les chapeaux de roue » : gagne en moins de 5:00 → **un chronomètre avec deux petites ailes**.
3. `defi-blitz` (or) « Éclair » : gagne en moins de 3:30 → **un chronomètre fendu par un petit éclair jaune**.
4. `defi-week` (or) « Semaine parfaite » : gagne avec chacun des 7 Pokémon → **un petit calendrier en bois à 7 cases, une pastille ronde dans chaque**.
5. `defi-titan` (bronze) « Tueur de titans » : mets un titan K.O. → **une énorme dent de pierre pendue à un cordon**.
6. `defi-karp` (argent) « Si si, Magicarpe » : gagne le défi de Magicarpe → **une figurine de carpe dorée qui saute**.
7. `defi-top1` (or) « Champion du jour » : 1er du classement du jour → **une petite couronne sur un coussin de velours**.
8. `game-wave100` (or) « Centenaire » : survis aux 100 vagues → **une couronne de laurier avec un ruban**.

```text
[STYLE de docs/prompts-gemini.md]

A sheet of 8 small collectible trinkets, painted, arranged in a neat grid of 4 columns and 2 rows on a plain pure white
background, evenly spaced, each object centered in its cell, all at the same scale, seen slightly from above, each with a
soft painted shadow under it, nothing touching. Same painted style and light as the other trophy sheets (warm peach
highlights, cool violet shadows, gouache texture).
Row 1, left to right: a golden pocket stopwatch; a stopwatch with two small white feathered wings; a golden stopwatch
with a small yellow lightning bolt cracking across it; a little wooden calendar board with 7 square boxes, a round colored
sticker in each.
Row 2, left to right: a huge stone fang hanging from a leather cord; a small golden carp figurine leaping, its tail curled;
a tiny gold crown on a red velvet cushion; a laurel wreath tied with a red ribbon.
No text, no numbers, no letters, no logos, no frames, no grid lines.
```
