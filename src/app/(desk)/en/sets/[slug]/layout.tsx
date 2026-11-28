import { guardSet } from "@/lib/pageGuards";

// checked above the page's loading boundary: an unknown set is a real 404, not a streamed 200 (lib/pageGuards)
export default async function SetLayout({ children, params }: LayoutProps<"/en/sets/[slug]">) {
  guardSet("en", (await params).slug);
  return children;
}
