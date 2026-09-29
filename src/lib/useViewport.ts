"use client";

import { useEffect, useState } from "react";

export function useViewport() {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return vp;
}

/** Phones and narrow/portrait windows get the simplified layout. */
export const isCompact = (vp: { w: number; h: number }) => vp.w < 820 || vp.w / vp.h < 1.05;
