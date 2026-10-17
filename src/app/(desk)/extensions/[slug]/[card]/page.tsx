import type { Metadata } from "next";
import { CardPageView, cardPageMetadata } from "@/components/CardPageView";

// 20 000 cards: each page is drawn on its first visit, then kept a day (the prices commit redeploys every day anyway)
export const revalidate = 86400;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/extensions/[slug]/[card]">): Promise<Metadata> {
  const { slug, card } = await params;
  return cardPageMetadata("fr", slug, card);
}

/** One card, French, Cardmarket prices. */
export default async function CardPage({ params }: PageProps<"/extensions/[slug]/[card]">) {
  const { slug, card } = await params;
  return <CardPageView lang="fr" set={slug} slug={card} />;
}
