import { ShopSkeleton } from "@/components/NotebookSkeleton";

// A text page in the shop pages' shell, the room not behind it (lib/roomless): its own waiting page.
export default function Loading() {
  return <ShopSkeleton />;
}
