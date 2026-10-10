"use client";

import { useEffect } from "react";
import { useSets } from "./catalog";
import { useCloud } from "./cloud";
import { useStore } from "./store";
import { earned, factsOf } from "./trophies";
import { bump, unlock, useTrophyStore } from "./trophyStore";

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

/**
 * Wins the trophies the collection earns, a moment after it changes (the sets it needs load meanwhile), and the ones
 * of the visit itself: days played, the late hour, the Konami code. Runs once the player is in the room.
 */
export function useTrophyWatch(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const today = new Date().toLocaleDateString("sv"); // YYYY-MM-DD, the player's own day
    if (useTrophyStore.getState().lastDay !== today) {
      useTrophyStore.setState({ lastDay: today });
      const days = bump("days");
      if (days >= 7) unlock("days-7");
      if (days >= 30) unlock("days-30");
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      // the online save is on its way: its cards would be won one by one otherwise
      if (useCloud.getState().status === "loading") return later();
      if (new Date().getHours() < 5) unlock("night-owl");
      const { collection, binders } = useStore.getState();
      const { cards, sets } = useSets.getState();
      const ids = earned(factsOf({ collection, binders, cards, sets, signedIn: !!useCloud.getState().email }), useTrophyStore.getState().got);
      if (ids.length) unlock(...ids);
    };
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(check, 1200);
    };
    later();
    const off = [
      useStore.subscribe((s, p) => {
        if (s.collection !== p.collection || s.binders !== p.binders) later();
      }),
      useSets.subscribe((s, p) => {
        if (s.sets !== p.sets) later();
      }),
      useCloud.subscribe((s, p) => {
        if (s.email !== p.email || s.status !== p.status) later();
      }),
      // a trophy won by a gesture can complete "all"
      useTrophyStore.subscribe((s, p) => {
        if (s.got !== p.got) later();
      }),
    ];

    let typed = 0;
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      // a third ↑ keeps the last two
      typed = key === KONAMI[typed] ? typed + 1 : key === "ArrowUp" ? (typed === 2 ? 2 : 1) : 0;
      if (typed === KONAMI.length) {
        typed = 0;
        unlock("konami");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      off.forEach((f) => f());
      window.removeEventListener("keydown", onKey);
    };
  }, [active]);
}
