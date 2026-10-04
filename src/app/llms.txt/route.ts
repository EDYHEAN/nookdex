import { allPosts } from "@/lib/blog";
import { SET_PAGES_ROOT, setPageEntries } from "@/lib/setPath";
import { SITE_DESCRIPTION_EN, SITE_NAME, SITE_URL } from "@/lib/site";

// built with the site: a new post comes with a new deploy
export const dynamic = "force-static";

/** llms.txt: what the site is and where its readable pages are, for AI assistants and their crawlers. */
export function GET() {
  const posts = allPosts()
    .map((p) => `- [${p.title}](${SITE_URL}/blog/${p.slug}) (${p.lang}, ${p.date}): ${p.description}`)
    .join("\n");
  // the recent sets (the binders' ones): the older ones are on the two index pages
  const sets = (["en", "fr"] as const)
    .flatMap((lang) =>
      setPageEntries(lang)
        .filter((e) => !e.set.extra)
        .map(
          (e) =>
            `- [${e.set.name} (${e.set.code})](${SITE_URL}${SET_PAGES_ROOT[lang]}/${e.slug}) (${lang === "en" ? "English cards, TCGplayer prices" : "French cards, Cardmarket prices"})`,
        ),
    )
    .join("\n");
  const txt = `# ${SITE_NAME}

> ${SITE_DESCRIPTION_EN}

${SITE_NAME} is a free Pokémon TCG collection tracker drawn as a hand-painted desk, in French and English: binders per set
(French, English and Japanese cards), card prices updated every day (Cardmarket for French and Japanese cards, TCGplayer for
English ones), wishlist, duplicates and online save.

## Pages

- [About](${SITE_URL}/a-propos): what ${SITE_NAME} does and who makes it
- [English home](${SITE_URL}/en)
- [Pokémon TCG sets](${SITE_URL}/en/sets): every set's card list, rarities and TCGplayer prices (English cards), updated daily
- [Extensions](${SITE_URL}/extensions): the same for French cards, with Cardmarket prices
- [Blog](${SITE_URL}/blog): Pokémon TCG news, set guides and card prices
- [Contact](${SITE_URL}/contact)

## Set pages

${sets}

## Blog posts

${posts || "(none yet)"}
`;
  return new Response(txt, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
