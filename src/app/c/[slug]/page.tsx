import type { Metadata } from "next";
import { cache } from "react";
import { ListPage } from "@/components/share/ListPage";
import { serverLang } from "@/lib/serverLang";
import { getShare, resolveCards, sortList } from "@/lib/shareList";
import { SITE_NAME } from "@/lib/site";

/**
 * A player's public list (lib/share): « Je cherche » and « J'échange », opened from a Facebook group or a Discord, mostly
 * in a phone's in-app browser. Outside the desk on purpose: no room, no loader, no « appuie pour entrer », just the cards.
 * Drawn on each visit (the list follows its owner's collection) in the visitor's language. Not for search engines: a
 * pseudo's list, and the card pages already answer the searches.
 */

// the metadata and the page read the list once (a visit counted once)
const load = cache((slug: string) => getShare(slug, true));

const who = (name: string, en: boolean) => name || (en ? "A trainer" : "Un dresseur");

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [row, lang] = await Promise.all([load(slug), serverLang()]);
  const en = lang === "en";
  if (!row) return { title: SITE_NAME, robots: { index: false, follow: false } };
  const want = row.data.want.length;
  const give = row.data.give.length;
  const title = en ? `${who(row.name, en)}'s list · ${SITE_NAME}` : `La liste de ${who(row.name, en)} · ${SITE_NAME}`;
  const description = en ? `Looking for ${want} cards · ${give} up for trade. Pokémon cards, today's prices.` : `${want} cartes cherchées · ${give} à échanger. Cartes Pokémon, prix du jour.`;
  // the picture's address changes with the list and with its drawing (d): Facebook and WhatsApp keep a picture by its address
  const image = `/c/${slug}/og.png?v=${Date.parse(row.updated_at) || 0}&d=2&l=${lang}`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { type: "website", title, description, url: `/c/${slug}`, siteName: SITE_NAME, images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SharePage({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const [row, lang] = await Promise.all([load(slug), serverLang()]);
  const en = lang === "en";
  if (!row) return <ListPage en={en} slug={slug} gone />;
  const [want, give] = await Promise.all([
    resolveCards(row.data.want.map((key) => ({ key, variant: null, n: 1 }))),
    resolveCards(row.data.give.map(([key, variant, n]) => ({ key, variant, n }))),
  ]);
  return (
    <ListPage
      en={en}
      slug={slug}
      name={who(row.name, en)}
      updatedAt={row.updated_at}
      prices={row.prices}
      want={sortList(want)}
      give={sortList(give)}
    />
  );
}
