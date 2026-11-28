import { ShopSkeleton } from "@/components/NotebookSkeleton";

// A post waits on its own skeleton, under the layout that checks the post exists (lib/pageGuards): a real 404 otherwise.
export default function Loading() {
  return <ShopSkeleton />;
}
