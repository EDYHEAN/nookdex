import type { Metadata } from "next";
import { SetPageView, setPageMetadata, setPageParams } from "@/components/SetPageView";

// every set is known at build time (a new set comes with the prices Action's commit, which redeploys)
export const dynamicParams = false;

export function generateStaticParams() {
  return setPageParams("en");
}

export async function generateMetadata({ params }: PageProps<"/en/sets/[slug]">): Promise<Metadata> {
  return setPageMetadata("en", (await params).slug);
}

/** One set, English cards and TCGplayer prices. */
export default async function SetPage({ params }: PageProps<"/en/sets/[slug]">) {
  return <SetPageView lang="en" slug={(await params).slug} />;
}
