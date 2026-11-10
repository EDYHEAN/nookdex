import type { Metadata } from "next";
import { AccessoriesPage, gearMetadata } from "@/components/AccessoriesPage";

export function generateMetadata(): Metadata {
  return gearMetadata("en");
}

/** The collector's gear: binders, sleeves, toploaders (amazon.com). */
export default function CardAccessories() {
  return <AccessoriesPage lang="en" />;
}
