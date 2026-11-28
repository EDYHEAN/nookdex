import type { Metadata } from "next";
import { SetPageView, setPageMetadata, setPageParams } from "@/components/SetPageView";

// every set is known at build time (a new set comes with the prices Action's commit, which redeploys)
export const dynamicParams = false;

export function generateStaticParams() {
  return setPageParams("fr");
}

export async function generateMetadata({ params }: PageProps<"/extensions/[slug]">): Promise<Metadata> {
  return setPageMetadata("fr", (await params).slug);
}

/** One set, French cards and Cardmarket prices. */
export default async function SetPage({ params }: PageProps<"/extensions/[slug]">) {
  return <SetPageView lang="fr" slug={(await params).slug} />;
}
