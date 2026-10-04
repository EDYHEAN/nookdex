import type { Metadata } from "next";
import { HomeText } from "@/components/HomeText";
import { serverLang } from "@/lib/serverLang";

// "/" is the French home for search engines (they send no language); "/en" is its English twin.
export const metadata: Metadata = {
  alternates: { canonical: "/", languages: { fr: "/", en: "/en", "x-default": "/" } },
};

export default async function Home() {
  return <HomeText en={(await serverLang()) === "en"} />;
}
