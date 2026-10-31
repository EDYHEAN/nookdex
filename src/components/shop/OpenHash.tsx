"use client";

import { useEffect } from "react";

/**
 * A folded section (<details>) opens when the address points at it: the set pages link to « /invitations-amazon#me04 »,
 * whose products are folded under their title.
 */
export function OpenHash() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      if (el instanceof HTMLDetailsElement && !el.open) {
        el.open = true;
        el.scrollIntoView({ block: "start" });
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
