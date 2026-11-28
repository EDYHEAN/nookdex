import { guardPost } from "@/lib/pageGuards";

// checked above the post's loading boundary: an unknown post is a real 404, not a streamed 200 (lib/pageGuards)
export default async function PostLayout({ children, params }: LayoutProps<"/blog/[slug]">) {
  guardPost((await params).slug);
  return children;
}
