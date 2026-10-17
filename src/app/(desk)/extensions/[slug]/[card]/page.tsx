import type { Metadata } from "next";
import { CardPageView, cardPageMetadata } from "@/components/CardPageView";

// drawn on each visit like every page of the site (the root layout reads the visitor's language): no static params, no
// revalidate (they would ask for a static page: DYNAMIC_SERVER_USAGE in production)

export async function generateMetadata({ params }: PageProps<"/extensions/[slug]/[card]">): Promise<Metadata> {
  const { slug, card } = await params;
  return cardPageMetadata("fr", slug, card);
}

/** One card, French, Cardmarket prices. */
export default async function CardPage({ params }: PageProps<"/extensions/[slug]/[card]">) {
  const { slug, card } = await params;
  return <CardPageView lang="fr" set={slug} slug={card} />;
}
