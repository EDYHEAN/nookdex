import type { Metadata } from "next";
import { MarketPage, marketMetadata } from "@/components/MarketPage";

export function generateMetadata(): Metadata {
  return marketMetadata("en");
}

/** The week's risers and fallers, English cards (TCGplayer). */
export default function Market() {
  return <MarketPage lang="en" />;
}
