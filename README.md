# NookDex

Ta collection de cartes Pokémon TCG, rangée dans des classeurs sur un bureau peint façon film d'animation (animations en « low fps », grain de pellicule).

- Chaque extension = un classeur sur l'étagère. Clic : il sort, s'ouvre, et on tourne les pages.
- Cartes grises = manquantes. Clic sur une carte grise = tu l'as. Clic sur une carte possédée = sa fiche
  (variante normale / reverse / holo, état Cardmarket, doublons, prix d'achat — 0 € si opening).
- L'écran du PC ouvre **NookDex OS** : tableau de bord, wishlist, doublons, recherche, sauvegarde (export/import JSON).
- Prix Cardmarket (prix bas + tendance) via [TCGdex](https://tcgdex.dev), totaux par classeur.
- Sauvegarde locale (localStorage), et compte en ligne optionnel (Supabase, lien magique par e-mail) pour la retrouver sur tous ses appareils.

## Lancer

```bash
npm install
npm run dev
```

## Ajouter / mettre à jour une extension

Les données (cartes FR, images, prix) sont figées dans `src/data/sets/<id>.json` :

```bash
npm run fetch-set swsh12 swsh12tg   # set principal + sous-sets (Trainer Gallery…)
```

Puis branche le JSON sur le bon classeur dans `src/lib/binders.ts` (`set: null` = classeur placeholder).
Relancer la commande rafraîchit aussi les prix.

## Où est quoi

| Dossier | Rôle |
| --- | --- |
| `src/components/room/` | Le bureau peint : calques, classeurs, animations 12 fps (`sceneAnim.ts`) |
| `src/components/fx/` | Grain de pellicule et « boil » (trait qui frémit façon dessin animé) |
| `src/components/binder/` | Le classeur : ouverture, pages qui tournent, cartes, fiche |
| `src/components/computer/` | NookDex OS (l'écran du PC en plein écran) |
| `src/lib/sound.ts` | Tous les sons, synthétisés en WebAudio (+ radio lofi) |
| `src/lib/store.ts` | Collection (zustand + localStorage) |
| `src/lib/cloud.ts` | Compte en ligne et synchro Supabase (table : [docs/supabase.sql](docs/supabase.sql)) |
| `src/lib/price.ts` | Calculs de prix / stats |

En dev, raccourcis d'URL : `?skip` (passe le loader), `?open=swsh12` (ouvre un classeur), `?os` (ouvre le PC), `?demo` (remplit une collection de test).

## Visuels

Les images sources (Gemini) sont dans `img/`. Le script découpe la scène en calques (fond, chat, chaise, 14 classeurs, tête de lampe…) par différence entre la scène maître et ses éditions :

```bash
npm run build-scene   # -> public/scene/*.webp + src/data/scene.json
```

Prompts pour générer les visuels avec Gemini : [docs/prompts-gemini.md](docs/prompts-gemini.md).
