import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_NAME } from "@/lib/site";
import { NotebookBackdrop } from "./NotebookBackdrop";
import styles from "./LegalPage.module.css";

const TABS = [
  { href: "/a-propos", label: "À propos" },
  { href: "/confidentialite", label: "Vie privée" },
  { href: "/conditions", label: "CGU" },
  { href: "/contact", label: "Contact" },
];

/**
 * The public pages (about, privacy, terms, contact): a notebook opened over the room, like the "À propos" one.
 * Server rendered, every word in the HTML, readable without signing in (Google checks these pages).
 * The room stays mounted underneath (see app/(desk)/layout): closing goes back to it without reloading.
 */
export function LegalPage({ path, title, updated, children }: { path: string; title: string; updated?: string; children: ReactNode }) {
  return (
    <NotebookBackdrop>
      <main className={styles.book}>
        <nav className={styles.tabs} aria-label="Pages">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className={t.href === path ? styles.tabOn : undefined} aria-current={t.href === path ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
        <Link href="/" className={styles.close} aria-label={`Retour au bureau ${SITE_NAME}`}>
          ✕
        </Link>
        <article className={styles.sheet}>
          <h1>{title}</h1>
          {updated && <p className={styles.updated}>Mis à jour le {updated}</p>}
          {children}
          <p className={styles.back}>
            <Link href="/">← retour au bureau {SITE_NAME}</Link>
          </p>
        </article>
      </main>
    </NotebookBackdrop>
  );
}
