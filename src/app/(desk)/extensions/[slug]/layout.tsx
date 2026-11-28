import { guardSet } from "@/lib/pageGuards";

// checked above the page's loading boundary: an unknown set is a real 404, not a streamed 200 (lib/pageGuards)
export default async function SetLayout({ children, params }: LayoutProps<"/extensions/[slug]">) {
  guardSet("fr", (await params).slug);
  return children;
}
