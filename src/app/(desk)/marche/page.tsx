import type { Metadata } from "next";
import { MarketPage, marketMetadata } from "@/components/MarketPage";

export function generateMetadata(): Metadata {
  return marketMetadata("fr");
}

/** The week's risers and fallers, French cards (Cardmarket): the proxy renders it in French whatever the cookie. */
export default function Marche() {
  return <MarketPage lang="fr" />;
}
