import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/LegalPage";
import { allPosts, faqOf, formatDate, postBySlug, relatedPosts, renderPost, translationOf } from "@/lib/blog";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import blog from "@/components/Blog.module.css";
import legal from "@/components/LegalPage.module.css";

// Every post is known at build time (the routine's commit redeploys the site): an unknown slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return allPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = postBySlug((await params).slug);
  if (!post) return {};
  const other = translationOf(post);
  return {
    title: `${post.title} · ${SITE_NAME}`,
    description: post.description,
    keywords: post.tags,
    alternates: {
      canonical: `/blog/${post.slug}`,
      languages: other ? { [post.lang]: `/blog/${post.slug}`, [other.lang]: `/blog/${other.slug}` } : undefined,
    },
    openGraph: {
      // drawn by og.png/route.tsx, next to this page
      images: [{ url: `/blog/${post.slug}/og.png`, width: 1200, height: 630, alt: post.title }],
      type: "article",
      url: `/blog/${post.slug}`,
      siteName: SITE_NAME,
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      locale: post.lang === "fr" ? "fr_FR" : "en_GB",
      tags: post.tags,
    },
  };
}

const ld = (data: object) => <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;

/** One post, in the notebook over the desk. Its language is its own, whatever the visitor's. */
export default async function BlogPost({ params }: PageProps<"/blog/[slug]">) {
  const post = postBySlug((await params).slug);
  if (!post) notFound();
  const en = post.lang === "en";
  const t = (fr: string, english: string) => (en ? english : fr);
  const other = translationOf(post);
  const url = `${SITE_URL}/blog/${post.slug}`;
  const faq = faqOf(post);
  const more = relatedPosts(post);
  return (
    <LegalPage path="/blog" title={post.title} en={en}>
      {/* Structured data: search engines and AI answers read the article, where it sits, and its questions */}
      {ld({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        dateModified: post.date,
        inLanguage: post.lang,
        keywords: post.tags.join(", "),
        url,
        mainEntityOfPage: url,
        image: `${url}/og.png`,
        author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/icon-512.png` },
      })}
      {ld({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      })}
      {faq.length > 0 &&
        ld({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: post.lang,
          mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        })}

      <div className={blog.meta} lang={post.lang}>
        <time dateTime={post.date}>{formatDate(post.date, post.lang)}</time>
        <span>· {t(`${post.minutes} min de lecture`, `${post.minutes} min read`)}</span>
        {other && (
          <Link href={`/blog/${other.slug}`} hrefLang={other.lang} className={blog.langSwitch}>
            {/* no flag emoji: Windows shows them as two letters */}
            {en ? "FR · Lire en français" : "EN · Read in English"}
          </Link>
        )}
      </div>
      {post.tags.length > 0 && (
        <ul className={blog.tags} aria-label={t("Thèmes", "Topics")}>
          {post.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}

      <div className={blog.body} lang={post.lang} dangerouslySetInnerHTML={{ __html: await renderPost(post) }} />

      <p className={blog.cta}>
        <Link href="/" className={legal.cta}>
          {t(`Range tes cartes sur le bureau ${SITE_NAME} ▶`, `Track your cards on the ${SITE_NAME} desk ▶`)}
        </Link>
      </p>

      {more.length > 0 && (
        <nav className={blog.more} aria-label={t("À lire aussi", "Read next")}>
          <h2>{t("À lire aussi", "Read next")}</h2>
          <ul className={blog.list}>
            {more.map((p) => (
              <li key={p.slug}>
                <Link href={`/blog/${p.slug}`} className={blog.note}>
                  <time dateTime={p.date}>{formatDate(p.date, p.lang)}</time>
                  <b>{p.title}</b>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <p>
        <Link href="/blog">{t("← tous les articles", "← all posts")}</Link>
      </p>
    </LegalPage>
  );
}
