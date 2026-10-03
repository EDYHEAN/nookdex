import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/LegalPage";
import { allPosts, formatDate, postBySlug, renderPost, translationOf } from "@/lib/blog";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import blog from "@/components/Blog.module.css";

// Every post is built ahead (the routine's commit redeploys the site): an unknown slug is a 404.
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
    alternates: {
      canonical: `/blog/${post.slug}`,
      languages: other ? { [post.lang]: `/blog/${post.slug}`, [other.lang]: `/blog/${other.slug}` } : undefined,
    },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      locale: post.lang === "fr" ? "fr_FR" : "en_US",
      tags: post.tags,
    },
  };
}

/** One post, in the notebook over the desk. Its language is its own, whatever the visitor's. */
export default async function BlogPost({ params }: PageProps<"/blog/[slug]">) {
  const post = postBySlug((await params).slug);
  if (!post) notFound();
  const en = post.lang === "en";
  const other = translationOf(post);
  // Structured data: search engines and AI answers read the article, its date and who publishes it
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    inLanguage: post.lang,
    keywords: post.tags.join(", "),
    url: `${SITE_URL}/blog/${post.slug}`,
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/icon-512.png` },
  };
  return (
    <LegalPage path="/blog" title={post.title} en={en}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <p className={blog.meta} lang={post.lang}>
        <time dateTime={post.date}>{formatDate(post.date, post.lang)}</time>
        {post.tags.length > 0 && <> · {post.tags.join(" · ")}</>}
        {other && (
          <>
            {" "}
            · <Link href={`/blog/${other.slug}`} hrefLang={other.lang}>{en ? "Lire en français" : "Read in English"}</Link>
          </>
        )}
      </p>
      <div className={blog.body} lang={post.lang} dangerouslySetInnerHTML={{ __html: renderPost(post) }} />
      <p className={blog.cta}>
        <Link href="/">{en ? `Track your cards on the ${SITE_NAME} desk ▶` : `Range tes cartes sur le bureau ${SITE_NAME} ▶`}</Link>
      </p>
      <p>
        <Link href="/blog">{en ? "← all posts" : "← tous les articles"}</Link>
      </p>
    </LegalPage>
  );
}
