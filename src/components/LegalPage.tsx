import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_NAME } from "@/lib/site";
import styles from "./LegalPage.module.css";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className={styles.page}>
      <article className={styles.sheet}>
        <Link href="/" className={styles.back}>
          ← retour au bureau {SITE_NAME}
        </Link>
        <h1>{title}</h1>
        <p className={styles.updated}>Mis à jour le {updated}</p>
        {children}
      </article>
    </main>
  );
}
