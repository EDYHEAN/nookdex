import { ShopSkeleton } from "@/components/NotebookSkeleton";

// A shop page is wide, the room not behind it (lib/roomless): its own waiting page.
export default function Loading() {
  return <ShopSkeleton />;
}
