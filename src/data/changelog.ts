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
