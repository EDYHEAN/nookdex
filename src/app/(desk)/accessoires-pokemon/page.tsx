import type { Metadata } from "next";
import { AccessoriesPage, gearMetadata } from "@/components/AccessoriesPage";

export function generateMetadata(): Metadata {
  return gearMetadata("fr");
}

/** Le matériel du collectionneur : classeurs, sleeves, toploaders (amazon.fr). */
export default function AccessoiresPokemon() {
  return <AccessoriesPage lang="fr" />;
}
