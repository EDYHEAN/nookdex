import { WideSkeleton } from "@/components/NotebookSkeleton";

// A card's page is wide paper, not the notebook: its own waiting page.
export default function Loading() {
  return <WideSkeleton />;
}
