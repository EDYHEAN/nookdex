"use client";

import { useMemo } from "react";
import { useSets } from "./catalog";
import { collectionTotals } from "./price";
import { useStore } from "./store";

/** The whole collection: progress over the set binders, value of every card owned. */
export function useTotals() {
  const collection = useStore((s) => s.collection);
  const binders = useStore((s) => s.binders);
  const sets = useSets((s) => s.sets);
  const cards = useSets((s) => s.cards);
  return useMemo(() => {
    const tracked = binders.flatMap((b) => (b.kind === "set" && sets[b.setId] ? [sets[b.setId]] : []));
    return collectionTotals(collection, cards, tracked);
  }, [collection, binders, sets, cards]);
}
