import type { Metadata } from "next";
import { CardPageView, cardPageMetadata } from "@/components/CardPageView";

// 25 000 cards: each page is drawn on its first visit, then kept a day (the prices commit redeploys every day anyway)
export const revalidate = 86400;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/en/sets/[slug]/[card]">): Promise<Metadata> {
  const { slug, card } = await params;
  return cardPageMetadata("en", slug, card);
}

/** One card, English, TCGplayer prices. */
export default async function CardPage({ params }: PageProps<"/en/sets/[slug]/[card]">) {
  const { slug, card } = await params;
  return <CardPageView lang="en" set={slug} slug={card} />;
}
