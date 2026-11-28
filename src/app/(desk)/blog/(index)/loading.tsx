import { ShopSkeleton } from "@/components/NotebookSkeleton";

// A shop page is wide, the room not behind it (lib/roomless): its own waiting page. In a route group: here it would sit above
// the posts' layout, which checks the address first (lib/pageGuards).
export default function Loading() {
  return <ShopSkeleton />;
}
