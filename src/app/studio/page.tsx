import type { Metadata } from "next";
import { Studio } from "@/components/studio/Studio";

// Johan's posting desk: the Instagram and TikTok posts the routine prepares (docs/social.md). Not for search engines.
export const metadata: Metadata = {
  title: "Studio · NookDex",
  robots: { index: false, follow: false },
};

export default function StudioPage() {
  return <Studio />;
}
