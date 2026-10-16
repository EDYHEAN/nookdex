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

## Où on en est (2026-10-15) : point de reprise

Tout est sur la branche `shop` (pas de PR, pas mergée). La boutique reste cachée : en prod, seuls les comptes de Johan
(`STUDIO_EMAIL_HASHES`) la voient, jusqu'à `NEXT_PUBLIC_SHOP=on` dans Vercel.

**Fait**
- L'art Halloween : planches Gemini dans `img/halloween/`, découpées et placées par `scripts/build-skins.mjs` →
  `public/skins/halloween/` + `src/data/skin-art.json`. Ciel nuit/jour, décos (guirlande, citrouille, bougies aux
  flammes animées, toiles, bonbons, chauve-souris), araignée qui descend de sa toile (`room/SkinSpider`), Warwick sorcier
  (sprites remplacés), lampe à lave citrouille + lumière orangée, radio « spooky » (`lib/sound` `setAmbientMood`).
- Le catalogue : `src/data/skins.json` (collections, collection de base, objets par emplacement avec rareté et prix,
  pack). `lib/skins.ts` (côté serveur aussi), `lib/shop.ts` (navigateur : verrou, objets portés/achetés/essayés, look).
  Prix (Johan, 2026-10-16, montés pour les frais : à 0,99 € il restait ~0,52 € une fois TVA et frais Stripe
  ôtés) : Lune de sang 1,99 (épique), Bureau hanté 1,99 (rare), Warwick sorcier 2,49 (épique), Lueur citrouille 1,99,
  Radio hantée 1,99 (peu communs), Pack 7,99 (légendaire, jusqu'au 2026-11-03 ; 10,45 € à l'unité).
- La boutique `room/Shop.tsx` : bouton 🛍️ dans le coin, vitrine façon Fortnite (pack en vedette, tuiles par rareté,
  compte à rebours en direct, tampon « Possédé »), fiche d'un objet (essayer / acheter / porter), casier par emplacement
  (chaque emplacement montre l'actif ; options : base puis toutes les collections), barre d'essai (« Rendre » rouvre la
  boutique là où on était). Connecté, « Acheter » part direct sur Stripe.
- Paiement : Stripe **Managed Payments** (Stripe vendeur officiel : TVA, reçus, remboursements). Produits créés en test
  par `scripts/stripe-skins.mjs` (un par objet et par pack, lookup key `skin_<id>`). `app/api/shop/checkout` (session
  Checkout), `app/api/shop/webhook` (signature vérifiée, écrit l'achat), `lib/shopServer.ts`. Table Supabase
  `purchases` créée (`docs/supabase.sql`). Achat test vérifié de bout en bout le 2026-10-14 (un achat test du pack est
  enregistré sur le compte de Johan : à supprimer pour qu'il teste lui-même).
- Perf : la pièce (`PaintedRoom`, memo) ne se redessine plus quand un panneau s'ouvre ; images de la boutique
  préchargées.
- En dev : `?skin=halloween` (ou un objet) porte sans acheter, `?skin` retire tout.

**Clés** (`.env.local` sur le PC de Johan, jamais dans le repo ni le chat) : `STRIPE_SECRET_KEY` (test),
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_WEBHOOK_SECRET` (celui de `stripe listen`).
Sans clés (session web), la route de paiement répond 503 et la boutique affiche « Le paiement ouvre très bientôt » :
tout le reste se travaille quand même.

### Compte Stripe en production (fait le 2026-10-15)

Activé par Johan (formulaire « Activer Payments »). Ce qui a été choisi, pour s'y retrouver :
- Type : France, « Particulier / Entrepreneur individuel / Micro-entrepreneur » (la micro-entreprise de Johan, son SIRET).
- Catégorie : Produits numériques → **Applications** (pas « Jeux » : plus surveillé, et le jeu ne vend rien).
  Description : application web gratuite de suivi de collection, objets décoratifs numériques optionnels à l'unité
  ou en pack (0,99-2,99 €), achat unique, livré tout de suite, l'appli reste gratuite. Pokémon pas mis en avant (les
  skins payants n'en contiennent rien).
- Support : téléphone de Johan donné à Stripe mais **pas affiché** sur les reçus ; le support client, c'est
  `contact@nookdex.com`.
- Libellé de relevé : `NOOKDEX.COM`, abrégé `NOOKDEX`.
- Virements : sur le compte de Johan, automatiques une fois par mois (colle à la déclaration URSSAF).
- Double authentification : application d'authentification + clé d'accès, codes de secours gardés hors du PC.
- Radar : **Lite** (inclus ; Standard coûterait 0,05 € par vente, 5 % d'un objet à 0,99 €). Passer à Standard si des
  contestations arrivent.
- Stripe Climate : non (facultatif, réactivable).
- « Copier des éléments de l'environnement de test » : **rien copié**. Les produits de prod viennent de
  `scripts/stripe-skins.mjs` (code fiscal Managed Payments, prix TTC, lookup keys `skin_<id>`).
- **PayPal** activé via Stripe, revenus reçus **sur Stripe** (mêmes virements, à part des pourboires du PayPal.me perso).
  Un compte **PayPal Professionnel** neuf a été créé pour ça, au nom de la micro-entreprise : e-mail `contact@nookdex.com`,
  dénomination = nom de Johan (comme l'avis SIRENE), nom commercial NookDex, euro, « Applications de biens numériques
  (hors jeux) », site nookdex.com, identifiant fiscal personnel (numéro fiscal, pas de TVA intracom en franchise),
  résident fiscal France seulement. Pub PayPal décochée. Pas confirmé que Managed Payments propose PayPal : Stripe
  choisit les moyens affichés (la route de paiement n'en force aucun), à vérifier sur la vraie page de paiement.

**Fait le 2026-10-16**
- Clé live : une clé restreinte `nookdex-site` (`rk_live_…`, « Accès complet, à l'exception des opérations sensibles »),
  gardée dans le gestionnaire de mots de passe de Johan : pour Vercel (`STRIPE_SECRET_KEY`) et le script. Les clés
  **test** restent dans `.env.local` (sinon un achat en dev est un vrai paiement, et le secret de `stripe listen`
  n'existe qu'en test) : la clé live se passe pour une seule commande,
  `$env:STRIPE_SECRET_KEY="rk_live_…"; node scripts/stripe-skins.mjs` (PowerShell, chaque ligne commence par `LIVE`).
- Produits créés en prod par le script (prix ci-dessus).
- **Managed Payments** configuré en prod (`dashboard.stripe.com/settings/managed-payments`) : « Prêt à l'emploi »,
  activé par défaut pour Checkout, code fiscal par défaut « Général - services fournis par voie électronique ».
- Table `purchases` vide (plus d'achat test sur le compte de Johan).

**Reste à faire**
- L'achat test de Johan lui-même en local, clés test (Supabase : redirect URL `http://localhost:3210/**` à ajouter).
- Pages légales : mentions légales (éditeur : nom, SIRET, adresse ou domiciliation) et CGV des contenus numériques
  (FR/EN, notebook pages comme /conditions), liées depuis la boutique.
- Lancement : clés live + `SUPABASE_SERVICE_ROLE_KEY` dans Vercel, webhook de prod (`https://nookdex.com/api/shop/webhook`,
  événements checkout.session.completed et async_payment_succeeded) et son secret, une ligne au carnet de route
  (courte), merger `main` dans `shop` puis la PR, enfin `NEXT_PUBLIC_SHOP=on`. Au premier vrai achat : voir si PayPal
  s'affiche.
- Ménage : supprimer `Documents/NookDex/halloween-apercu/` (captures temporaires) une fois fini.

## Paiement : Stripe ou un « merchant of record »

- **Stripe** (paiement direct) : frais faibles (de l'ordre de 1,5 % + 0,25 € par carte européenne). Johan facture
  lui-même. En franchise de TVA, sous les seuils, pas de TVA à collecter (« TVA non applicable, art. 293 B du CGI »).
  À confirmer avec un comptable.
- **Lemon Squeezy / Paddle** (ils vendent à sa place) : gèrent TVA et factures partout, mais environ 5 % + 0,50 $ par
  vente, lourd sur un achat à 2-3 €.
- Recommandation : Stripe, tant que Johan est en franchise de TVA.
