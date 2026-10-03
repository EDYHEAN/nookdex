import { rss } from "@/lib/blogFeed";

// built with the site: a new post comes with a new deploy
export const dynamic = "force-static";

export const GET = () => rss("en");
