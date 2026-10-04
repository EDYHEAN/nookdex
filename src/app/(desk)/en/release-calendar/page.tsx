import type { Metadata } from "next";
import { ReleaseCalendar, calendarMetadata } from "@/components/ReleaseCalendar";

export function generateMetadata(): Metadata {
  return calendarMetadata("en");
}

/** The release calendar, in English. */
export default function ReleaseCalendarEn() {
  return <ReleaseCalendar lang="en" />;
}
