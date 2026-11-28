import { guardCard } from "@/lib/pageGuards";

// checked above the page's loading boundary: an unknown card is a real 404, a renamed one a real 308 (lib/pageGuards)
export default async function CardLayout({ children, params }: LayoutProps<"/en/sets/[slug]/[card]">) {
  const { slug, card } = await params;
  await guardCard("en", slug, card);
  return children;
}
