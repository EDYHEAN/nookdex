"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sfx } from "@/lib/sound";
import styles from "./LegalPage.module.css";

// [French page, English page] when the two languages have their own address (the set pages); "": no English page
const TABS = [
  { href: ["/a-propos", "/a-propos"], label: ["À propos", "About"] },
  { href: ["/extensions", "/en/sets"], label: ["Extensions", "Sets"] },
  { href: ["/calendrier-des-sorties", "/en/release-calendar"], label: ["Sorties", "Releases"] },
  { href: ["/marche", "/en/market"], label: ["Marché", "Market"] },
  // the sealed products on amazon.fr (affiliate): French only
  { href: ["/invitations-amazon", ""], label: ["Invitations", ""] },
  { href: ["/blog", "/blog"], label: ["Blog", "Blog"] },
  { href: ["/confidentialite", "/confidentialite"], label: ["Vie privée", "Privacy"] },
  { href: ["/conditions", "/conditions"], label: ["CGU", "Terms"] },
  { href: ["/contact", "/contact"], label: ["Contact", "Contact"] },
] as const;

/** The tab a page belongs to: its own, or its section's (a set's page is under « Extensions », a post under « Blog ») */
const tabOf = (path: string, en: boolean) =>
  TABS.map((t) => t.href[en ? 1 : 0]).find((href) => href && (path === href || path.startsWith(`${href}/`))) ?? null;

/**
 * The notebook's bookmarks (Johan, 2026-10-24: a tab clicked gave no sign for half a second). The one pressed goes up at
 * once, with a page sound; the next page's paper skeleton (app/(desk)/…/loading.tsx) follows, the content after it.
 * A tab's route is prefetched as the pointer or the focus comes to it, not as it shows: the pages are drawn on each visit,
 * so each tab shown was a server function run, on every page a crawler opened too (Vercel's Hobby quotas, 2026-10-26).
 */
export function NotebookTabs({ path, en }: { path: string; en: boolean }) {
  const t = (fr: string, english: string) => (en ? english : fr);
  const router = useRouter();
  const [pressed, setPressed] = useState<string | null>(null);
  const active = pressed ?? tabOf(path, en);
  return (
    <nav className={styles.tabs} aria-label="Pages">
      {TABS.map((tab) => {
        const href = t(tab.href[0], tab.href[1]);
        if (!href) return null;
        const on = href === active;
        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            onPointerEnter={() => router.prefetch(href)}
            onFocus={() => router.prefetch(href)}
            className={on ? styles.tabOn : undefined}
            aria-current={href === tabOf(path, en) ? "page" : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              setPressed(href);
              // after the tab is drawn up: the first sound of a visit starts the audio, which can hold a frame
              if (href !== active) setTimeout(() => sfx.flip(), 0);
            }}
          >
            {t(tab.label[0], tab.label[1])}
          </Link>
        );
      })}
    </nav>
  );
}
