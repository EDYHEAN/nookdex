# Rapports de la semaine

Chaque lundi, l'Action « Chiffres de la semaine » (.github/workflows/analytics.yml, scripts/analytics.mjs) relève
les chiffres dans data/<date>.json, puis la routine Claude du lundi écrit le rapport <date>.md (entonnoir par source,
comptes, Google, 2-3 actions).

Le mail (« Mail du rapport », scripts/report-mail.mjs) ajoute à l'envoi un bloc « Boutique et dons » lu sur Stripe
(scripts/report-money.mjs : ventes des skins, dons Buy Me a Coffee, la semaine et depuis le début). Ces montants ne sont
jamais écrits ici : le dépôt est public. Secrets GitHub : STRIPE_SHOP_KEY (compte de la boutique) et STRIPE_TIPS_KEY
(compte Stripe de Buy Me a Coffee), des clés restreintes en lecture seule sur « Balance » et « Checkout Sessions ».

`landings` (depuis le 2 novembre 2026, fonction funnel_landings) : pour chaque source, le type de page où ses nouveaux
appareils arrivent (accueil, carte, extension, blog, calendrier, invitations, marché…), l'adresse la plus fréquente en
exemple, et combien vont jusqu'au profil, aux 10 cartes, au compte. Dans le rapport : pour les sources qui comptent
(ChatGPT, Google, Bing), dire où les gens arrivent et quelle page d'arrivée retient mal, pour que l'action vise la bonne page.

Le mail ajoute aussi, à l'envoi, un bloc « Amazon : ce qui manque aux sorties proches » (scripts/report-amazon.mjs) : les
produits des sorties proches qui mènent encore à une recherche Amazon ou attendent leur photo.

`amazon.places` (depuis le 10 novembre 2026) : les clics Amazon par emplacement (invit, calendrier, extension, carte, blog,
accessoires), amazon.fr et amazon.com à part, la semaine, la semaine d'avant et depuis le début ; les anciens noms d'octobre
(« invitations-amazon », « extensions ») y sont regroupés. `amazon.totals` : les mêmes par boutique. Dans le rapport, une
ligne par boutique (clics de la semaine, écart avec la précédente, l'emplacement qui en fait le plus). Les ventes et les
gains ne sont que dans les tableaux de bord Amazon : si Johan en colle les chiffres, les mettre en face des clics.
