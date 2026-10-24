"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import styles from "./LegalPage.module.css";

/**
 * The notebook that was just on screen (a tab clicked: its page goes, its loading skeleton comes, then the next page):
 * the next one doesn't open again (no fade, no rise), only its page turns. Kept outside React: each page draws its own.
 */
let last = { at: 0, skeleton: false };
/** the notebook on screen now (the next one is drawn before the old one goes) */
let current: { skeleton: boolean } | null = null;
/** a notebook gone this recently was the same one, still open */
const STILL_MS = 1500;

/**
 * Closes the notebook back onto the desk: Escape, or a click beside it. The room stays loaded. `skeleton`: the paper page
 * shown while the next page comes (components/NotebookSkeleton).
 */
export function NotebookBackdrop({ children, skeleton = false }: { children: ReactNode; skeleton?: boolean }) {
  const router = useRouter();
  /** how this notebook comes: opened, its page turned (from another page), or filled in (after its skeleton) */
  const [mode] = useState<"open" | "turn" | "fill">(() => {
    if (typeof window === "undefined") return "open";
    const before = current ?? (last.at && performance.now() - last.at < STILL_MS ? last : null);
    if (!before) return "open";
    return before.skeleton && !skeleton ? "fill" : "turn";
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", onKey);
    const me = { skeleton };
    current = me;
    return () => {
      if (current === me) current = null;
      window.removeEventListener("keydown", onKey);
      last = { at: performance.now(), skeleton };
    };
  }, [router, skeleton]);

  return (
    <div
      className={`${styles.backdrop} ${mode === "turn" ? styles.turn : mode === "fill" ? styles.fill : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) router.push("/");
      }}
    >
      {children}
    </div>
  );
}
