import { ShopSkeleton } from "@/components/NotebookSkeleton";

// A set's page waits on its own skeleton, under the layout that checks the set (lib/pageGuards): a real 404 for an
// unknown one.
export default function Loading() {
  return <ShopSkeleton />;
}
