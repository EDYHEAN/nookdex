# Rapports de la semaine

Chaque lundi, l'Action « Chiffres de la semaine » (.github/workflows/analytics.yml, scripts/analytics.mjs) relève
les chiffres dans data/<date>.json, puis la routine Claude du lundi écrit le rapport <date>.md (entonnoir par source,
comptes, Google, 2-3 actions).

Le mail (« Mail du rapport », scripts/report-mail.mjs) ajoute à l'envoi un bloc « Boutique et dons » lu sur Stripe
(scripts/report-money.mjs : ventes des skins, dons Buy Me a Coffee, la semaine et depuis le début). Ces montants ne sont
jamais écrits ici : le dépôt est public. Secrets GitHub : STRIPE_SHOP_KEY (compte de la boutique) et STRIPE_TIPS_KEY
(compte Stripe de Buy Me a Coffee), des clés restreintes en lecture seule sur « Balance » et « Checkout Sessions ».
