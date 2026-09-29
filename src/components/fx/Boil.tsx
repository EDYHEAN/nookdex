"use client";

import { useEffect, useRef } from "react";

/**
 * "Line boil": hand-drawn animation look. Anything with `filter: url(#boil)` wobbles
 * slightly, cycling through 3 drawings at 8 fps like a cel animation shot on twos/threes.
 */
export function BoilFilter({ paused = false }: { paused?: boolean }) {
  const turb = useRef<SVGFETurbulenceElement>(null);
  const turbSoft = useRef<SVGFETurbulenceElement>(null);

  useEffect(() => {
    // every new drawing re-renders the filtered elements: stop while they are hidden
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % 3;
      turb.current?.setAttribute("seed", String(i + 1));
      turbSoft.current?.setAttribute("seed", String(i + 7));
    }, 125);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <filter id="boil" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence ref={turb} type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="1" />
        <feDisplacementMap in="SourceGraphic" scale="5" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id="boil-soft" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence ref={turbSoft} type="fractalNoise" baseFrequency="0.05" numOctaves="1" seed="7" />
        <feDisplacementMap in="SourceGraphic" scale="9" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
