/**
 * The road log (« Carnet de route »): every version of NookDex, newest first, in both languages.
 * A new version goes on top: the label in the room's corner reads it, and every returning player gets the notebook
 * once on their next visit (per device). Say what changed for the player, not how it was built.
 */
export interface Release {
  version: string;
  /** ISO day */
  date: string;
  title: { fr: string; en: string };
  items: { fr: string; en: string }[];
}

export const CHANGELOG: Release[] = [
  {
    version: "0.16",
    date: "2026-10-20",
    title: { fr: "Nook Survivors : jusqu'à 300", en: "Nook Survivors: on to 300" },
    items: [
      { fr: "Vide la vague, la suivante arrive aussitôt ; vite fait, un Super Bonbon.", en: "Clear the wave and the next one comes at once; fast, a Rare Candy." },
      { fr: "Les boss se battent seuls, avec des affixes : bouclier, téléporteur, renforts…", en: "Bosses fight alone, with affixes: shield, blinker, backup…" },
      { fr: "Cartes Paragon dès la vague 75 : des règles uniques, comme Écho ou Détonation.", en: "Paragon cards from wave 75: one-off rules, like Echo or Detonation." },
      { fr: "Les pactes de Kecleon : un malus jusqu'au boss contre un gros cadeau.", en: "Kecleon's pacts: a curse until the boss for a big gift." },
      { fr: "Un boss vaincu lâche parfois sa Poké Ball : il se bat à tes côtés.", en: "A beaten boss sometimes drops its Poké Ball: it fights by your side." },
      { fr: "11 nouvelles capacités, 3 objets, 5 combos et 3 builds de départ.", en: "11 new moves, 3 items, 5 combos and 3 starting builds." },
      { fr: "300 vagues, départs jusqu'à la 275, et après la 100 les bonbons viennent tout seuls.", en: "300 waves, starts up to 275, and past 100 candies come to you." },
      { fr: "Une partie sur 40, ton starter est shiny : son sprite, et des stats de fou.", en: "One run in 40, your starter is shiny: its sprite, and crazy stats." },
      { fr: "8 nouveaux trophées Nook Survivors, du Chromatique au Tricentenaire.", en: "8 new Nook Survivors trophies, from Shiny to Tricentennial." },
      { fr: "Pension : rangs 3, 4 et 5 (vagues 150, 200, 250), chacun sa couleur, et des objets : Charme Chroma, palettes.", en: "Pension: ranks 3, 4 and 5 (waves 150, 200, 250), each in its colour, and objects: Shiny Charm, palettes." },
      { fr: "Kecleon reste abordable à toutes les vagues, et un départ de la vague 25 ou plus donne de quoi acheter.", en: "Kecleon stays affordable at every wave, and a start from wave 25 or later brings gold to spend." },
      { fr: "Le menu pause reste à l'écran, même avec un gros build.", en: "The pause menu stays on screen, even with a big build." },
      {
        fr: "Ma liste ↗ (NookDex OS) : un lien « je cherche / j'échange » pour tes groupes, toujours à jour.",
        en: "My list ↗ (NookDex OS): a « wanted / for trade » link for your groups, always up to date.",
      },
    ],
  },
  {
    version: "0.15",
    date: "2026-10-17",
    title: { fr: "Le tapis d'échange", en: "The trade mat" },
    items: [
      { fr: "En salon : pose ce que tu donnes et ce que tu reçois, le tapis te dit si l'échange est équitable.", en: "At a fair: lay what you give and what you get, the mat tells you if the trade is fair." },
      { fr: "L'état et les cartes gradées (PSA, CGC…) comptent dans le prix.", en: "Condition and graded cards (PSA, CGC…) count in the price." },
      { fr: "« Échanger » sur une carte de ta collection, « Échange accepté » met ta collection à jour.", en: "\"Trade\" on a card you own; \"Trade done\" updates your collection." },
      { fr: "Nook Survivors : repartir d'une vague, c'est un build tout prêt à choisir parmi 3 (les légendaires sont rares).", en: "Nook Survivors: starting from a wave means picking a ready-made build out of 3 (legendary ones are rare)." },
      { fr: "Kecleon échange une capacité ou un objet contre une des 3 qu'il te propose, au même niveau.", en: "Kecleon swaps a move or an item for one of the 3 he offers, at the same level." },
      { fr: "Plus de K.O. en un seul coup : un ennemi te retire au plus 30 % de tes PV.", en: "No more one-hit K.O.: a foe takes at most 30% of your HP." },
      { fr: "Repartir de la vague 50 ou plus te donne le niveau d'une vraie partie arrivée là ; le build Orage devient légendaire.", en: "Starting from wave 50 or more gives you the level of a real run that far; the Thunderstorm build turns legendary." },
      { fr: "Le tapis d'échange tient autant de cartes que tu veux : elles se rangent en éventail.", en: "The trade mat holds as many cards as you like: they fan out." },
      { fr: "Le classement montre le top 50, page par page.", en: "The ladder shows the top 50, page by page." },
      { fr: "Les attaques peuvent aller plus vite, et plus de PP Plus inutile une fois la vitesse max atteinte.", en: "Moves can go faster, and no useless PP Up once top speed is reached." },
      { fr: "Nook Survivors : un guide dans le menu (statuts, combos, évolutions, objets) et tes stats en direct dans la pause.", en: "Nook Survivors: a guide in the menu (statuses, combos, evolutions, items) and your live stats in the pause." },
      { fr: "Après la vague 50 : une 5e capacité et un 5e objet, des titans, des boss plus coriaces ; ton starter attire les attaques de son type.", en: "Past wave 50: a 5th move and a 5th item, titans, tougher bosses; your starter draws moves of its own type." },
      { fr: "Vagues plus courtes au début (15 s, puis 20 s dès la vague 25) : on entre plus vite dans le vif.", en: "Shorter waves early on (15 s, then 20 s from wave 25): into the action sooner." },
      { fr: "Six terrains (prairie, plage, forêt, grotte, neige, volcan) et la météo : pluie, soleil, grêle, sable changent la force des types.", en: "Six fields (meadow, beach, forest, cave, snow, volcano) and weather: rain, sun, hail, sand change the types' strength." },
      { fr: "4 starters à débloquer en jouant : Nidoran♂, Racaillou, Mélo et Minidraco.", en: "4 starters to unlock by playing: Nidoran♂, Geodude, Cleffa and Dratini." },
      { fr: "Le poster au-dessus du bureau change d'un clic : 8 affiches peintes au choix.", en: "The poster above the desk changes with a click: 8 painted prints to pick from." },
      { fr: "Nook Survivors : chaque carte de niveau dit avec quoi elle évolue (✓ si tu as déjà l'autre moitié), et le Guide est dans le menu pause.", en: "Nook Survivors: every level-up card says what it evolves with (✓ if you already have the other half), and the Guide is in the pause menu." },
      { fr: "Nook Survivors : « Passer » (touche X) quand aucune carte de niveau ne te va, et Entrée relance une partie après un K.O.", en: "Nook Survivors: \"Pass\" (X key) when no level-up card suits you, and Enter starts a new run after a K.O." },
      { fr: "La visite guidée se termine dans ton classeur ouvert, avec ta première carte cochée.", en: "The guided tour ends in your open binder, with your first card ticked." },
      { fr: "Ta collection est sur Pokécardex ? L'import se trouve dès l'accueil, et un bandeau te le rappelle.", en: "Your collection is on Pokécardex? The import is right on the welcome screen, and a strip reminds you of it." },
    ],
  },
  {
    version: "0.14",
    date: "2026-10-17",
    title: { fr: "Au-delà de la vague 100", en: "Beyond wave 100" },
    items: [
      { fr: "Nook Survivors va jusqu'à la vague 200 : titans et giga-boss au-delà de 100.", en: "Nook Survivors goes on to wave 200: titans and giga bosses past 100." },
      { fr: "Repars d'une vague déjà atteinte (25, 50…), avec un tirage de cartes.", en: "Start again from a wave you reached (25, 50…), with a draft of cards." },
      { fr: "La Pension grandit : 6 nouveaux bonus, et un 2ᵉ rang après la vague 100.", en: "The Pension grows: 6 new boosts, and a 2nd rank past wave 100." },
      { fr: "Nouvelles capacités Fée, Acier, Ténèbres et Insecte, et 6 combos.", en: "New Fairy, Steel, Dark and Bug moves, and 6 combos." },
      { fr: "8 nouveaux trophées pour aller au bout.", en: "8 new trophies to go all the way." },
      { fr: "« J'ai tout » : un set ou un master set complet en un clic dans un classeur.", en: "\"Got 'em all\": a full set or a master set in one tap in a binder." },
      { fr: "Choisis 4, 6 ou 9 cartes par page pour chaque classeur.", en: "Pick 4, 6 or 9 cards a page for each binder." },
      { fr: "Chaque partie démarre sans or : tout ce que tu ramasses va dans ta bourse.", en: "Each run starts with no gold: all you pick up goes to your purse." },
      { fr: "Importe ta collection Pokécardex depuis NookDex OS.", en: "Import your Pokécardex collection from NookDex OS." },
    ],
  },
  {
    version: "0.13",
    date: "2026-10-16",
    title: { fr: "La boutique ouvre", en: "The shop opens" },
    items: [
      { fr: "Une boutique pour déguiser ton bureau : le pack Halloween, en édition limitée.", en: "A shop to dress up your desk: the Halloween pack, a limited edition." },
      { fr: "Essaie chaque objet sur ton bureau avant de l'acheter.", en: "Try each item on your desk before you buy it." },
      { fr: "Tes cartes et le jeu restent gratuits, pour toujours.", en: "Your cards and the game stay free, for good." },
    ],
  },
  {
    version: "0.12",
    date: "2026-10-15",
    title: { fr: "Le défi au chrono", en: "The challenge against the clock" },
    items: [
      { fr: "Nouveau défi du jour : 10 vagues, un giga boss au bout. Le plus rapide gagne.", en: "New daily challenge: 10 waves, a giga boss at the end. Fastest wins." },
      { fr: "Chaque jour son Pokémon et son talent : Évoli, Caninos, Lokhlass, Magicarpe…", en: "A Pokémon and a talent each day: Eevee, Growlithe, Lapras, Magikarp…" },
      { fr: "Les parties normales s'arrêtent à la vague 100.", en: "Classic runs end at wave 100." },
      { fr: "8 nouveaux trophées.", en: "8 new trophies." },
      { fr: "Une boîte sur l'étagère pour les cartes sans classeur.", en: "A box on the shelf for cards with no binder." },
    ],
  },
  {
    version: "0.11",
    date: "2026-10-13",
    title: { fr: "Nook Survivors à deux", en: "Nook Survivors for two" },
    items: [
      {
        fr: "Joue à deux sur le même ordi : deux Game Boy côte à côte, ZQSD et la souris pour l'un, les flèches pour l'autre. Si ton pote tombe, reste à côté de lui pour le relever. Un classement coop rien que pour vous.",
        en: "Play two on the same computer: two Game Boys side by side, WASD and the mouse for one, the arrows for the other. If your mate goes down, stand by them to get them up. A coop ladder all of your own.",
      },
      {
        fr: "Le défi du jour : le même Pokémon et la même règle pour tout le monde, une vague à atteindre pour le réussir (et un gros bonus d'or), puis un classement du jour pour aller le plus loin.",
        en: "The daily challenge: the same Pokémon and rule for everyone, a wave to reach to meet it (and a big gold bonus), then a daily ladder to go furthest.",
      },
      {
        fr: "De l'or à ramasser, gardé d'une partie à l'autre dans ta bourse. Après chaque boss, une pause : tout le monde est soigné, l'échoppe de Kecleon, puis 3, 2, 1 et c'est reparti. La Pension dépense ta bourse en bonus pour toutes tes parties, sauvegardés avec ton compte.",
        en: "Gold to pick up, kept from run to run in your purse. After each boss, a break: everyone healed, Kecleon's stall, then 3, 2, 1 and off again. The Pension spends your purse on boosts for all your runs, saved with your account.",
      },
      {
        fr: "10 nouvelles capacités (Bulles d'O, Osmerang, Danse Flammes, Bomb-Beurk, Laser Glace, Châtiment, Aurasphère, Prescience…), 7 nouvelles évolutions de capacités, 4 objets et 5 combos de plus : de quoi monter des builds bien différents.",
        en: "10 new moves (Bubble, Bonemerang, Fire Spin, Sludge Bomb, Ice Beam, Hex, Aura Sphere, Future Sight…), 7 new move evolutions, 4 held items and 5 more combos: room for very different builds.",
      },
      {
        fr: "Plus besoin de compte pour commencer : un pseudo, un classeur, et c'est parti. On te propose de sauvegarder ta collec une fois tes premières cartes rangées.",
        en: "No account needed to start: a nickname, a binder, and off you go. Saving your collection is offered once your first cards are in.",
      },
      {
        fr: "Le classement repart à zéro chaque mois : une nouvelle saison, une nouvelle chance d'être premier.",
        en: "The ladder starts over every month: a new season, a new chance to be first.",
      },
      {
        fr: "16 nouveaux trophées à gagner dans le jeu, sur leur propre étagère de la vitrine.",
        en: "16 new trophies to win in the game, on their own shelf of the trophy case.",
      },
    ],
  },
  {
    version: "0.10",
    date: "2026-10-12",
    title: { fr: "La Game Boy s'allume", en: "The Game Boy turns on" },
    items: [
      {
        fr: "La Game Boy à côté du café cache un jeu : Nook Survivors. Clique dessus (sur ordinateur) et la console vient à toi.",
        en: "The Game Boy next to the coffee hides a game: Nook Survivors. Click it (on a computer) and the console comes to you.",
      },
      {
        fr: "Choisis Bulbizarre, Salamèche, Carapuce ou Pikachu, et tiens face aux vagues de Pokémon sauvages. Un boss toutes les cinq vagues…",
        en: "Pick Bulbasaur, Charmander, Squirtle or Pikachu, and hold out against waves of wild Pokémon. A boss every five waves…",
      },
      {
        fr: "Bonbons, niveaux, capacités à apprendre (4 au maximum, comme dans les jeux), objets tenus, et ton Pokémon évolue en cours de partie.",
        en: "Candies, levels, moves to learn (4 at most, like in the games), held items, and your Pokémon evolves mid-run.",
      },
      {
        fr: "14 capacités, et 7 évolutions : une capacité au maximum avec le bon objet devient une version surpuissante (Fatal-Foudre, Draco-Météore, Tempête Florale…).",
        en: "14 moves, and 7 evolutions: a move at its peak with the right item becomes a mighty one (Thunder, Draco Meteor, Petal Blizzard…).",
      },
      {
        fr: "Des combos : mouille un ennemi puis frappe-le en Électrik, endors-le puis vise-le en Spectre… Les cartes ont une rareté, et le Centre Pokémon soigne toutes les 5 vagues (et te laisse oublier des capacités).",
        en: "Combos: wet a foe then hit it with Electric, put it to sleep then aim Ghost… Cards have a rarity, and the Pokémon Center heals you every 5 waves (and lets you forget moves).",
      },
      {
        fr: "Les vagues durcissent vraiment avec le temps, et de nouveaux Pokémon sauvages arrivent après la vague 20.",
        en: "The waves really toughen up as time goes on, and new wild Pokémon show up after wave 20.",
      },
      {
        fr: "À la fin, ton pseudo entre au classement de tous les joueurs. Select change la palette de l'écran (vert d'origine, gris Pocket, violet lofi).",
        en: "At the end, your name goes on everyone's ladder. Select changes the screen's palette (original green, Pocket grey, lofi violet).",
      },
    ],
  },
  {
    version: "0.9",
    date: "2026-10-11",
    title: { fr: "Les wishlists", en: "Wishlists" },
    items: [
      {
        fr: "Nouveau classeur ★ Wishlist (le + de l'étagère) : les cartes que tu cherches, de n'importe quelle extension, en fantôme. Elles ne comptent ni dans ta collection ni dans sa valeur.",
        en: "New ★ Wishlist binder (the shelf's +): the cards you're after, from any set, as ghosts. They count neither in your collection nor in its value.",
      },
      {
        fr: "Tu as trouvé la carte ? Un clic sur son fantôme et elle est à toi, rangée dans cette pochette.",
        en: "Found the card? One click on its ghost and it's yours, filed in that pocket.",
      },
      {
        fr: "Autant de wishlists que tu veux : cartes de rêve, cartes roses, ta liste de Noël… Leur sommaire dit ce qu'il reste à trouver, et combien ça coûte.",
        en: "As many wishlists as you like: dream cards, pink cards, your Christmas list… Their summary says what's left to find, and what it costs.",
      },
      { fr: "☆ Wishlist sur la fiche de n'importe quelle carte, pour l'ajouter à une de tes wishlists.", en: "☆ Wishlist on any card's sheet, to add it to one of your wishlists." },
      {
        fr: "NookDex OS → Wishlist : toutes tes cartes cherchées, leur prix total, la liste à copier pour tes échanges, et de quoi créer la wishlist des cartes qui manquent à un classeur.",
        en: "NookDex OS → Wishlist: every card you're after, their total price, the list to copy for your trades, and a way to make the wishlist of a binder's missing cards.",
      },
    ],
  },
  {
    version: "0.8",
    date: "2026-10-10",
    title: { fr: "Les trophées", en: "Trophies" },
    items: [
      {
        fr: "60 trophées à gagner : première carte, première page, classeur complet, master set, cartes rares, Pokémon cultes… et quelques secrets bien cachés dans le bureau.",
        en: "60 trophies to win: first card, first page, complete binder, master set, rare cards, iconic Pokémon… and a few secrets hidden around the desk.",
      },
      {
        fr: "Chaque trophée débloqué s'annonce en bas de l'écran, avec sa fanfare : bronze, argent, or ou platine, plus c'est dur, plus c'est la fête.",
        en: "Every trophy won pops up at the bottom of the screen with its fanfare: bronze, silver, gold or platinum, the harder it is, the bigger the party.",
      },
      { fr: "Ta vitrine à trophées se cache dans la Poké Ball de l'étagère.", en: "Your trophy case hides in the Poké Ball on the shelf." },
      {
        fr: "Les kits du dresseur (EX à Soleil et Lune : Latias, Latios, Positi, Négapi, Lucario…) arrivent dans la recherche, avec leurs prix.",
        en: "The trainer kits (EX to Sun & Moon: Latias, Latios, Plusle, Minun, Lucario…) are in the search, with their prices.",
      },
      {
        fr: "Les promos Méga-Évolution (MEP : Méga-Lucario-ex, Méga-Gardevoir-ex…) arrivent dans la recherche, avec leurs prix.",
        en: "The Mega Evolution promos (MEP: Mega Lucario ex, Mega Gardevoir ex…) are in the search, with their prices.",
      },
      {
        fr: "Dans un classeur libre, tape le numéro imprimé sur la carte (pikachu 60/106), et « Voir plus » montre toutes les cartes d'une longue recherche.",
        en: "In a free binder, type the number printed on the card (pikachu 60/106), and \"Show more\" brings every card of a long search.",
      },
    ],
  },
  {
    version: "0.7",
    date: "2026-10-07",
    title: { fr: "Les vieux sets et toutes les cartes", en: "The old sets and every card" },
    items: [
      {
        fr: "Les sets Wizards (Set de Base, Jungle, Fossile, Team Rocket, Neo, Expedition, Aquapolis…) ont leur onglet dans le choix du classeur.",
        en: "The Wizards sets (Base Set, Jungle, Fossil, Team Rocket, Gym, Neo, Legendary Collection, e-Card…) get their own tab in the binder picker.",
      },
      {
        fr: "NookDex OS → « Toutes les cartes » : chaque carte en FR, EN et JAP, avec filtres (rareté, année, extension, possédées) et tri par prix.",
        en: "NookDex OS → \"All cards\": every card in FR, EN and JAP, with filters (rarity, year, set, owned) and sorted by price.",
      },
      {
        fr: "« Je l'ai ! » depuis n'importe quelle carte : tu choisis le classeur où la ranger.",
        en: "\"I have it!\" from any card: you pick the binder it goes in.",
      },
      {
        fr: "Les extensions retirées de l'étagère restent dans NookDex OS, pour les remettre ou effacer leurs cartes.",
        en: "Sets taken off the shelf stay in NookDex OS, to put them back or delete their cards.",
      },
      { fr: "Le choix du classeur ne montre plus que les logos, plus lisible.", en: "The binder picker shows only the logos, easier to read." },
      {
        fr: "Les prix Cardmarket sont ceux de la nuit, et les anciennes extensions sont tenues à jour elles aussi.",
        en: "Cardmarket prices are last night's, and the older sets are kept up to date too.",
      },
      { fr: "Ce carnet de route, et un numéro de version en bas à gauche.", en: "This road log, and a version number in the bottom-left corner." },
      {
        fr: "Le carnet de Johan et ce carnet de route s'ouvrent en largeur sur ordinateur : leurs liens et boutons restent toujours visibles.",
        en: "Johan's notebook and this road log open wide on a computer: their links and buttons always stay in view.",
      },
      {
        fr: "Sur ordinateur, Warwick attend dans le coin de la pièce : un clic pour lui offrir un bonbon (un petit don pour NookDex).",
        en: "On a computer, Warwick waits in the corner of the room: one click to give him a treat (a small tip for NookDex).",
      },
      { fr: "NookDex est sur Instagram : @_nookdex (lien dans le carnet de Johan).", en: "NookDex is on Instagram: @_nookdex (link in Johan's notebook)." },
      {
        fr: "Cartes japonaises : Black Bolt, White Flare et tout le bloc Méga-Évolution (M1L à M6a) arrivent, plus de 1 500 cartes.",
        en: "Japanese cards: Black Bolt, White Flare and the whole Mega Evolution block (M1L to M6a) are in, over 1,500 cards.",
      },
      {
        fr: "Sur téléphone, le choix du classeur se lit mieux : une extension par ligne, et les séries toujours visibles en haut.",
        en: "On a phone, the binder picker reads better: one set per line, and the series always in view at the top.",
      },
      {
        fr: "Les classeurs se rangent aussi par prix : « Ranger par → Prix », les plus chères d'abord.",
        en: "Binders can be sorted by price too: \"Sort by → Price\", most valuable first.",
      },
      {
        fr: "Des cartes affichaient le prix d'une autre (les Mewtwo des promos XY au prix de Mew, les holos et non-holos des vieux sets) : chacune a retrouvé le sien, ou « — » quand Cardmarket ne permet pas de savoir.",
        en: "Some cards showed another card's price (the XY promo Mewtwos at Mew's, holo and non-holo prints of the old sets): each has its own back, or \"—\" when Cardmarket can't tell.",
      },
      { fr: "Les trois Mew RGB des 30 ans ont leur image.", en: "The three RGB Mew of the 30th Celebration have their picture." },
    ],
  },
  {
    version: "0.6",
    date: "2026-10-04",
    title: { fr: "Partager, suivre les prix", en: "Share, follow the prices" },
    items: [
      { fr: "« Partager ↗ » : une image de ta progression dans un classeur, à envoyer ou télécharger.", en: "\"Share ↗\": a picture of your progress in a binder, to send or download." },
      { fr: "La courbe du prix de chaque carte, jour après jour, dans sa fiche.", en: "Each card's price curve, day after day, in its sheet." },
      { fr: "Le calendrier des sorties, avec les prochaines extensions annoncées.", en: "The release calendar, with the next announced sets." },
      { fr: "Une page par extension : toutes ses cartes, les plus chères, ce que vaut le set complet.", en: "A page per set: every card, the most valuable ones, what the whole set is worth." },
      { fr: "Plus de prix en dollars pour les cartes anglaises (TCGCSV).", en: "More dollar prices for English cards (TCGCSV)." },
      { fr: "Le chat a une gamelle.", en: "The cat has a bowl." },
    ],
  },
  {
    version: "0.5",
    date: "2026-10-03",
    title: { fr: "Le téléphone et le blog", en: "Phones and the blog" },
    items: [
      { fr: "Sur téléphone, les pages d'un classeur défilent en colonne, sans planter Safari.", en: "On a phone, a binder's pages scroll in a column, and Safari no longer crashes." },
      { fr: "Le blog, sur le tableau en liège au-dessus du bureau.", en: "The blog, on the cork board above the desk." },
    ],
  },
  {
    version: "0.4",
    date: "2026-10-02",
    title: { fr: "Cartes anglaises et japonaises", en: "English and Japanese cards" },
    items: [
      { fr: "La langue des cartes se choisit par classeur : FR, EN ou JAP sur la même étagère.", en: "Card language is picked per binder: FR, EN or JAP on the same shelf." },
      { fr: "Cartes anglaises au prix TCGplayer (en dollars), japonaises au prix Cardmarket de leur édition.", en: "English cards at TCGplayer prices (in dollars), Japanese ones at the Cardmarket price of their print." },
      { fr: "Ta devise (€ ou $) dans NookDex OS : achats, valeurs et gains sont comptés dedans.", en: "Your currency (€ or $) in NookDex OS: purchases, values and gains are counted in it." },
      { fr: "Un chargement bien plus rapide.", en: "A much faster loading screen." },
    ],
  },
  {
    version: "0.3",
    date: "2026-10-01",
    title: { fr: "La visite guidée, la version anglaise", en: "The guided tour, the English version" },
    items: [
      { fr: "Une visite guidée après le premier classeur.", en: "A guided tour after the first binder." },
      { fr: "La flèche ↗ ↘ de tendance du prix ; plus de « 0,00 € » pour une carte sans prix.", en: "The ↗ ↘ price trend arrow; no more \"0.00\" for a card with no price." },
      { fr: "Une carte qui disparaît des listes reste rangée, « Bientôt de retour ».", en: "A card that drops out of the lists stays in the binder, \"Back soon\"." },
      { fr: "NookDex parle anglais.", en: "NookDex speaks English." },
    ],
  },
  {
    version: "0.2",
    date: "2026-09-30",
    title: { fr: "NookDex, un compte en ligne", en: "NookDex, an online account" },
    items: [
      { fr: "Le bureau devient NookDex.", en: "The desk becomes NookDex." },
      { fr: "Tes classeurs sur l'étagère, choisis parmi toutes les extensions récentes.", en: "Your own binders on the shelf, picked among every recent set." },
      { fr: "Un compte (e-mail ou Google) : ta collection sauvegardée en ligne, sur tous tes appareils.", en: "An account (e-mail or Google): your collection saved online, on all your devices." },
      { fr: "Les prix Cardmarket mis à jour chaque jour.", en: "Cardmarket prices updated every day." },
    ],
  },
  {
    version: "0.1",
    date: "2026-09-29",
    title: { fr: "Le bureau peint", en: "The painted desk" },
    items: [{ fr: "Un petit bureau peint à la main, des classeurs, des cartes à ranger.", en: "A little hand-painted desk, binders, cards to file away." }],
  },
];

export const APP_VERSION = CHANGELOG[0].version;
