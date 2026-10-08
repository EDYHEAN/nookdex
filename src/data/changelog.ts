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
