"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import styles from "./LegalPage.module.css";

/** Closes the notebook back onto the desk: Escape, or a click beside it. The room stays loaded. */
export function NotebookBackdrop({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) router.push("/");
      }}
    >
      {children}
    </div>
  );
}
