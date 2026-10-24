"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/lang";
import { NotebookBackdrop } from "./NotebookBackdrop";
import { NotebookTabs } from "./NotebookTabs";
import styles from "./LegalPage.module.css";

/**
 * The notebook while its page comes (app/(desk)/…/loading.tsx, Johan 2026-10-24: the pages are drawn on each visit, a
 * tab clicked showed nothing for half a second): the same notebook, its new tab up, a blank page turning with a title bar
 * and ruled lines waiting for their words. No spinner. Prefetched with the tab, so it's there at the click.
 */
export function NotebookSkeleton() {
  const path = usePathname();
  // the page's address says its language (/en…), else the language the desk speaks
  const lang = useLang();
  const en = path.startsWith("/en") || (lang === "en" && !path.startsWith("/extensions") && !path.startsWith("/calendrier") && !path.startsWith("/invitations"));
  return (
    <NotebookBackdrop skeleton>
      <main className={styles.book} data-skeleton aria-busy="true">
        <NotebookTabs path={path} en={en} />
        <Link href={en ? "/en" : "/"} className={styles.close} aria-label={en ? "Back to the desk" : "Retour au bureau"}>
          ✕
        </Link>
        <article className={`${styles.sheet} ${styles.skeleton}`}>
          <span className={styles.skTitle} />
          {[92, 100, 84, 96, 70, 0, 88, 100, 76, 94, 60].map((w, i) => (
            <span key={i} className={styles.skLine} style={{ width: `${w}%`, animationDelay: `${i * 60}ms` }} />
          ))}
        </article>
      </main>
    </NotebookBackdrop>
  );
}

/** A card's page while it comes (app/(desk)/…/[card]/loading.tsx): the wide paper, a title bar, a scan's place, lines */
export function WideSkeleton() {
  return (
    <div className={styles.wideSkeleton} data-skeleton aria-busy="true">
      <span className={styles.skTitle} />
      <div className={styles.skWide}>
        <span className={styles.skScan} />
        <div>
          {[90, 70, 100, 80, 60].map((w, i) => (
            <span key={i} className={styles.skLine} style={{ width: `${w}%`, animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
