"use client";

import { type ReactNode, useEffect, useState } from "react";
import s from "./Shop.module.css";

/**
 * A phone's bar at the bottom (under 900 px): the hero's product and its button, once the hero's button has scrolled out
 * of sight; hidden again over the FAQ and the footer (`data-sticky-stop`), where it would cover the reading. Its clicks
 * count apart (`<place>-bar`).
 */
export function StickyBuy({
  target,
  href,
  place,
  thumb,
  title,
  sub,
  label,
}: {
  /** the id of the hero's button */
  target: string;
  href: string;
  place: string;
  thumb: ReactNode;
  title: string;
  sub: string;
  label: string;
}) {
  const [past, setPast] = useState(false);
  const [stopped, setStopped] = useState(false);
  useEffect(() => {
    const cta = document.getElementById(target);
    if (!cta) return;
    const seen = new Set<Element>();
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        if (e.target === cta) setPast(!e.isIntersecting && e.boundingClientRect.top < 0);
        else if (e.isIntersecting) seen.add(e.target);
        else seen.delete(e.target);
      }
      setStopped(seen.size > 0);
    });
    io.observe(cta);
    document.querySelectorAll("[data-sticky-stop]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [target]);
  const show = past && !stopped;
  return (
    <div className={show ? `${s.sticky} ${s.show}` : s.sticky} aria-hidden={!show}>
      <span className={s.thumb}>{thumb}</span>
      <span className={s.stickyText}>
        <b>{title}</b>
        <small>{sub}</small>
      </span>
      <a className={s.btn} href={href} target="_blank" rel="sponsored noopener" data-amazon-place={place} tabIndex={show ? undefined : -1}>
        {label} <span className={s.arr}>↗</span>
      </a>
    </div>
  );
}
