import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_NAME } from "@/lib/site";
import { NotebookBackdrop } from "./NotebookBackdrop";
import styles from "./LegalPage.module.css";

const TABS = [
  { href: "/a-propos", label: ["À propos", "About"] },
  { href: "/confidentialite", label: ["Vie privée", "Privacy"] },
  { href: "/conditions", label: ["CGU", "Terms"] },
  { href: "/contact", label: ["Contact", "Contact"] },
] as const;

/**
 * The public pages (about, privacy, terms, contact): a notebook opened over the room, like the "À propos" one.
 * Server rendered, every word in the HTML, readable without signing in (Google checks these pages).
 * The room stays mounted underneath (see app/(desk)/layout): closing goes back to it without reloading.
 */
export function LegalPage({
  path,
  title,
  updated,
  en = false,
  children,
}: {
  path: string;
  title: string;
  updated?: string;
  /** English page (the visitor's language, see lib/serverLang) */
  en?: boolean;
  children: ReactNode;
}) {
  const t = (fr: string, english: string) => (en ? english : fr);
  return (
    <NotebookBackdrop>
      <main className={styles.book}>
        <nav className={styles.tabs} aria-label="Pages">
          {TABS.map((tab) => (
            <Link key={tab.href} href={tab.href} className={tab.href === path ? styles.tabOn : undefined} aria-current={tab.href === path ? "page" : undefined}>
              {t(tab.label[0], tab.label[1])}
            </Link>
          ))}
        </nav>
        <Link href="/" className={styles.close} aria-label={t(`Retour au bureau ${SITE_NAME}`, `Back to the ${SITE_NAME} desk`)}>
          ✕
        </Link>
        <article className={styles.sheet}>
          <h1>{title}</h1>
          {updated && (
            <p className={styles.updated}>
              {t("Mis à jour le", "Updated")} {updated}
            </p>
          )}
          {children}
          <p className={styles.back}>
            <Link href="/">{t(`← retour au bureau ${SITE_NAME}`, `← back to the ${SITE_NAME} desk`)}</Link>
          </p>
        </article>
      </main>
    </NotebookBackdrop>
  );
}
