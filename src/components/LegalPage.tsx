import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_NAME } from "@/lib/site";
import { NotebookBackdrop } from "./NotebookBackdrop";
import { NotebookTabs } from "./NotebookTabs";
import styles from "./LegalPage.module.css";

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
        <NotebookTabs path={path} en={en} />
        <Link href={t("/", "/en")} className={styles.close} aria-label={t(`Retour au bureau ${SITE_NAME}`, `Back to the ${SITE_NAME} desk`)}>
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
            <Link href={t("/", "/en")}>{t(`← retour au bureau ${SITE_NAME}`, `← back to the ${SITE_NAME} desk`)}</Link>
          </p>
          {/* the legal notice within reach of every page, without a bookmark of its own */}
          <p className={styles.updated}>
            <Link href="/mentions-legales">{t("Mentions légales", "Legal notice")}</Link> ·{" "}
            <Link href="/conditions-de-vente">{t("Conditions de vente", "Terms of sale")}</Link>
          </p>
        </article>
      </main>
    </NotebookBackdrop>
  );
}
