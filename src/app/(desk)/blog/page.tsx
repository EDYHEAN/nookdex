import type { Metadata } from "next";
import Link from "next/link";
import { postStage } from "@/components/BlogHero";
import { WidePage } from "@/components/WidePage";
import { ShopHero } from "@/components/shop/ShopHero";
import s from "@/components/shop/Shop.module.css";
import { formatDate, postsIn } from "@/lib/blog";
import { serverLang } from "@/lib/serverLang";
import { SITE_NAME } from "@/lib/site";
import blog from "@/components/Blog.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const en = (await serverLang()) === "en";
  const title = `Blog · ${SITE_NAME}`;
  const description = en
    ? "Pokémon TCG news, set guides and card prices followed every day: the blog of the NookDex desk."
    : "Actus du JCC Pokémon, guides des extensions et prix des cartes suivis chaque jour : le blog du bureau NookDex.";
  return {
    title,
    description,
    alternates: { canonical: "/blog", types: { "application/rss+xml": en ? "/blog/rss-en.xml" : "/blog/rss.xml" } },
    // its own title and address, with the site's painted desk as the picture
    openGraph: {
      type: "website",
      url: "/blog",
      siteName: SITE_NAME,
      title,
      description,
      locale: en ? "en_GB" : "fr_FR",
      images: [{ url: "/opengraph-image.jpg", width: 1200, height: 630, alt: SITE_NAME }],
    },
  };
}

/**
 * The pinboard above the desk: every post in the visitor's language, newest first. In the shop pages' shell (WidePage
 * shop, drawn without the room, Johan 2026-11-01: the « Blog » tab jumped back to the notebook): the latest post under the
 * lamp, then the sticky notes.
 */
export default async function BlogIndex() {
  const lang = await serverLang();
  const en = lang === "en";
  const t = (fr: string, english: string) => (en ? english : fr);
  const posts = postsIn(lang);
  const latest = posts[0];
  const hero = (
    <ShopHero
      head={
        <>
          <p className={s.eyebrow}>{t("Le tableau", "The pinboard")}</p>
          <h1 className={blog.postTitle}>{t("Le tableau : le blog du JCC Pokémon", "The pinboard: Pokémon TCG blog")}</h1>
          <p className={s.lede}>
            {t(
              "Les actus du JCC Pokémon, les guides des extensions et les cartes dont les prix bougent, d'après les prix que NookDex suit chaque jour.",
              "News of the Pokémon Trading Card Game, set guides and the cards whose prices move, from the prices NookDex follows every day.",
            )}
          </p>
        </>
      }
      stage={await postStage(latest)}
      buy={
        latest && (
          <>
            <p className={s.what}>
              {t("Le dernier article", "The latest post")} · <time dateTime={latest.date}>{formatDate(latest.date, lang)}</time>
            </p>
            <p className={blog.heroTitle}>{latest.title}</p>
            <div className={s.btns}>
              <Link prefetch={false} href={`/blog/${latest.slug}`} className={`${s.btn} ${s.alt}`}>
                {t("Lire l'article ▶", "Read it ▶")}
              </Link>
            </div>
          </>
        )
      }
    />
  );
  return (
    <WidePage en={en} shop="/blog" crumbs={[{ href: "/blog", label: "Blog" }]} hero={hero}>
      {posts.length ? (
        <ul className={blog.list}>
          {posts.map((p) => (
            <li key={p.slug}>
              <Link prefetch={false} href={`/blog/${p.slug}`} className={blog.note}>
                <time dateTime={p.date}>
                  {formatDate(p.date, lang)} · {p.minutes} min
                </time>
                <b>{p.title}</b>
                <span>{p.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>{t("Les premières notes arrivent bientôt.", "The first notes are on their way.")}</p>
      )}
      <p className={s.small}>
        <a href={en ? "/blog/rss-en.xml" : "/blog/rss.xml"}>RSS</a>
      </p>
    </WidePage>
  );
}
