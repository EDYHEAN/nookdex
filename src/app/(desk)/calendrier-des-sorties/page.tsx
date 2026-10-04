import type { Metadata } from "next";
import { ReleaseCalendar, calendarMetadata } from "@/components/ReleaseCalendar";

export function generateMetadata(): Metadata {
  return calendarMetadata("fr");
}

/** The release calendar, in French (its address says so: the proxy renders it in French whatever the visitor's cookie). */
export default function Calendrier() {
  return <ReleaseCalendar lang="fr" />;
}
