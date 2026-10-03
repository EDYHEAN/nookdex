import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { formatDate, postsIn } from "@/lib/blog";
import { serverLang } from "@/lib/serverLang";
import { SITE_NAME } from "@/lib/site";
import blog from "@/components/Blog.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await serverLang()) === "en";
  return {
    title: `Blog · ${SITE_NAME}`,
    description: en
      ? "Pokémon TCG news, set guides and card prices followed every day: the blog of the NookDex desk."
      : "Actus du JCC Pokémon, guides des extensions et prix des cartes suivis chaque jour : le blog du bureau NookDex.",
    alternates: { canonical: "/blog", types: { "application/rss+xml": en ? "/blog/rss-en.xml" : "/blog/rss.xml" } },
  };
}

/** The pinboard above the desk: every post in the visitor's language, newest first. */
export default async function BlogIndex() {
  const lang = await serverLang();
  const en = lang === "en";
  const posts = postsIn(lang);
  return (
    <LegalPage path="/blog" title={en ? "The pinboard: Pokémon TCG blog" : "Le tableau : le blog du JCC Pokémon"} en={en}>
      <p>
        {en
          ? "News of the Pokémon Trading Card Game, set guides and the cards whose prices move, from the prices NookDex follows every day."
          : "Les actus du JCC Pokémon, les guides des extensions et les cartes dont les prix bougent, d'après les prix que NookDex suit chaque jour."}
      </p>
      {posts.length ? (
        <ul className={blog.list}>
          {posts.map((p) => (
            <li key={p.slug}>
              <Link href={`/blog/${p.slug}`} className={blog.note}>
                <time dateTime={p.date}>{formatDate(p.date, lang)}</time>
                <b>{p.title}</b>
                <span>{p.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>{en ? "The first notes are on their way." : "Les premières notes arrivent bientôt."}</p>
      )}
      <p>
        <a href={en ? "/blog/rss-en.xml" : "/blog/rss.xml"}>RSS</a>
      </p>
    </LegalPage>
  );
}
