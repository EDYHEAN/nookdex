"use client";

import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GRIDS, freeHomes, freePageCount, pocketsOf, wantsOf, type Pocket } from "@/lib/binders";
import { loadSet, setIdOfCard, useSets } from "@/lib/catalog";
import { cardTier, copiesTotals, formatMoney, setStats, unitPrice, type Tier } from "@/lib/price";
import { sortCards } from "@/lib/rarity";
import { SITE_NAME } from "@/lib/site";
import { sfx } from "@/lib/sound";
import { looseCopies, useStore } from "@/lib/store";
import { unlock } from "@/lib/trophyStore";
import type { BinderDef, CardData } from "@/lib/types";
import { isCompact, useViewport } from "@/lib/useViewport";
import { CardPicker } from "./CardPicker";
import { CardSlot, EmptyPocket, LoadingPocket, type AddResult } from "./CardSlot";
import { Celebration } from "./Celebration";
import { Inspector } from "./Inspector";
import { FillSet } from "./FillSet";
import { ShareSheet } from "./ShareSheet";
import { HoldToRemove, RemoveChoice, StatsPage, type BinderSummary } from "./StatsPage";
import styles from "./Binder.module.css";
import { useT } from "@/lib/lang";

type Face = { type: "cover" } | { type: "stats" } | { type: "page"; index: number } | { type: "blank" } | null;
interface LeafDef {
  front: Face;
  back: Face;
}

interface Props {
  binder: BinderDef;
  /** Card to show once the binder is open (from the PC search / wishlist). */
  focusCardId?: string | null;
  onClosed: () => void;
  /** Called instead of onClosed once the binder was taken off the shelf: its cards to the box (keep) or deleted. */
  onRemoved: (keep: boolean) => void;
  /** The binder rises over the room (true), or starts leaving (false). */
  onCover?: (covering: boolean) => void;
  /** « Ou ta liste d'échange » in the share sheet: the trade binder, this set picked out */
  onOpenTrade?: (setKey: string) => void;
  /** the trade binder lies over it: its keys are the trade binder's */
  overlaid?: boolean;
}

const SCROLL_GAP = 14; // phone: space between two pages of the column

export function BinderView({ binder, focusCardId, onClosed, onRemoved, onCover, onOpenTrade, overlaid }: Props) {
  const t = useT();
  const free = binder.kind === "free";
  /** a wishlist: some pockets hold wanted cards, drawn as ghosts */
  const wish = binder.wish;
  const wants = useMemo(() => wantsOf(binder), [binder]);
  const set = useSets((s) => (binder.setId ? s.sets[binder.setId] : undefined));
  const cardData = useSets((s) => s.cards);
  const vp = useViewport();
  const single = isCompact(vp);
  const titleH = single ? 64 : 58;
  const navH = single ? 70 : 64;
  /** pockets a page, and its shape */
  const grid = GRIDS[binder.grid];
  const PER_PAGE = binder.grid;

  const { pageW, pageH, gap } = useMemo(() => {
    const maxH = vp.h - titleH - navH - 16;
    const maxW = single ? vp.w - 24 : (vp.w - 120) / 2.08;
    const ph = Math.max(200, Math.min(maxH, maxW / grid.aspect));
    const pw = ph * grid.aspect;
    // the rings' gap as for a 9-pocket page: a narrower page keeps the same binder
    return { pageW: Math.round(pw), pageH: Math.round(ph), gap: single ? 0 : Math.round(ph * 0.74 * 0.08) };
  }, [vp.w, vp.h, single, titleH, navH, grid.aspect]);

  const collection = useStore((s) => s.collection);
  /** the "show my binder" sheet (set binders) */
  const [sharing, setSharing] = useState(false);
  /** the grid just changed: the cards are dealt again (not at each page turn) */
  const [dealing, setDealing] = useState(false);
  const lastGrid = useRef(binder.grid);
  useEffect(() => {
    if (lastGrid.current === binder.grid) return;
    lastGrid.current = binder.grid;
    setDealing(true);
    const t = setTimeout(() => setDealing(false), 900);
    return () => clearTimeout(t);
  }, [binder.grid]);
  const userBinders = useStore((s) => s.binders);
  const addCard = useStore((s) => s.addCard);
  const placeCard = useStore((s) => s.placeCard);
  const { wishCard, unwish, obtainWish } = useStore.getState();

  // A free binder's pockets hold the copies slipped in them.
  const pockets = useMemo(() => (free ? pocketsOf(binder.id, collection) : null), [free, binder.id, collection]);

  const pages = useMemo(() => {
    const out: Pocket[][] = [];
    if (pockets) {
      const n = freePageCount(new Map<number, unknown>([...wants, ...pockets]), PER_PAGE);
      for (let pg = 0; pg < n; pg++) {
        out.push(
          Array.from({ length: PER_PAGE }, (_, k) => {
            const index = pg * PER_PAGE + k;
            const kept = pockets.get(index)?.cardId;
            const cardId = kept ?? wants.get(index) ?? null;
            return { index, cardId, card: cardId ? (cardData[cardId] ?? null) : null, ...(!kept && cardId ? { wanted: true } : {}) };
          }),
        );
      }
      return out;
    }
    const cards = set ? sortCards(set.cards, binder.sort) : [];
    for (let i = 0; i < cards.length; i += PER_PAGE)
      out.push(cards.slice(i, i + PER_PAGE).map((card, k) => ({ index: i + k, cardId: card.id, card })));
    return out;
  }, [pockets, wants, set, cardData, binder.sort, PER_PAGE]);

  // Cards slipped in a free binder from a set that isn't downloaded yet.
  useEffect(() => {
    if (!pockets) return;
    for (const cardId of [...[...pockets.values()].map((p) => p.cardId), ...wants.values()]) {
      const id = setIdOfCard(cardId);
      if (!cardData[cardId] && id) void loadSet(id).catch(() => {});
    }
  }, [pockets, wants, cardData]);

  /** Cards you can page through in the inspector, in binder order. */
  const browsable = useMemo(() => pages.flat().filter((p): p is Pocket & { card: CardData } => !!p.card), [pages]);

  // Leaves of the spread (a phone has no leaves: its pages scroll, see `scroller`)
  const leaves = useMemo<LeafDef[]>(() => {
    if (single) return [];
    const out: LeafDef[] = [{ front: { type: "cover" }, back: { type: "stats" } }];
    for (let i = 0; i < pages.length; i += 2) {
      out.push({
        front: { type: "page", index: i },
        back: i + 1 < pages.length ? { type: "page", index: i + 1 } : { type: "blank" },
      });
    }
    return out;
  }, [pages, single]);

  const maxF = leaves.length;
  const [f, setF] = useState(0);
  const fRef = useRef(0);
  const [fast, setFast] = useState(false);
  const [phase, setPhase] = useState<"enter" | "open" | "closing">("enter");
  /** leaves in the middle of a turn, and the leaves resting flipped (on the left) once their turn is over */
  const [anim, setAnim] = useState<ReadonlySet<number>>(() => new Set());
  const [rest, setRest] = useState<ReadonlySet<number>>(() => new Set());
  const onTurn = useCallback((i: number, flipped: boolean, done: boolean) => {
    const put = (s: ReadonlySet<number>, on: boolean) => {
      if (s.has(i) === on) return s;
      const n = new Set(s);
      if (on) n.add(i);
      else n.delete(i);
      return n;
    };
    setAnim((s) => put(s, !done));
    if (done) setRest((s) => put(s, flipped));
  }, []);
  /** pocket index of the card shown in the inspector */
  const [inspect, setInspect] = useState<number | null>(null);
  /** empty pocket being filled (free binder) */
  const [picking, setPicking] = useState<number | null>(null);
  const [party, setParty] = useState<{ id: number; card: CardData } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  /** the cards of a binder taken off the shelf: to the box, or deleted */
  const keepCards = useRef(true);
  const [focused, setFocused] = useState<number | null>(null);
  const riffleTimer = useRef<number | null>(null);
  /** Phone: the summary and the pages scroll in a column (no leaves turning: their 3D layers ran Safari out of memory) */
  const scroller = useRef<HTMLDivElement>(null);
  /** Phone: the item in view, 0 = the summary, then page n at n */
  const [inView, setInView] = useState(0);
  const inViewRef = useRef(0);
  const scrollStep = pageH + SCROLL_GAP;

  const summary = useMemo<BinderSummary>(() => {
    if (set) {
      const st = setStats(set, collection);
      return { ...st, count: `${st.owned}/${st.total}`, pricesUpdated: set.pricesUpdated };
    }
    const items = [...(pockets?.values() ?? [])].flatMap(({ cardId, copy }) =>
      cardData[cardId] ? [{ card: cardData[cardId], copies: [copy] }] : [],
    );
    const t = copiesTotals(items);
    if (wish) {
      // what's still wanted, and what it costs on the market
      const wanted = [...wants.entries()].filter(([pocket]) => !pockets?.has(pocket));
      const left = wanted.reduce((n, [, cardId]) => n + (cardData[cardId] ? unitPrice(cardData[cardId], cardData[cardId].variants[0], "trend") : 0), 0);
      const total = t.cards + wanted.length;
      return { ...t, owned: t.cards, total, masterOwned: 0, masterTotal: 0, count: `${t.cards}/${total}`, pricesUpdated: null, left };
    }
    return { ...t, owned: t.cards, total: t.cards, masterOwned: 0, masterTotal: 0, count: String(t.cards), pricesUpdated: null };
  }, [set, pockets, wants, wish, collection, cardData]);

  const go = useCallback((next: number, quick = false) => {
    fRef.current = next;
    setFast(quick);
    setF(next);
  }, []);

  /** Flip several leaves in a row, like riffling through the binder. */
  const riffleTo = useCallback(
    (target: number, done?: () => void) => {
      if (riffleTimer.current) clearInterval(riffleTimer.current);
      const step = () => {
        const cur = fRef.current;
        if (cur === target) {
          if (riffleTimer.current) clearInterval(riffleTimer.current);
          riffleTimer.current = null;
          done?.();
          return;
        }
        sfx.riffle();
        go(cur + (target > cur ? 1 : -1), true);
      };
      if (Math.abs(target - fRef.current) === 1) {
        sfx.flip();
        go(target);
        done?.();
        return;
      }
      step();
      riffleTimer.current = window.setInterval(step, 55);
    },
    [go],
  );

  useEffect(() => () => {
    if (riffleTimer.current) clearInterval(riffleTimer.current);
  }, []);

  // The room can go as soon as the binder rises: on a phone, its pictures and layers next to the binder's opening were
  // enough to run Safari out of memory (the tab reloads, showing the loader again, or crashes).
  useEffect(() => onCover?.(true), [onCover]);

  // Open the cover once the binder has landed in front of us.
  useEffect(() => {
    const t = setTimeout(() => {
      sfx.coverOpen();
      go(1);
      setPhase("open");
    }, 560);
    return () => clearTimeout(t);
  }, [go]);

  // Closing drops the open binder out of the screen: no riffling back, so pages never overlap.
  const close = useCallback(() => {
    if (phase !== "open") return;
    if (riffleTimer.current) clearInterval(riffleTimer.current);
    setInspect(null);
    setPicking(null);
    setPhase("closing");
    onCover?.(false);
    sfx.drop();
    setLeaving(true);
  }, [phase, onCover]);

  const remove = useCallback((keep: boolean) => {
    keepCards.current = keep;
    setRemoving(true);
    close();
  }, [close]);


  /** Phone: scroll the column to an item (0 = summary, n = page n) */
  const scrollTo = useCallback(
    (item: number) => {
      const el = scroller.current;
      if (!el) return;
      sfx.flip();
      el.scrollTo({ top: Math.min(pages.length, Math.max(0, item)) * scrollStep, behavior: "smooth" });
    },
    [pages.length, scrollStep],
  );
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const i = Math.min(pages.length, Math.max(0, Math.round(el.scrollTop / scrollStep)));
    if (i === inViewRef.current) return;
    inViewRef.current = i;
    setInView(i);
  };

  const next = useCallback(() => {
    if (phase !== "open") return;
    if (single) return scrollTo(inViewRef.current + 1);
    if (fRef.current >= maxF) return;
    riffleTo(fRef.current + 1);
  }, [phase, single, maxF, riffleTo, scrollTo]);
  const prev = useCallback(() => {
    if (phase !== "open") return;
    if (single) return scrollTo(inViewRef.current - 1);
    if (fRef.current <= 1) return;
    riffleTo(fRef.current - 1);
  }, [phase, single, riffleTo, scrollTo]);

  const jumpToPage = useCallback(
    (pageIndex: number, force = false) => {
      if (phase !== "open" && !force) return;
      if (single) return scrollTo(pageIndex + 1);
      const target = Math.floor(pageIndex / 2) + 1 + (pageIndex % 2);
      riffleTo(Math.min(maxF, Math.max(1, target)));
    },
    [phase, single, maxF, riffleTo, scrollTo],
  );

  // Coming from the PC: riffle to the card and make it pulse.
  const focusDone = useRef(false);
  useEffect(() => {
    if (phase !== "open" || !focusCardId || focusDone.current) return;
    focusDone.current = true;
    const i = pages.flat().find((p) => p.cardId === focusCardId)?.index ?? -1;
    if (i < 0) return;
    const t1 = setTimeout(() => {
      jumpToPage(Math.floor(i / PER_PAGE), true);
      setFocused(i);
    }, 450);
    const t2 = setTimeout(() => setFocused(null), 4500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase, focusCardId, pages, jumpToPage, PER_PAGE]);

  // Search from the summary page: same riffle and pulse.
  const focusTimer = useRef<number | null>(null);
  const find = useCallback(
    (pocket: number) => {
      jumpToPage(Math.floor(pocket / PER_PAGE));
      setFocused(pocket);
      if (focusTimer.current) clearTimeout(focusTimer.current);
      focusTimer.current = window.setTimeout(() => setFocused((f) => (f === pocket ? null : f)), 3500);
    },
    [jumpToPage, PER_PAGE],
  );

  // keyboard + wheel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inspect != null || picking != null || sharing || overlaid) return;
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") close();
    };
    let lastWheel = 0;
    const onWheel = (e: WheelEvent) => {
      // the phone's column scrolls by itself
      if (single || inspect != null || picking != null) return;
      const now = performance.now();
      if (now - lastWheel < 380 || Math.abs(e.deltaY) < 8) return;
      lastWheel = now;
      if (e.deltaY > 0) next();
      else prev();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, [next, prev, close, inspect, picking, sharing, overlaid, single]);

  // swipe
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - s.y)) {
      if (dx < 0) next();
      else prev();
    }
  };

  const combo = useRef({ n: 0, t: 0 });
  /** Sound, combo and party of a card going in the binder. */
  const cheer = useCallback((card: CardData): AddResult => {
    const now = performance.now();
    const c = combo.current;
    c.n = now - c.t < 2500 ? c.n + 1 : 0;
    c.t = now;
    const tier: Tier = cardTier(card);
    sfx.add(c.n, tier);
    if (c.n + 1 >= 10) unlock("combo");
    if (tier === "legend") setParty({ id: now, card });
    return { combo: c.n + 1, gain: unitPrice(card, card.variants[0], "trend"), tier };
  }, []);
  const onAdd = useCallback(
    (card: CardData): AddResult => {
      addCard(card.id, card.variants[0]);
      return cheer(card);
    },
    [addCard, cheer],
  );

  /** "Got it!" on a wanted card: a copy kept in that very pocket (never in its set's binder). */
  const obtain = useCallback(
    (pocket: number, card: CardData): AddResult => {
      obtainWish(binder.id, pocket, card.variants[0]);
      return cheer(card);
    },
    [obtainWish, binder.id, cheer],
  );

  // Free binder: slip the card picked in the search into the pocket.
  const onPlace = useCallback(
    async (cardId: string) => {
      if (picking == null) return;
      const setId = setIdOfCard(cardId);
      if (!setId) throw new Error("unknown set");
      const card = (await loadSet(setId)).cards.find((c) => c.id === cardId);
      if (!card) throw new Error("unknown card");
      const pocket = picking;
      // a wishlist takes the card as wanted, a free binder as a copy
      if (wish) {
        wishCard(binder.id, cardId, pocket);
        sfx.wish();
      } else {
        placeCard(binder.id, pocket, cardId, card.variants[0]);
        cheer(card);
      }
      setPicking(null);
      setFocused(pocket);
      setTimeout(() => setFocused((f) => (f === pocket ? null : f)), 1600);
    },
    [picking, placeCard, binder.id, cheer, wish, wishCard],
  );

  /** "dans Fourre-tout" on a set card that is only kept in free binders */
  const tagOf = (cardId: string) => {
    if (free) return undefined;
    const copies = collection[cardId];
    if (!copies?.length || looseCopies(copies).length) return undefined;
    const homes = freeHomes(copies, userBinders);
    return homes.length ? t(`dans ${homes[0].name}`, `in ${homes[0].name}`) : undefined;
  };

  // geometry
  const spreadW = single ? pageW : pageW * 2 + gap;
  const left = (vp.w - spreadW) / 2;
  // a phone's column takes the whole height between the title and the nav
  const wrapH = single ? vp.h - titleH - navH - 16 : pageH;
  const top = titleH + (vp.h - titleH - navH - wrapH) / 2;
  const closedShift = single ? 0 : -(pageW + gap) / 2;
  // The binder rises from the bottom of the screen, with a touch of motion blur. Not on a phone: the blur keeps an
  // offscreen copy of the whole binder, memory Safari can't spare while the binder's pages are drawn.
  const below = {
    y: vp.h - top + 40,
    rotateX: 32,
    scale: 0.84,
    opacity: 0,
    ...(single ? {} : { filter: "blur(10px)" }),
  };
  const dropped = { ...below, rotateX: -14, ...(single ? {} : { filter: "blur(8px)" }) };
  // no filter left once landed: even blur(0px) keeps the whole binder in an offscreen copy and flattens its 3D in Safari
  const landed = single
    ? { y: 0, rotateX: 0, scale: 1, opacity: 1 }
    : { y: 0, rotateX: 0, scale: 1, opacity: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } };

  /** near: the pockets are drawn (only around the page in view, the others stay bare sheets) */
  const renderFace = (face: Face, side: "front" | "back", near: boolean): ReactNode => {
    if (!face) return null;
    if (face.type === "cover") return <Cover binder={binder} name={set?.name ?? binder.name} count={summary.count} />;
    if (face.type === "stats")
      return (
        <StatsPage
          binder={binder}
          title={set?.name ?? binder.name}
          stats={summary}
          pages={pages}
          collection={collection}
          onJump={jumpToPage}
          onFind={find}
        />
      );
    if (face.type === "blank") return <div className={styles.sheet} />;
    return (
      <div className={styles.sheet} data-side={side}>
        {/* a new grid deals the cards again (keyed by it) */}
        <div key={binder.grid} className={`${styles.grid} ${dealing ? styles.dealing : ""}`} style={{ gridTemplateColumns: `repeat(${grid.cols}, ${grid.colW}%)` }}>
          {near &&
            pages[face.index].map((p) =>
              p.card && p.wanted ? (
                <CardSlot
                  key={p.index}
                  card={p.card}
                  copies={undefined}
                  focused={focused === p.index}
                  onAdd={(card) => obtain(p.index, card)}
                  onInspect={() => setInspect(p.index)}
                  wish
                  tag={collection[p.card.id]?.length ? t("déjà à toi", "already yours") : undefined}
                />
              ) : p.card ? (
                <CardSlot
                  key={p.index}
                  card={p.card}
                  copies={collection[p.card.id]}
                  focused={focused === p.index}
                  onAdd={onAdd}
                  onInspect={() => setInspect(p.index)}
                  tag={tagOf(p.card.id)}
                />
              ) : p.cardId ? (
                <LoadingPocket key={p.index} />
              ) : (
                <EmptyPocket key={p.index} index={p.index} onPick={setPicking} />
              ),
            )}
        </div>
        <span className={styles.pageNum}>{face.index + 1}</span>
      </div>
    );
  };

  let pageLabel = "";
  if (single) pageLabel = inView === 0 ? t("sommaire", "summary") : `page ${inView} / ${pages.length}`;
  else if (f === 0) pageLabel = t("fermé", "closed");
  else if (f === 1) pageLabel = `${t("sommaire", "summary")} · page 1 / ${pages.length}`;
  else if (f > leaves.length - 1) pageLabel = `page ${pages.length} / ${pages.length}`;
  else pageLabel = `pages ${2 * (f - 1)}–${Math.min(2 * (f - 1) + 1, pages.length)} / ${pages.length}`;

  const atStart = single ? inView <= 0 : f <= 1;
  const atEnd = single ? inView >= pages.length : f >= maxF;

  const inspectIndex = inspect == null ? -1 : browsable.findIndex((p) => p.index === inspect);
  const overlay = inspect != null || picking != null;

  // A leaf turns from the render that flips it (not a frame later, when its animation starts) until it lands:
  // in between it must stay drawn and on top, or it vanishes for a frame and then turns over itself.
  const turning = leaves.map((_, i) => anim.has(i) || i < f !== rest.has(i));
  // Leaves lying flat under another one are hidden: each drawn leaf is a full-page 3D layer.
  let topRight = leaves.length;
  let topLeft = -1;
  turning.forEach((moving, i) => {
    if (moving) return;
    if (i >= f) topRight = Math.min(topRight, i);
    else topLeft = i;
  });
  const covered = (i: number) => !turning[i] && (i >= f ? i > topRight : i < topLeft);

  return (
    <motion.div
      className={styles.overlay}
      data-tour="binder"
      initial={{ opacity: 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: leaving ? 0.45 : 0.35 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <motion.header
        className={styles.title}
        style={{ height: titleH }}
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: phase === "open" ? 0 : -40, opacity: phase === "open" ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <div className={styles.titleText}>
          <h1>{set?.name ?? binder.name}</h1>
          <p>
            {wish ? (
              <>
                {summary.owned}/{summary.total} {t("trouvées", "found")} · {t("reste", "left")} <b>{formatMoney(summary.left ?? 0)}</b>
              </>
            ) : (
              <>
                {summary.count} {t("cartes", "cards")} · <b>{formatMoney(summary.trend)}</b>
              </>
            )}
          </p>
        </div>
        <div className={styles.titleActions}>
          {set && binder.setId && <FillSet set={set} />}
          {set && binder.setId && summary.owned > 0 && (
            <button
              className={`${styles.pixelBtn} ${styles.shareBtn}`}
              onClick={() => {
                sfx.pop();
                setSharing(true);
              }}
              onPointerEnter={sfx.hover}
              aria-label={t("Partager ma progression", "Share my progress")}
              title={t("Partager ma progression", "Share my progress")}
            >
              <span className={styles.shareLabel}>{t("Partager", "Share")}</span> ↗
            </button>
          )}
          {summary.owned ? (
            <RemoveChoice label={free ? t("Jeter", "Bin it") : t("Retirer", "Remove")} cards={summary.owned} onConfirm={remove} />
          ) : (
            <HoldToRemove
              label={free ? t("Jeter", "Bin it") : t("Retirer", "Remove")}
              hint={free ? t("Maintiens pour jeter ce classeur vide", "Hold to bin this empty binder") : t("Maintiens pour retirer ce classeur vide de l'étagère", "Hold to take this empty binder off the shelf")}
              onConfirm={() => remove(true)}
            />
          )}
          <button className={styles.pixelBtn} onClick={close} onPointerEnter={sfx.hover} data-tour="close-binder">
            {t("Ranger", "Put away")} <kbd>{t("Échap", "Esc")}</kbd>
          </button>
        </div>
      </motion.header>

      <AnimatePresence>
        {sharing && set && binder.setId && (
          <ShareSheet
            key="share"
            setKey={binder.setId}
            set={set}
            owned={summary.owned}
            value={summary.trend}
            onClose={() => setSharing(false)}
            onList={
              onOpenTrade &&
              (() => {
                setSharing(false);
                onOpenTrade(binder.setId!);
              })
            }
          />
        )}
      </AnimatePresence>

      <motion.div
        className={styles.wrapper}
        style={{ left, top, width: spreadW, height: wrapH, ["--pw" as string]: `${pageW}px`, ["--ph" as string]: `${pageH}px` }}
        initial={below}
        animate={leaving ? dropped : landed}
        transition={
          leaving
            ? { duration: 0.42, ease: [0.55, 0, 0.8, 0.2] }
            : {
                duration: 0.62,
                ease: [0.16, 1, 0.3, 1],
                opacity: { duration: 0.2 },
                filter: { duration: 0.45, ease: "easeOut" },
              }
        }
        onAnimationComplete={() => {
          if (!leaving) return;
          if (removing) onRemoved(keepCards.current);
          else onClosed();
        }}
        onPointerDown={single ? undefined : onPointerDown}
        onPointerUp={single ? undefined : onPointerUp}
      >
        {single ? (
          <>
            {/* the summary, then the pages, in a column scrolled by hand: flat sheets, nothing turns */}
            <div ref={scroller} className={styles.scroller} style={{ gap: SCROLL_GAP }} onScroll={onScroll}>
              {[{ type: "stats" } as Face, ...pages.map((_, i): Face => ({ type: "page", index: i }))].map((face, i) => (
                <div key={i} className={styles.scrollPage} style={{ height: pageH }}>
                  {renderFace(face, "front", phase !== "enter" && Math.abs(i - inView) <= 1)}
                </div>
              ))}
            </div>
            {/* the closed cover, lifted off once the binder has landed */}
            <AnimatePresence>
              {phase === "enter" && (
                <motion.div
                  key="cover"
                  className={styles.scrollCover}
                  style={{ height: pageH }}
                  exit={{ opacity: 0, y: -24, scale: 1.04 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                >
                  <Cover binder={binder} name={set?.name ?? binder.name} count={summary.count} />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <motion.div
            className={styles.book}
            initial={{ x: closedShift }}
            animate={{ x: f === 0 ? closedShift : 0 }}
            transition={{ duration: 0.75, ease: [0.45, 0, 0.2, 1] }}
          >
            {/* inside of the back cover */}
            <div className={styles.board} style={{ left: pageW + gap, width: pageW, background: binder.dark }}>
              <div className={styles.endPage}>
                <span>✦</span>
                <p>{t("fin du classeur", "end of binder")}</p>
              </div>
            </div>
            <div className={styles.rings} style={{ left: pageW, width: gap }}>
              {[0.2, 0.5, 0.8].map((p) => (
                <span key={p} style={{ top: `${p * 100}%` }} />
              ))}
            </div>
            {leaves.map((leaf, i) => {
              const near = Math.abs(i - f) <= 2 || (i === 0 && f <= 2);
              return (
                <Leaf
                  key={i}
                  index={i}
                  total={leaves.length}
                  flipped={i < f}
                  moving={turning[i]}
                  covered={covered(i)}
                  onTurn={onTurn}
                  fast={fast}
                  left={pageW + gap}
                  pivot={-gap / 2}
                  width={pageW}
                  color={binder.dark}
                  front={renderFace(leaf.front, "front", near)}
                  back={renderFace(leaf.back, "back", near)}
                />
              );
            })}
            {/* no page turning behind the card sheet or the card search: their arrows (and focus ring) showed through */}
            {phase === "open" && !overlay && f < maxF && (
              <button className={`${styles.corner} ${styles.cornerRight}`} onClick={next} aria-label={t("Page suivante", "Next page")} />
            )}
            {phase === "open" && !overlay && f > 1 && (
              <button className={`${styles.corner} ${styles.cornerLeft}`} onClick={prev} aria-label={t("Page précédente", "Previous page")} />
            )}
          </motion.div>
        )}
      </motion.div>

      <motion.nav
        className={styles.nav}
        style={{ height: navH, pointerEvents: overlay ? "none" : undefined }}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: phase === "open" && !overlay ? 0 : 40, opacity: phase === "open" && !overlay ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <button className={styles.arrow} onClick={prev} disabled={atStart} onPointerEnter={sfx.hover} aria-label={t("Précédent", "Previous")}>
          ◀
        </button>
        <span className={styles.pageLabel}>{pageLabel}</span>
        <button className={styles.arrow} onClick={next} disabled={atEnd} onPointerEnter={sfx.hover} aria-label={t("Suivant", "Next")} data-tour="next-page">
          ▶
        </button>
      </motion.nav>

      {inspectIndex >= 0 && (
        <Inspector
          key={inspect}
          card={browsable[inspectIndex].card}
          binderId={free ? binder.id : null}
          onUnwish={
            browsable[inspectIndex].wanted
              ? () => {
                  sfx.remove();
                  unwish(binder.id, browsable[inspectIndex].index);
                  setInspect(null);
                }
              : undefined
          }
          onClose={() => setInspect(null)}
          onNavigate={(d) => {
            const n = inspectIndex + d;
            if (n >= 0 && n < browsable.length) {
              sfx.riffle();
              setInspect(browsable[n].index);
            }
          }}
          onAdd={browsable[inspectIndex].wanted ? (card) => obtain(browsable[inspectIndex].index, card) : onAdd}
        />
      )}

      <AnimatePresence>
        {picking != null && <CardPicker key="pick" pocket={picking} wish={wish} onPick={onPlace} onClose={() => setPicking(null)} />}
      </AnimatePresence>

      {party && <Celebration key={party.id} card={party.card} onDone={() => setParty(null)} />}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */

interface LeafProps {
  index: number;
  total: number;
  flipped: boolean;
  /** turning (from the parent: it knows from the very render that flips the leaf) */
  moving: boolean;
  /** flat under another leaf: not drawn */
  covered: boolean;
  onTurn: (index: number, flipped: boolean, done: boolean) => void;
  fast: boolean;
  left: number;
  pivot: number;
  width: number;
  color: string;
  front: ReactNode;
  back: ReactNode;
}

function Leaf({ index, total, flipped, moving, covered, onTurn, fast, left, pivot, width, color, front, back }: LeafProps) {
  const rot = useMotionValue(flipped ? -180 : 0);
  const shade = useTransform(rot, [0, -90, -180], [0, 0.5, 0]);
  const blur = useTransform(rot, [0, -90, -180], ["blur(0px)", "blur(1.4px)", "blur(0px)"]);
  const sheen = useTransform(rot, [0, -180], ["-60%", "160%"]);

  useEffect(() => {
    const target = flipped ? -180 : 0;
    if (rot.get() === target) {
      onTurn(index, flipped, true);
      return;
    }
    const ctrl = animate(rot, target, {
      duration: fast ? 0.3 : 0.52,
      ease: [0.33, 0, 0.15, 1],
      onPlay: () => onTurn(index, flipped, false),
      onComplete: () => onTurn(index, flipped, true),
    });
    return () => ctrl.stop();
  }, [flipped, fast, rot, index, onTurn]);

  // While turning, the leaf goes on top; among several turning leaves, the last one launched wins.
  const z = moving ? total * 3 + (flipped ? index : total - index) : flipped ? index + 1 : total * 2 - index;
  const isCover = index === 0;

  return (
    <motion.div
      className={`${styles.leaf} ${moving ? styles.moving : ""} ${isCover ? styles.coverLeaf : ""}`}
      style={{
        left,
        width,
        zIndex: z,
        rotateY: rot,
        transformPerspective: 2400,
        originX: `${pivot}px`,
        visibility: covered ? "hidden" : "visible",
        ["--leaf" as string]: color,
      }}
    >
      <div className={styles.face}>
        <motion.div className={styles.faceInner} style={moving ? { filter: blur } : undefined}>
          {front}
        </motion.div>
        <motion.div className={styles.shade} style={{ opacity: shade }} />
        {moving && <motion.div className={styles.sheen} style={{ left: sheen }} />}
      </div>
      <div className={`${styles.face} ${styles.back}`}>
        <motion.div className={styles.faceInner} style={moving ? { filter: blur } : undefined}>
          {back}
        </motion.div>
        <motion.div className={styles.shade} style={{ opacity: shade }} />
      </div>
    </motion.div>
  );
}

function Cover({ binder, name, count }: { binder: BinderDef; name: string; count: string }) {
  const t = useT();
  const free = binder.kind === "free";
  return (
    <div className={styles.cover} style={{ background: binder.color, color: binder.ink }}>
      <div className={styles.coverStitch} style={{ borderColor: binder.dark }} />
      <div className={styles.coverInner}>
        <span className={styles.coverCode} style={{ background: binder.dark, color: binder.color }}>
          {binder.code}
        </span>
        {binder.logo ? (
          <img className={styles.coverLogo} src={`${binder.logo}.png`} alt={name} draggable={false} />
        ) : (
          <p className={styles.coverTitle}>{name}</p>
        )}
        <p className={styles.coverName}>{binder.wish ? "★ wishlist" : free ? t("classeur libre", "free binder") : name}</p>
        <p className={styles.coverCount}>
          {free && !binder.wish ? `${count} ${t("carte", "card")}${count === "1" ? "" : "s"}` : count.replace("/", " / ")}
        </p>
      </div>
      <span className={styles.coverBrand}>{SITE_NAME}</span>
    </div>
  );
}
