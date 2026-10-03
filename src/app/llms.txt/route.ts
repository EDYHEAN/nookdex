import { allPosts } from "@/lib/blog";
import { SITE_DESCRIPTION_EN, SITE_NAME, SITE_URL } from "@/lib/site";

// built with the site: a new post comes with a new deploy
export const dynamic = "force-static";

/** llms.txt: what the site is and where its readable pages are, for AI assistants and their crawlers. */
export function GET() {
  const posts = allPosts()
    .map((p) => `- [${p.title}](${SITE_URL}/blog/${p.slug}) (${p.lang}, ${p.date}): ${p.description}`)
    .join("\n");
  const txt = `# ${SITE_NAME}

> ${SITE_DESCRIPTION_EN}

${SITE_NAME} is a free Pokémon TCG collection tracker drawn as a hand-painted desk, in French and English: binders per set
(French, English and Japanese cards), card prices updated every day (Cardmarket for French and Japanese cards, TCGplayer for
English ones), wishlist, duplicates and online save.

## Pages

- [About](${SITE_URL}/a-propos): what ${SITE_NAME} does and who makes it
- [Blog](${SITE_URL}/blog): Pokémon TCG news, set guides and card prices
- [Contact](${SITE_URL}/contact)

## Blog posts

${posts || "(none yet)"}
`;
  return new Response(txt, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
