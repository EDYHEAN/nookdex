// The notebook on the shelf ("À propos"). Plain text, one entry per paragraph: rewrite it as you like.
// A line starting with "— " is shown as a signature.

export const ABOUT = {
  title: "Le carnet de Johan",
  pages: [
    {
      heading: "Qui je suis",
      paragraphs: [
        "Salut ! Moi c'est Johan, collectionneur de cartes Pokémon depuis… peut-être toujours. Je suis de 1993 : j'ai carrément grandi avec, comme beaucoup :)",
        "Depuis quelques années, je suis sur le master set de Tempête Argentée en français, et j'échange mes doublons et mes hits d'autres extensions sur Cardmarket.",
      ],
    },
    {
      heading: "Pourquoi ce petit bureau",
      paragraphs: [
        "Je voulais un endroit à moi pour ranger ma collection. Je suis passé par des Excel horribles (même avec de la couleur, c'était pas ouf…), et j'ai été bombardé de pubs pour des applis à foison, souvent payantes au bout de X cartes.",
        "Je voulais aussi un style calme : mon petit coin, avec mon chat Warwick et un peu de lofi, pour classer tranquillement ma collection.",
        "Chaque classeur se remplit carte par carte, avec les prix du jour pour savoir ce que vaut ta collec et ce qu'il te manque.",
        "Enjoy !",
        "— Johan",
      ],
    },
    {
      heading: "Petites lignes",
      paragraphs: [
        "Données des cartes : TCGdex. Prix : Cardmarket (cartes françaises) et TCGplayer (cartes anglaises), mis à jour chaque jour.",
        "Ce site est un projet de fan, sans lien avec Nintendo, Creatures, GAME FREAK ni The Pokémon Company. Pokémon et les noms des cartes appartiennent à leurs propriétaires.",
      ],
    },
  ],
};

/** The same notebook in English (keep both in step). */
export const ABOUT_EN: typeof ABOUT = {
  title: "Johan's notebook",
  pages: [
    {
      heading: "Who I am",
      paragraphs: [
        "Hi! I'm Johan, a Pokémon card collector since… forever, maybe. Born in 1993: I literally grew up with it, like so many of us :)",
        "For a few years now I've been chasing the French master set of Silver Tempest, and I trade my duplicates and the hits of other sets on Cardmarket.",
      ],
    },
    {
      heading: "Why this little desk",
      paragraphs: [
        "I wanted a place of my own to file my collection. I went through horrible spreadsheets (even with colours, not great…), and I got flooded with ads for countless apps, often paid after X cards.",
        "I also wanted something calm: my little corner, with my cat Warwick and some lofi, to file my collection in peace.",
        "Every binder fills up card by card, with today's prices so you know what your collection is worth and what you're missing.",
        "Enjoy!",
        "— Johan",
      ],
    },
    {
      heading: "Small print",
      paragraphs: [
        "Card data: TCGdex. Prices: TCGplayer (English cards) and Cardmarket (French cards), updated every day.",
        "This is a fan project, not affiliated with Nintendo, Creatures, GAME FREAK or The Pokémon Company. Pokémon and card names belong to their owners.",
      ],
    },
  ],
};
